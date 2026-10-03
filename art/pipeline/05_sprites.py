"""Sprites détourés : kodama, créatures, gardien, compagnons (Jiji, Calcifer).

Les planches ont déjà un fond transparent. Pour chaque planche :
  - découpe en composantes connexes de l'alpha (fusion des petits fragments
    proches : moustaches, étincelles, spores) ;
  - tri en ordre de lecture (rangées puis colonnes) ;
  - rognage + marge, redimensionnement en espace prémultiplié (pas de liseré) ;
  - nettoyage des bords : décontamination des couleurs des pixels
    semi-transparents (couleur estimée à partir des pixels opaques voisins),
    suppression du voile alpha résiduel, propagation des couleurs sous
    l'alpha nul (filtrage bilinéaire GPU sans halo) ;
  - WebP avec alpha (`exact` : on garde les couleurs propagées).

Sorties : out/assets/sprites/*.webp, out/work/sprites.json (tailles), planches out/qa/05-*.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from common import ASSETS, QA, SRC, WORK, grid, label, write_json

OUTD = ASSETS / "sprites"
OUTD.mkdir(parents=True, exist_ok=True)

# Ordre de lecture des planches → noms (choisis en regardant les planches).
KODAMA = [f"kodama-{i}" for i in range(1, 9)]
# 09-small-spirits-sheet : boule de mousse, graine lumineuse, volute de brume,
# champignon, spore lumineuse, faon → ids CREATURES de @a2/core.
CREATURES = ["moss-ling", "seed-spirit", "ember-wisp", "mushroom-pip", "leaf-sprite", "water-drip"]
# Compagnons : UNIQUEMENT les planches V3 (grille 3×2, case bas-droite vide).
# Ordre de lecture : 1 idle, 2 happy, 3 proud, 4 sleepy, 5 curious.
#   12-jiji-reactions-v3 : assis sceptique, clin d'œil bouche ouverte, bond
#   surpris pattes levées, roulé en boule endormi, regard curieux vers le haut.
#   13-calcifer-reactions-v3 : pince-sans-rire, bouche grande ouverte, regard en
#   coin vantard, flamme basse endormie, regard curieux vers le haut.
POSES = ["idle", "happy", "proud", "sleepy", "curious"]
JIJI_SHEET = "12-jiji-reactions-v3"
CALCIFER_SHEET = "13-calcifer-reactions-v3"


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(SRC / f"{name}.png").convert("RGBA"), dtype=np.float32) / 255.0


def components(rgba: np.ndarray, expected: int, merge_px: int = 24) -> list[tuple[int, int, int, int]]:
    """Boîtes (x0, y0, x1, y1) des `expected` plus grands objets, en ordre de lecture."""
    a = (rgba[..., 3] > 0.02).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (merge_px, merge_px))
    merged = cv2.dilate(a, k)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(merged, connectivity=8)
    idx = sorted(range(1, n), key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:expected]
    if len(idx) != expected:
        raise SystemExit(f"{len(idx)} objets trouvés, {expected} attendus")
    boxes = []
    for i in idx:
        x, y, w, h = stats[i, :4]
        # Boîte réelle (alpha d'origine) à l'intérieur de la composante fusionnée.
        sub = (lab[y : y + h, x : x + w] == i) & (a[y : y + h, x : x + w] > 0)
        ys, xs = np.nonzero(sub)
        boxes.append((x + xs.min(), y + ys.min(), x + xs.max() + 1, y + ys.max() + 1, i))
    # Ordre de lecture : regroupe en rangées par centre vertical.
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows: list[list] = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if rows and abs(cy - np.mean([(r[1] + r[3]) / 2 for r in rows[-1]])) < 0.25 * rgba.shape[0]:
            rows[-1].append(b)
        else:
            rows.append([b])
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[0])]
    return [(b[0], b[1], b[2], b[3]) for b in ordered], lab, [b[4] for b in ordered]


def decontaminate(rgba: np.ndarray) -> np.ndarray:
    """Couleur des bords semi-transparents tirée des pixels opaques voisins."""
    rgb, a = rgba[..., :3], rgba[..., 3]
    w = np.clip((a - 0.6) / 0.4, 0, 1) ** 2  # poids : pixels quasi opaques
    est = np.zeros_like(rgb)
    acc = np.zeros_like(a)
    for s in (1.5, 3.5):
        num = cv2.GaussianBlur(rgb * w[..., None], (0, 0), s)
        den = cv2.GaussianBlur(w, (0, 0), s)
        take = (acc < 1e-3) & (den > 1e-3)
        est[take] = num[take] / den[take, None]
        acc = np.maximum(acc, take.astype(np.float32))
    est[acc < 1e-3] = rgb[acc < 1e-3]
    # Mélange : bord très transparent → couleur estimée ; quasi opaque → couleur d'origine.
    t = np.clip((a - 0.25) / 0.6, 0, 1)[..., None]
    out = rgba.copy()
    out[..., :3] = est * (1 - t) + rgb * t
    return out


def bleed(rgba: np.ndarray) -> np.ndarray:
    """Propage les couleurs des bords sous l'alpha nul (évite les halos au filtrage)."""
    out = rgba.copy()
    a = rgba[..., 3]
    m = (a > 0.01).astype(np.float32)
    rgb = rgba[..., :3]
    num = rgb * m[..., None]
    den = m.copy()
    filled = m > 0
    for s in (1.5, 3, 6, 12, 24):
        nb = cv2.GaussianBlur(num, (0, 0), s)
        db = cv2.GaussianBlur(den, (0, 0), s)
        take = (~filled) & (db > 1e-4)
        out[..., :3][take] = nb[take] / db[take, None]
        filled |= take
    return out


def resize_premul(rgba: np.ndarray, w: int, h: int) -> np.ndarray:
    a = rgba[..., 3:4]
    pm = np.concatenate([rgba[..., :3] * a, a], axis=2)
    interp = cv2.INTER_AREA if w < rgba.shape[1] else cv2.INTER_CUBIC
    r = cv2.resize(pm, (w, h), interpolation=interp)
    r = np.clip(r, 0, 1)
    al = r[..., 3:4]
    rgb = np.where(al > 1e-4, r[..., :3] / np.maximum(al, 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 1), al], axis=2)


def clean_alpha(rgba: np.ndarray, floor: float = 0.03) -> np.ndarray:
    out = rgba.copy()
    a = out[..., 3]
    out[..., 3] = np.clip((a - floor) / (1 - floor), 0, 1)
    return out


# Esprits translucides / lumineux : leurs bords semi-transparents SONT la lueur.
NO_DECON = {"ember-wisp", "leaf-sprite", "seed-spirit"}


def export(rgba: np.ndarray, name: str, target_h: int, pad: int = 6) -> dict:
    h0, w0 = rgba.shape[:2]
    s = target_h / h0
    w, h = max(1, round(w0 * s)), target_h
    src = rgba if name in NO_DECON else decontaminate(rgba)
    r = resize_premul(src, w, h)
    r = clean_alpha(r)
    # Marge transparente (évite le bord dur au filtrage) puis propagation.
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 4), np.float32)
    canvas[pad : pad + h, pad : pad + w] = r
    canvas = bleed(canvas)
    u8 = np.clip(np.round(canvas * 255), 0, 255).astype(np.uint8)
    im = Image.fromarray(u8, "RGBA")
    path = OUTD / f"{name}.webp"
    im.save(path, "WEBP", quality=86, alpha_quality=90, method=6, exact=True)
    return {"file": f"sprites/{name}.webp", "w": im.width, "h": im.height, "bytes": path.stat().st_size}


def cut(sheet: str, names: list[str], target_h: int, merge_px: int = 24, uniform: bool = False, pad: int = 6) -> dict:
    rgba = load(sheet)
    boxes, lab, ids = components(rgba, len(names), merge_px)
    info = {}
    hmax = max(b[3] - b[1] for b in boxes)
    for (x0, y0, x1, y1), cid, name in zip(boxes, ids, names):
        crop = rgba[y0:y1, x0:x1].copy()
        # Ne garde que l'objet (les voisins qui débordent dans la boîte sont effacés).
        keep = cv2.dilate((lab[y0:y1, x0:x1] == cid).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        crop[~keep] = 0
        # Échelle commune à la planche (tailles relatives conservées) ou hauteur fixe.
        th = round(target_h * (y1 - y0) / hmax) if uniform else target_h
        info[name] = export(crop, name, th, pad=pad) | {"src_box": [int(x0), int(y0), int(x1), int(y1)]}
        print(f"{sheet} → {name}: {info[name]}")
    return info


def checker(w: int, h: int, c1=(38, 52, 44), c2=(64, 82, 70), s=16) -> Image.Image:
    yy, xx = np.mgrid[0:h, 0:w]
    m = ((xx // s + yy // s) % 2).astype(bool)
    arr = np.where(m[..., None], np.array(c2, np.uint8), np.array(c1, np.uint8))
    return Image.fromarray(arr.astype(np.uint8))


def contact(names: list[str], title: str, tile: int = 300) -> None:
    tiles = []
    for n in names:
        im = Image.open(OUTD / f"{n}.webp").convert("RGBA")
        s = min((tile - 20) / im.width, (tile - 20) / im.height, 1.0)
        im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        bg = checker(tile, tile).convert("RGBA")
        bg.alpha_composite(im2, ((tile - im2.width) // 2, (tile - im2.height) // 2))
        tiles.append(label(bg.convert("RGB"), f"{n} {im.width}x{im.height}"))
    grid(tiles, min(len(tiles), 5)).save(QA / f"05-{title}.jpg", quality=88)


def edge_zoom(name: str, bg=(240, 240, 240)) -> Image.Image:
    """Zoom ×3 d'un bord sur fond clair et sombre (contrôle des liserés)."""
    im = Image.open(OUTD / f"{name}.webp").convert("RGBA")
    w, h = im.size
    crop = im.crop((0, 0, min(w, 120), min(h, 120))) if False else im.crop((w // 4, 0, w // 4 + 110, 110))
    out = []
    for c in (bg, (12, 20, 16)):
        b = Image.new("RGBA", crop.size, c + (255,))
        b.alpha_composite(crop)
        out.append(b.convert("RGB").resize((330, 330), Image.NEAREST))
    return grid(out, 2)


def main() -> None:
    info: dict = {}
    info["kodama"] = cut("08-kodama-sheet", KODAMA, 256)
    info["creatures"] = cut("09-small-spirits-sheet", CREATURES, 256, merge_px=40)
    # Même échelle pour toutes les poses d'un personnage : la plus haute = 320 px.
    info["jiji"] = cut(JIJI_SHEET, [f"jiji-{p}" for p in POSES], 320, merge_px=30, uniform=True, pad=8)
    info["calcifer"] = cut(CALCIFER_SHEET, [f"calcifer-{p}" for p in POSES], 320, merge_px=40, uniform=True, pad=8)

    g = load("11-guardian-isolated")
    ys, xs = np.nonzero(g[..., 3] > 0.02)
    crop = g[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    info["guardian"] = export(crop, "guardian", 1024, pad=8)
    print("guardian", info["guardian"])
    write_json(info, WORK / "sprites.json")

    contact(KODAMA, "kodama")
    contact(CREATURES, "creatures")
    contact([f"jiji-{p}" for p in POSES] + [f"calcifer-{p}" for p in POSES], "companions")
    contact(["guardian"], "guardian", tile=700)
    grid([edge_zoom("guardian"), edge_zoom("kodama-1"), edge_zoom("jiji-idle"), edge_zoom("ember-wisp")], 1).save(
        QA / "05-edges.jpg", quality=90
    )


if __name__ == "__main__":
    main()
