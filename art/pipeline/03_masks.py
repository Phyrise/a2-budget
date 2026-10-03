"""Masques de scène RGBA 512×768 (cadrage portrait commun à tous les stades).

  R = eau du ruisseau (écoulement)      ← SAM 3 « water », « stream », « waterfall »
                                          affiné par la couleur (pas la mousse des berges)
  G = feuillage / fougères (vent)       ← SAM 3 « leaves », « fern », « plants », « foliage »
                                          + texture verte fine, moins tout ce qui est rigide
                                          (« rock », « mossy boulder », « moss », « tree trunk »,
                                          « fallen log », « tree root »)
  B = zone du cèdre central             ← union des régions qui changent entre les stades
                                          (écart de couleur et de structure avec le stade 6),
                                          comblée, lissée, prolongée jusqu'aux racines
  A = trouées de lumière / ciel         ← clair, désaturé, lointain (profondeur), haut de
                                          l'image (SAM 3 ne détecte pas de « sky » ici)

Bords doux (flou gaussien + courbe douce). Entrées : out/work/aligned,
out/work/depth/stage-6.png, out/work/sam3 (sam3_segment.py).
Sorties : out/assets/masks.png, planches out/qa/03-*.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from common import ASSETS, MH, MW, QA, STAGE_SOURCES, WORK, grid, label, load_aligned

SAM = WORK / "sam3" / STAGE_SOURCES[6]


def sam(concept: str) -> np.ndarray:
    p = SAM / f"{concept.replace(' ', '_')}.png"
    if not p.exists():
        print("  (absent)", concept)
        return np.zeros((MH, MW), np.float32)
    return np.asarray(Image.open(p).convert("L").resize((MW, MH), Image.BILINEAR), dtype=np.float32) / 255.0


def small(a: np.ndarray) -> np.ndarray:
    return cv2.resize(a, (MW, MH), interpolation=cv2.INTER_AREA)


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def soften(m: np.ndarray, sigma: float) -> np.ndarray:
    return np.clip(cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma), 0, 1)


def depth6() -> np.ndarray:
    p = WORK / "depth" / "stage-6.png"  # écrit par 02_depth.py
    return np.asarray(Image.open(p).convert("L"), dtype=np.float32) / 255.0


def water_mask(rgb: np.ndarray, hsv: np.ndarray, yy: np.ndarray) -> np.ndarray:
    p = np.maximum.reduce([sam("water"), sam("stream"), sam("waterfall")])
    # La mousse des berges (vert saturé) n'est pas de l'eau.
    sat, hue = hsv[..., 1], hsv[..., 0]
    green = smoothstep(0.25, 0.45, sat) * ((hue > 30) & (hue < 95)).astype(np.float32)
    p = p * (1 - 0.8 * green)
    p = p * smoothstep(0.45, 0.55, yy)  # le ruisseau est dans la moitié basse
    p = smoothstep(0.25, 0.7, soften(p, 1.2))
    return soften(p, 1.5)


def rigid_mask() -> np.ndarray:
    return np.maximum.reduce(
        [sam("rock"), sam("mossy boulder"), sam("moss"), sam("tree trunk"), sam("fallen log"), sam("tree root")]
    )


def foliage_mask(rgb: np.ndarray, hsv: np.ndarray, rigid: np.ndarray, water: np.ndarray) -> np.ndarray:
    leaves, fern, plants, foliage = sam("leaves"), sam("fern"), sam("plants"), sam("foliage")
    strong = np.maximum(leaves, fern)
    soft = np.maximum(0.8 * plants, 0.6 * foliage)
    # Texture fine et verte (fougères, feuilles) : énergie haute fréquence locale.
    lum = rgb.mean(2)
    hf = np.abs(lum - cv2.GaussianBlur(lum, (0, 0), 1.5))
    energy = cv2.GaussianBlur(hf, (0, 0), 3)
    energy = energy / (np.percentile(energy, 98) + 1e-6)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    green = smoothstep(0.18, 0.35, sat) * smoothstep(28, 38, hue) * (1 - smoothstep(95, 105, hue)) * smoothstep(0.08, 0.18, val)
    tex = np.clip(energy, 0, 1) * green
    # Ce qui est rigide n'ondule pas — sauf si SAM y voit nettement des feuilles/fougères
    # (touffes posées sur le tronc du cèdre ou sur les rochers).
    keep = 1 - rigid * (1 - smoothstep(0.35, 0.7, strong))
    g = np.maximum.reduce([strong, soft * (1 - rigid), 0.85 * smoothstep(0.25, 0.6, tex) * (1 - rigid)]) * keep
    g = g * (1 - water)
    g = smoothstep(0.2, 0.75, soften(g, 1.0))
    return soften(g, 1.2)


def cedar_mask(stage_imgs: dict[int, np.ndarray]) -> tuple[np.ndarray, dict[int, np.ndarray]]:
    ref = stage_imgs[6]
    lab_ref = cv2.cvtColor(ref, cv2.COLOR_RGB2LAB)
    diffs = {}
    for s, im in stage_imgs.items():
        if s == 6:
            continue
        lab = cv2.cvtColor(im, cv2.COLOR_RGB2LAB)
        a = cv2.GaussianBlur(lab, (0, 0), 3)
        b = cv2.GaussianBlur(lab_ref, (0, 0), 3)
        dc = np.linalg.norm(a - b, axis=2) / 100.0  # ΔE/100
        # Structure : écart des gradients de luminance (insensible à un léger voile).
        ga = cv2.GaussianBlur(np.abs(cv2.Laplacian(lab[..., 0], cv2.CV_32F, ksize=3)), (0, 0), 3)
        gb = cv2.GaussianBlur(np.abs(cv2.Laplacian(lab_ref[..., 0], cv2.CV_32F, ksize=3)), (0, 0), 3)
        ds = np.abs(ga - gb) / (np.percentile(gb, 95) + 1e-6)
        d = cv2.GaussianBlur(np.maximum(dc * 4.0, ds * 0.6), (0, 0), 4)
        diffs[s] = d
    u = np.maximum.reduce(list(diffs.values()))
    # Seuil adaptatif (bruit de régénération partout, changement massif sur le cèdre).
    lo, hi = np.percentile(u, 60), np.percentile(u, 90)
    m = smoothstep(lo + 0.35 * (hi - lo), lo + 0.9 * (hi - lo), u)
    binm = (m > 0.5).astype(np.uint8)
    binm = cv2.morphologyEx(binm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    # Garde les composantes qui touchent la colonne centrale (le cèdre), pas les
    # petites variations éparses du décor.
    n, lab_, stats, _ = cv2.connectedComponentsWithStats(binm, 8)
    keep = np.zeros_like(binm)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        cx0, cx1 = x, x + w
        if area > 0.01 * MW * MH and cx1 > 0.3 * MW and cx0 < 0.75 * MW:
            keep[lab_ == i] = 1
    keep = ndi.binary_fill_holes(keep).astype(np.uint8)
    keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    b = soften(keep.astype(np.float32), 8)
    b = np.maximum(b * smoothstep(0.1, 0.5, b), 0)
    return np.clip(b / max(b.max(), 1e-6), 0, 1), diffs


def light_mask(rgb: np.ndarray, hsv: np.ndarray, depth: np.ndarray, yy: np.ndarray) -> np.ndarray:
    """Trouées claires de la canopée : brume lumineuse entre les troncs du fond.

    Clair (seuils choisis sur la distribution de luminance du haut de l'image),
    plus clair que son voisinage, peu saturé, lointain, dans la moitié haute.
    Les petites taches claires isolées plus bas (papiers de la corde sacrée,
    reflets) sont retirées par analyse en composantes connexes.
    """
    lum = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    loc = lum - cv2.GaussianBlur(lum, (0, 0), 25)  # plus clair que le voisinage
    bright = smoothstep(0.40, 0.60, lum) * smoothstep(-0.03, 0.05, loc)
    desat = 1 - smoothstep(0.2, 0.4, hsv[..., 1])
    far = 1 - smoothstep(0.10, 0.30, depth)
    top = 1 - smoothstep(0.40, 0.55, yy)
    a = bright * desat * far * top
    a = smoothstep(0.1, 0.5, soften(a, 1.2))
    n, lab, stats, cent = cv2.connectedComponentsWithStats((a > 0.3).astype(np.uint8), 8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 80 and cent[i, 1] > 0.3 * MH:
            a[lab == i] = 0
    return soften(a, 1.2)


def overlay(rgb: np.ndarray, m: np.ndarray, color, name: str) -> Image.Image:
    base = rgb * 0.55
    c = np.array(color, np.float32)[None, None, :] / 255.0
    out = base * (1 - m[..., None] * 0.75) + c * m[..., None] * 0.75 + rgb * 0.0
    return label(Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8)), name)


def main() -> None:
    stage_imgs = {s: small(load_aligned(n)) for s, n in STAGE_SOURCES.items()}
    rgb = stage_imgs[6]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)  # H 0..360 en float32
    hsv[..., 0] = hsv[..., 0] / 2.0  # → échelle 0..180 (convention OpenCV 8 bits)
    yy = np.repeat(np.linspace(0, 1, MH, dtype=np.float32)[:, None], MW, 1)
    depth = depth6()

    r = water_mask(rgb, hsv, yy)
    rigid = rigid_mask()
    g = foliage_mask(rgb, hsv, rigid, r)
    b, diffs = cedar_mask(stage_imgs)
    a = light_mask(rgb, hsv, depth, yy)

    rgba = np.stack([r, g, b, a], 2)
    u8 = np.clip(np.round(rgba * 255), 0, 255).astype(np.uint8)
    # Deux fichiers OPAQUES : un PNG RGBA dont l'alpha est presque partout nul
    # perd ses canaux RGB sur WebKit (décodage prémultiplié). Le moteur
    # recompose RGBA à partir de masks.png (RGB) et masks-light.png (A).
    Image.fromarray(u8[..., :3], "RGB").save(ASSETS / "masks.png", optimize=True)
    Image.fromarray(u8[..., 3], "L").save(ASSETS / "masks-light.png", optimize=True)
    print("masks.png", (ASSETS / "masks.png").stat().st_size, "octets ; couverture R G B A :",
          [round(float((c > 0.5).mean()) * 100, 1) for c in (r, g, b, a)])

    tiles = [
        label(Image.fromarray((rgb * 255).astype(np.uint8)), "stade 6"),
        overlay(rgb, r, (40, 140, 255), "R eau"),
        overlay(rgb, g, (90, 255, 60), "G feuillage"),
        overlay(rgb, b, (255, 60, 220), "B cèdre"),
        overlay(rgb, a, (255, 230, 80), "A trouées"),
    ]
    grid(tiles, 5).save(QA / "03-masks.jpg", quality=82)
    # Vue 2×2 réduite (contrôle visuel rapide, canaux séparés AVANT réduction :
    # PIL prémultiplie l'alpha en redimensionnant du RGBA).
    grid([t.resize((450, 675), Image.LANCZOS) for t in tiles[1:]], 2).save(QA / "03-masks-2x2.jpg", quality=78)
    # B sur chaque stade (la zone doit couvrir tous les cèdres).
    tiles = [overlay(stage_imgs[s], b, (255, 60, 220), f"B / stade {s}") for s in sorted(stage_imgs)]
    tiles = [t.resize((256, 384), Image.LANCZOS) for t in tiles]
    grid(tiles, 7).save(QA / "03-masks-cedar.jpg", quality=80)
    # Écarts bruts par stade.
    tiles = [label(Image.fromarray(np.clip(diffs[s] / np.percentile(diffs[s], 99.5) * 255, 0, 255).astype(np.uint8)).resize((256, 384)), f"écart {s}/6") for s in sorted(diffs)]
    grid(tiles, 6).save(QA / "03-masks-diffs.jpg", quality=80)


if __name__ == "__main__":
    main()
