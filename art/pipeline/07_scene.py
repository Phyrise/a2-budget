"""Couches de scène : couleur par stade, profondeur, cadre de premier plan,
bandeaux fixes et image d'attente.

  - stages/stage-<n>.webp : peinture recalée (01_align.py), 1024×1536, WebP q84 ;
  - depth/stage-<n>.(png|webp) : carte 512×768 de 02_depth.py, sans perte
    (le plus léger des deux formats) ;
  - foreground.webp : 07-foreground-frame, alpha vérifié, bords décontaminés
    (pas de liseré clair), couleurs propagées sous l'alpha nul ;
  - banners/budget.webp : 02-master-landscape (1536×1024, taille native) ;
  - banners/courses.webp : bande paysage 3:2 tirée de 03-vitality-lively
    (ruisseau, cascade et rochers moussus au soleil ; le bandeau de l'app est
    ≈ 1,4:1 en « cover ») ;
  - placeholder.webp : stade 6 minuscule (≤ 3 KB), à afficher flouté.

Sorties : out/assets/…, out/work/scene.json, planches out/qa/07-*.
"""
from __future__ import annotations

import importlib
import io

import cv2
import numpy as np
from PIL import Image

from common import ASSETS, QA, SRC, STAGE_SOURCES, WORK, grid, label, write_json

sprites = importlib.import_module("05_sprites")

COURSES_SRC = "03-vitality-lively"
# Bande (x0, y0, largeur, hauteur) en pixels source 1024×1536 — choisie sur la planche 07-banner-candidates.
COURSES_CROP = (0, 853, 1024, 683)


def webp_bytes(im: Image.Image, **kw) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "WEBP", **kw)
    return buf.getvalue()


def main() -> None:
    report: dict = {"stages": {}, "depth": {}}
    (ASSETS / "stages").mkdir(parents=True, exist_ok=True)
    for s, name in STAGE_SOURCES.items():
        im = Image.open(WORK / "aligned" / f"{name}.png").convert("RGB")
        assert im.size == (1024, 1536), im.size
        p = ASSETS / "stages" / f"stage-{s}.webp"
        im.save(p, "WEBP", quality=84, method=6)
        report["stages"][s] = {"file": f"stages/stage-{s}.webp", "bytes": p.stat().st_size}
        print("stage", s, report["stages"][s])

    # Profondeur : PNG 8 bits (02_depth.py) → format sans perte le plus léger.
    for s in STAGE_SOURCES:
        keep = WORK / "depth" / f"stage-{s}.png"  # écrit par 02_depth.py
        (ASSETS / "depth").mkdir(parents=True, exist_ok=True)
        data_png = keep.read_bytes()
        im = Image.open(keep).convert("L")
        wb = webp_bytes(im.convert("RGB"), lossless=True, quality=100, method=6)
        for ext in ("png", "webp"):
            (ASSETS / "depth" / f"stage-{s}.{ext}").unlink(missing_ok=True)
        if len(wb) < len(data_png) * 0.9:
            (ASSETS / "depth" / f"stage-{s}.webp").write_bytes(wb)
            report["depth"][s] = {"file": f"depth/stage-{s}.webp", "bytes": len(wb)}
        else:
            (ASSETS / "depth" / f"stage-{s}.png").write_bytes(data_png)
            report["depth"][s] = {"file": f"depth/stage-{s}.png", "bytes": len(data_png)}
        print("depth", s, report["depth"][s])

    # Cadre de premier plan.
    fg = np.asarray(Image.open(SRC / "07-foreground-frame.png").convert("RGBA"), dtype=np.float32) / 255.0
    a = fg[..., 3]
    edge = (a > 0.08) & (a < 0.85)
    core = cv2.erode((a > 0.98).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    near_core = cv2.dilate(edge.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    lum = fg[..., :3].mean(2)
    l_edge = float(lum[edge].mean()) if edge.any() else 0.0
    l_core = float(lum[core & near_core].mean()) if (core & near_core).any() else 0.0
    print(f"premier plan : alpha min {a.min():.3f} max {a.max():.3f}, bord {edge.mean() * 100:.2f} %, "
          f"luminance bord {l_edge:.3f} vs cœur voisin {l_core:.3f}")
    clean = fg.copy()
    if l_edge > l_core + 0.02:
        # Liseré clair (détourage sur fond blanc) : dé-prémultiplication du blanc.
        al = np.maximum(a, 1e-3)[..., None]
        clean[..., :3] = np.clip((fg[..., :3] - (1 - al)) / al, 0, 1)
        clean[..., :3] = np.where((a < 0.02)[..., None], fg[..., :3], clean[..., :3])
        print("  → dé-prémultiplication du fond blanc")
    clean = sprites.decontaminate(clean)
    clean = sprites.clean_alpha(clean, 0.02)
    clean = sprites.bleed(clean)
    u8 = np.clip(np.round(clean * 255), 0, 255).astype(np.uint8)
    p = ASSETS / "foreground.webp"
    Image.fromarray(u8, "RGBA").save(p, "WEBP", quality=84, alpha_quality=90, method=6, exact=True)
    report["foreground"] = {"file": "foreground.webp", "bytes": p.stat().st_size, "edge_lum": l_edge, "core_lum": l_core}
    print("foreground", report["foreground"])

    # Bandeaux.
    (ASSETS / "banners").mkdir(parents=True, exist_ok=True)
    land = Image.open(SRC / "02-master-landscape.png").convert("RGB")
    p = ASSETS / "banners" / "budget.webp"
    land.save(p, "WEBP", quality=80, method=6)
    report["banner_budget"] = {"file": "banners/budget.webp", "w": land.width, "h": land.height, "bytes": p.stat().st_size}
    src = Image.open(WORK / "aligned" / f"{COURSES_SRC}.png").convert("RGB")
    x0, y0, w, h = COURSES_CROP
    band = src.crop((x0, y0, x0 + w, y0 + h))
    p = ASSETS / "banners" / "courses.webp"
    band.save(p, "WEBP", quality=80, method=6)
    report["banner_courses"] = {"file": "banners/courses.webp", "w": band.width, "h": band.height, "bytes": p.stat().st_size}
    print("banners", report["banner_budget"], report["banner_courses"])

    # Candidats de bandeau (planche de choix).
    cands = []
    for nm in ("03-vitality-lively", "03-vitality-flourishing", "06-clean-plate", "03-vitality-peaceful"):
        im = Image.open(WORK / "aligned" / f"{nm}.png").convert("RGB")
        for yy in (0, 300, 640, 880, 1024):
            cands.append(label(im.crop((0, yy, 1024, yy + 512)).resize((384, 192), Image.LANCZOS), f"{nm} y={yy}"))
    grid(cands, 5).save(QA / "07-banner-candidates.jpg", quality=80)
    grid([label(land.resize((768, 512), Image.LANCZOS), "budget"), label(band.resize((768, 512), Image.LANCZOS), "courses")], 2).save(
        QA / "07-banners.jpg", quality=84
    )

    # Image d'attente : la plus grande qui tienne dans 3 KB.
    master = Image.open(WORK / "aligned" / f"{STAGE_SOURCES[6]}.png").convert("RGB")
    best = None
    for w in (48, 40, 32, 24):
        small = master.resize((w, w * 3 // 2), Image.LANCZOS)
        data = webp_bytes(small, quality=55, method=6)
        if len(data) <= 3000:
            best = (w, data)
            break
    assert best is not None
    (ASSETS / "placeholder.webp").write_bytes(best[1])
    report["placeholder"] = {"file": "placeholder.webp", "w": best[0], "h": best[0] * 3 // 2, "bytes": len(best[1])}
    print("placeholder", report["placeholder"])
    ph = Image.open(io.BytesIO(best[1])).convert("RGB").resize((256, 384), Image.BICUBIC)
    fgv = Image.new("RGBA", (1024, 1536), (200, 30, 200, 255))
    fgv.alpha_composite(Image.fromarray(u8, "RGBA"))
    st6 = master.convert("RGBA")
    st6.alpha_composite(Image.fromarray(u8, "RGBA"))
    grid(
        [
            label(ph, "placeholder"),
            label(fgv.convert("RGB").resize((256, 384), Image.LANCZOS), "foreground / magenta"),
            label(st6.convert("RGB").resize((256, 384), Image.LANCZOS), "stade 6 + premier plan"),
        ],
        3,
    ).save(QA / "07-scene.jpg", quality=84)
    # Zoom sur un bord du premier plan (contrôle du liseré) : la fenêtre de
    # 220 px la plus riche en bords semi-transparents.
    al = u8[..., 3].astype(np.float32) / 255
    dens = cv2.boxFilter(((al > 0.1) & (al < 0.9)).astype(np.float32), -1, (220, 220), normalize=True)
    cy, cx = np.unravel_index(int(np.argmax(dens[110:-110, 110:-110])), dens[110:-110, 110:-110].shape)
    box = (int(cx), int(cy), int(cx) + 220, int(cy) + 220)
    print("zoom premier plan :", box)
    zoom = Image.new("RGBA", (220, 220), (235, 235, 235, 255))
    zoom.alpha_composite(Image.fromarray(u8, "RGBA").crop(box))
    zoom2 = master.convert("RGBA").crop(box)
    zoom2.alpha_composite(Image.fromarray(u8, "RGBA").crop(box))
    grid([zoom.convert("RGB").resize((440, 440), Image.NEAREST), zoom2.convert("RGB").resize((440, 440), Image.NEAREST)], 2).save(
        QA / "07-foreground-edge.jpg", quality=88
    )
    write_json(report, WORK / "scene.json")


if __name__ == "__main__":
    main()
