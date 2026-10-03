"""Effets peints (planche 14-effects-sheet, RGB sur fond noir, sans alpha).

Disposition de la planche (rangées de haut en bas) :
  1. 3 nappes de brume        → fog
  2. 3 rayons obliques        → rays
  3. 6 gouttes / filets d'eau → drips
  4. 4 aiguilles de cèdre     → needles
  5. 6 spores lumineuses      → motes
  6. 2 halos de kodama        → halos

Chaîne :
  1. plancher de bruit du noir estimé par canal sur le fond (p95 des pixels de
     fond) puis soustrait avec un genou doux (raccord C¹ : x²/4f sous 2f) — le
     noir revient à 0 sans écraser les dégradés ;
  2. découpe : rangées puis colonnes par les creux des projections de la
     luminance (seuil bas, dilatée : les franges douces et les gouttelettes
     détachées restent avec leur élément) ; seules les composantes qui
     appartiennent majoritairement à la case sont gardées ;
  3. rognage + marge, bords fondus vers le noir pur (échantillonnage
     CLAMP_TO_EDGE sans liseré) ;
  4. export WebP RGBA : RGB = couleur sur noir (mélange additif : ONE, ONE),
     A = luminance normalisée (max RGB / pic de l'élément) → le même fichier
     sert en alpha prémultiplié (ONE, ONE_MINUS_SRC_ALPHA) car RGB ≤ A.
     À charger sans prémultiplication (createImageBitmap premultiplyAlpha:'none').

Sorties : out/assets/fx/<groupe>-<n>.webp, out/work/fx.json, planches out/qa/06-*.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from common import ASSETS, QA, SRC, WORK, bands, cuts_from_bands, grid, label, write_json

OUTD = ASSETS / "fx"
OUTD.mkdir(parents=True, exist_ok=True)
SHEET = "14-effects-sheet"
ROWS = [("fog", 3), ("rays", 3), ("drips", 6), ("needles", 4), ("motes", 6), ("halos", 2)]


def soft_floor(x: np.ndarray, f: np.ndarray) -> np.ndarray:
    """x − f au-dessus de 2f, x²/4f en dessous (continu et dérivable)."""
    f = np.maximum(f, 1e-4)
    return np.where(x >= 2 * f, x - f, x * x / (4 * f))


def main() -> None:
    rgb = np.asarray(Image.open(SRC / f"{SHEET}.png").convert("RGB"), dtype=np.float32) / 255.0
    H, W = rgb.shape[:2]
    lum = rgb.max(2)
    blur = cv2.GaussianBlur(lum, (0, 0), 6)
    bg = blur < np.percentile(blur, 35)
    floor = np.array([np.percentile(rgb[..., c][bg], 95) for c in range(3)], np.float32)
    print("plancher de bruit (0..255) :", np.round(floor * 255, 1))
    clean = soft_floor(rgb, floor[None, None, :]) / (1 - floor[None, None, :])
    clean = np.clip(clean, 0, 1)
    lc = clean.max(2)

    # Masque de présence : seuil bas sur la luminance nettoyée, dilaté (franges
    # douces et gouttelettes détachées gardées avec leur élément).
    thr = 4 / 255
    mask = (cv2.GaussianBlur(lc, (0, 0), 1.5) > thr).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask_d = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    mask_t = (cv2.GaussianBlur(lc, (0, 0), 1.5) > 10 / 255).astype(np.uint8)
    mask_t = cv2.morphologyEx(mask_t, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask_t = cv2.dilate(mask_t, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    # Coupes : profils du masque NON dilaté à un seuil un peu plus haut (les
    # rangées « rayons » et « gouttes » se touchent presque ; la dilatation
    # les fusionnerait).
    cut_mask = (lc > 12 / 255).astype(np.uint8)
    ycuts = cuts_from_bands(bands(cut_mask.sum(1), len(ROWS)), H)
    print("coupes de rangées :", ycuts)

    report: dict = {}
    tiles = []
    for (group, count), y0, y1 in zip(ROWS, ycuts[:-1], ycuts[1:]):
        xcuts = cuts_from_bands(bands(cut_mask[y0:y1].sum(0), count, margin=40), W)
        print(f"  {group}: coupes {xcuts}")
        report[group] = []
        for k, (x0, x1) in enumerate(zip(xcuts[:-1], xcuts[1:])):
            # L'élément = le masque dilaté restreint à sa case ; la boîte est
            # prise sur un masque un peu plus strict (le voile quasi noir
            # n'agrandit pas la texture inutilement).
            keep = np.zeros_like(mask_d)
            keep[y0:y1, x0:x1] = mask_d[y0:y1, x0:x1]
            tight = np.zeros_like(mask_d)
            tight[y0:y1, x0:x1] = mask_t[y0:y1, x0:x1]
            ys, xs = np.nonzero(tight)
            if len(ys) == 0:
                raise SystemExit(f"{group} {k}: case vide")
            pad = 12
            by0, by1 = max(y0, ys.min() - pad), min(y1, ys.max() + 1 + pad)
            bx0, bx1 = max(x0, xs.min() - pad), min(x1, xs.max() + 1 + pad)
            soft = cv2.GaussianBlur(cv2.dilate(keep, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 3)
            crop = clean[by0:by1, bx0:bx1] * np.clip(soft[by0:by1, bx0:bx1] * 1.5, 0, 1)[..., None]
            # Bords fondus vers le noir (12 px : une coupe dans une frange de
            # brume ne laisse pas d'arête droite).
            h, w = crop.shape[:2]
            ry = np.clip(np.minimum(np.arange(h), np.arange(h)[::-1]) / 12.0, 0, 1)
            rx = np.clip(np.minimum(np.arange(w), np.arange(w)[::-1]) / 12.0, 0, 1)
            ry, rx = ry * ry * (3 - 2 * ry), rx * rx * (3 - 2 * rx)
            crop = crop * (ry[:, None] * rx[None, :])[..., None]
            m = crop.max(2)
            peak = max(float(np.percentile(m[m > thr], 99.8)) if (m > thr).any() else 1.0, 0.25)
            alpha = np.clip(m / peak, 0, 1)
            rgba = np.concatenate([crop, alpha[..., None]], 2)
            u8 = np.clip(np.round(rgba * 255), 0, 255).astype(np.uint8)
            name = f"{group}-{k + 1}"
            path = OUTD / f"{name}.webp"
            Image.fromarray(u8, "RGBA").save(path, "WEBP", quality=90, alpha_quality=90, method=6, exact=True)
            # Contrôle : niveau de noir après compression (bord de 3 px).
            back = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
            border = np.concatenate([back[:1].reshape(-1, 4), back[-1:].reshape(-1, 4), back[:, :1].reshape(-1, 4), back[:, -1:].reshape(-1, 4)])
            info = {
                "file": f"fx/{name}.webp",
                "w": w,
                "h": h,
                "bytes": path.stat().st_size,
                "src_box": [int(bx0), int(by0), int(bx1), int(by1)],
                "peak": round(peak, 3),
                "border_max_rgb": float(border[:, :3].max()),
            }
            report[group].append(info)
            print(name, info)
            vis = Image.fromarray(np.clip(np.round(crop * 255), 0, 255).astype(np.uint8))
            s = min(250 / vis.width, 160 / vis.height, 1.0)
            vis = vis.resize((max(1, round(vis.width * s)), max(1, round(vis.height * s))), Image.LANCZOS)
            tile = Image.new("RGB", (256, 176), (0, 0, 0))
            tile.paste(vis, ((256 - vis.width) // 2, 8 + (160 - vis.height) // 2))
            tiles.append(label(tile, f"{name} {w}x{h}"))
    write_json(report, WORK / "fx.json")
    grid(tiles, 6, bg=(40, 40, 40)).save(QA / "06-fx.jpg", quality=88)

    # Découpe superposée à la planche (boîtes) + rendu additif sur une scène.
    vis = Image.fromarray(np.clip(np.round(np.clip(clean * 2.2, 0, 1) * 255), 0, 255).astype(np.uint8))
    from PIL import ImageDraw

    d = ImageDraw.Draw(vis)
    for y in ycuts:
        d.line([(0, y), (W, y)], fill=(255, 0, 0), width=1)
    for group, items in report.items():
        for it in items:
            d.rectangle(it["src_box"], outline=(0, 255, 120), width=2)
    vis.resize((W // 2, H // 2), Image.LANCZOS).save(QA / "06-fx-cuts.jpg", quality=85)


if __name__ == "__main__":
    main()
