"""Exports livrés des saisons + décision profondeur + contrôle des masques.

Forêt (~/a2art/out/assets/seasons/<saison>/, récupérée par remote.sh pull) :
  season-<saison>-stage-<n>.webp   couleur WebP 1536×2304 (recalée, s01, puis
                                   agrandie par upscale.py du pipeline de base,
                                   cache work/upscaled/), qualité 80 par défaut,
                                   abaissée par pas de 2 (plancher 76) jusqu'à
                                   tenir COLOR_BUDGET (≈ 0,6 Mo) : les peintures de
                                   saison (neige, feuilles, fleurs) sont plus
                                   détaillées que la base (≈ 0,65 Mo à q80) ;
  season-<saison>-depth-<n>.webp   profondeur de saison (WebP sans perte ou PNG,
                                   le plus léger), SEULEMENT si la profondeur
                                   de base ne convient pas — sinon le manifest
                                   réutilise la carte de base (même URL) ;
  season-<saison>-lut-night.png    LUT nuit (s03_luts.py).
Règle de réutilisation (scommon) : dérive ≤ MAX_DRIFT_PX (s01) et
  depth_mae ≤ MAX_DEPTH_MAE et depth_changed ≤ MAX_DEPTH_CHANGED (s02).
Bandeaux ($A2S_ROOT/out/themes/seasons/) : season-<budget|courses>-<saison>-
  <landscape|portrait>.webp, opaques, qualité 82, comme universes/banners.py.

Sorties : work/export.json (décisions, poids), qa/s04-stages-<saison>.jpg,
          qa/s04-masks.jpg (eau bleu, feuillage vert, cèdre rouge sur la saison),
          qa/s04-banners.jpg (cadrages réels des bandeaux).
"""
from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image, ImageDraw

from scommon import (
    MASKS, MAX_DEPTH_CHANGED, MAX_DEPTH_MAE, MAX_DRIFT_PX, QA, SEASONS, SRC_BANNERS, THEMES_OUT, WORK,
    WORLD_OUT, aligned_path, grid, label, load_aligned, load_base, read_json, tile, to_u8, write_json,
)
from upscale import PH, PW, cached  # pipeline de base (copié dans base/ par remote.sh push)

BANNERS = {
    "budget": "b-bathhouse-{s}-{f}.png",
    "courses": "k-koriko-{s}-{f}.png",
}
# Cadrages recommandés des bandeaux de base (universes/banners.py) : mêmes réglages.
MOBILE, DESKTOP, PHONE = 390 / 200, 16 / 9, 390 / 844
FRAMES = {
    ("budget", "landscape"): [("bandeau", MOBILE, (50, 10)), ("desktop", DESKTOP, (50, 35))],
    ("budget", "portrait"): [("téléphone", PHONE, (60, 50)), ("bandeau", MOBILE, (50, 18))],
    ("courses", "landscape"): [("bandeau", MOBILE, (50, 8)), ("desktop", DESKTOP, (50, 20))],
    ("courses", "portrait"): [("téléphone", PHONE, (62, 50)), ("bandeau", MOBILE, (50, 22))],
}


COLOR_BUDGET = 600 * 1024
QUALITIES = (80, 78, 76)


def color_webp(im: Image.Image) -> tuple[bytes, int]:
    """Qualité la plus haute qui tient le budget (plancher : la dernière)."""
    for q in QUALITIES:
        data = webp_bytes(im, quality=q)
        if len(data) <= COLOR_BUDGET:
            break
    return data, q


def webp_bytes(im: Image.Image, **kw) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "WEBP", method=6, **kw)
    return buf.getvalue()


def save_depth(season: str, n: int) -> dict:
    """Profondeur de saison 8 bits → WebP sans perte ou PNG, le plus léger."""
    im = Image.open(WORK / "depth" / f"{season}-stage-{n}.png").convert("L")
    wb = webp_bytes(im, lossless=True, quality=100)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    pb = buf.getvalue()
    d = WORLD_OUT / season
    for ext in ("webp", "png"):
        (d / f"season-{season}-depth-{n}.{ext}").unlink(missing_ok=True)
    ext, data = ("webp", wb) if len(wb) < len(pb) else ("png", pb)
    (d / f"season-{season}-depth-{n}.{ext}").write_bytes(data)
    return {"file": f"season-{season}-depth-{n}.{ext}", "bytes": len(data)}


def frame(w: int, h: int, aspect: float, pos: tuple[int, int]):
    if w / h > aspect:
        cw, ch = round(h * aspect), h
    else:
        cw, ch = w, round(w / aspect)
    x = round((w - cw) * pos[0] / 100)
    y = round((h - ch) * pos[1] / 100)
    return x, y, x + cw, y + ch


def mask_overlay(rgb: np.ndarray, masks: np.ndarray) -> np.ndarray:
    """Eau (R) teintée bleu, feuillage (G) vert, contour du cèdre (B) rouge."""
    small = cv2.resize(rgb, (masks.shape[1], masks.shape[0]), interpolation=cv2.INTER_AREA)
    water, leaf, cedar = (masks[..., i].astype(np.float32) / 255 for i in range(3))
    out = small * (1 - 0.55 * water[..., None]) + np.array([0.1, 0.45, 1.0]) * 0.55 * water[..., None]
    out = out * (1 - 0.25 * leaf[..., None]) + np.array([0.2, 1.0, 0.2]) * 0.25 * leaf[..., None]
    edge = cv2.morphologyEx((cedar > 0.5).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
    out[edge] = (1.0, 0.1, 0.1)
    return np.clip(out, 0, 1)


def forest(report: dict) -> None:
    align = read_json(WORK / "align.json")
    depth = read_json(WORK / "depth.json")
    for season in SEASONS:
        d = WORLD_OUT / season
        d.mkdir(parents=True, exist_ok=True)
        tiles = []
        for n in range(1, 8):
            name = f"{season}-stage-{n}"
            im = cached(aligned_path(season, n), WORK / "upscaled" / f"{name}.png")
            assert im.size == (PW, PH), im.size
            data, q = color_webp(im)
            (d / f"season-{name}.webp").write_bytes(data)
            a, z = align[name], depth[name]
            reuse = a["drift_px"] <= MAX_DRIFT_PX and z["depth_mae"] <= MAX_DEPTH_MAE and z["depth_changed"] <= MAX_DEPTH_CHANGED
            r = {
                "color_bytes": len(data),
                "quality": q,
                "drift_px": a["drift_px"],
                "depth_mae": z["depth_mae"],
                "depth_changed": z["depth_changed"],
                "depth": "base" if reuse else "season",
            }
            if reuse:
                for ext in ("webp", "png"):
                    (d / f"season-{season}-depth-{n}.{ext}").unlink(missing_ok=True)
            else:
                r["depth_file"] = save_depth(season, n)
            report["forest"][name] = r
            print(name, r, flush=True)
            tiles.append(label(tile(np.asarray(im), 200), f"{n} q{q} {len(data) // 1024}K depth={r['depth']}"))
        tiles.append(label(tile(load_aligned(season, "night"), 200), "nuit (cible LUT)"))
        grid(tiles, 8).save(QA / f"s04-stages-{season}.jpg", quality=84)

    masks = np.asarray(Image.open(MASKS / "masks.png").convert("RGB"))
    tiles = [label(tile(mask_overlay(load_base(n), masks), 256), f"base {n}") for n in (1, 6)]
    for season in SEASONS:
        for n in (1, 6):
            tiles.append(label(tile(mask_overlay(load_aligned(season, n), masks), 256), f"{season} {n}"))
    grid(tiles, 8).save(QA / "s04-masks.jpg", quality=86)
    # Zoom sur le ruisseau (bas de l'image) pour l'hiver : l'eau doit rester sur l'eau.
    zoom = []
    for who, img in [("base 6", load_base(6))] + [(f"{s} 6", load_aligned(s, 6)) for s in SEASONS]:
        ov = mask_overlay(img, masks)[430:768, 60:452]
        zoom.append(label(Image.fromarray(to_u8(ov)), who))
    grid(zoom, 4).save(QA / "s04-masks-water.jpg", quality=86)


def banners(report: dict) -> None:
    rows = []
    for theme, pattern in BANNERS.items():
        for season in ("autumn", "winter"):
            for f in ("landscape", "portrait"):
                im = Image.open(SRC_BANNERS / pattern.format(s=season, f=f)).convert("RGB")
                if im.width > 1600:
                    im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
                out = THEMES_OUT / f"season-{theme}-{season}-{f}.webp"
                out.write_bytes(webp_bytes(im, quality=82))
                report["banners"][out.name] = {"w": im.width, "h": im.height, "bytes": out.stat().st_size}
                print(out.name, report["banners"][out.name], flush=True)
                tiles = []
                for lab, aspect, pos in FRAMES[(theme, f)]:
                    c = im.crop(frame(im.width, im.height, aspect, pos))
                    c = c.resize((round(160 * c.width / c.height), 160), Image.LANCZOS)
                    ImageDraw.Draw(c).text((4, 4), f"{out.stem} {lab}", fill=(255, 255, 255))
                    tiles.append(c)
                row = Image.new("RGB", (sum(t.width + 6 for t in tiles), 160), (20, 20, 24))
                x = 0
                for t in tiles:
                    row.paste(t, (x, 0))
                    x += t.width + 6
                rows.append(row)
    sheet = Image.new("RGB", (max(r.width for r in rows), len(rows) * 166), (20, 20, 24))
    for i, r in enumerate(rows):
        sheet.paste(r, (0, i * 166))
    sheet.save(QA / "s04-banners.jpg", quality=84)


def main() -> None:
    report: dict = {"forest": {}, "banners": {}}
    forest(report)
    banners(report)
    write_json(report, WORK / "export.json")
    kb = sum(r["color_bytes"] for r in report["forest"].values()) / 1024
    print(f"forêt : {kb:.0f} Ko de couleur ({kb / len(report['forest']):.0f} Ko / image)")


if __name__ == "__main__":
    main()
