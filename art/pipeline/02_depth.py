"""Cartes de profondeur par stade (Depth Anything V2 Large, CPU).

Chaîne :
  1. inférence à deux résolutions (518 px : structure globale, 1022 px :
     détails) puis fusion — basses fréquences de la passe 518, hautes
     fréquences de la passe fine ;
  2. normalisation robuste (percentiles) du stade 6, puis chaque autre stade
     est ramené dans la même échelle par régression linéaire sur la zone
     stable (hors cèdre) → profondeur cohérente pendant les fondus de stade ;
  3. filtre guidé (bords alignés sur la peinture, sans copier la texture) ;
  4. réduction 512×768, légère dilatation des zones proches (évite les halos
     de parallaxe au bord des objets proches), adoucissement.

Sorties : out/work/depth/raw-<stade>.npy (1024×1536 float, 0 loin → 1 près),
          out/work/depth/stage-<n>.png (512×768, 8 bits, blanc = près),
          planches out/qa/02-*.
"""
from __future__ import annotations

import os
import time

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import AutoModelForDepthEstimation

from common import MASTER_STAGE, MH, MW, QA, STAGE_SOURCES, WORK, H, W, grid, label, load_aligned

MODEL = os.environ.get("A2_DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Large-hf")
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)

torch.set_num_threads(16)


def infer(model, rgb: np.ndarray, short: int) -> np.ndarray:
    h0, w0 = rgb.shape[:2]
    s = short / min(h0, w0)
    h = int(round(h0 * s / 14)) * 14
    w = int(round(w0 * s / 14)) * 14
    x = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    x = (x - MEAN) / STD
    t = torch.from_numpy(x.transpose(2, 0, 1)).unsqueeze(0)
    with torch.inference_mode():
        out = model(pixel_values=t).predicted_depth[0].numpy()
    return cv2.resize(out, (w0, h0), interpolation=cv2.INTER_CUBIC)


def robust01(d: np.ndarray, lo=1.0, hi=99.5) -> np.ndarray:
    a, b = np.percentile(d, [lo, hi])
    return np.clip((d - a) / (b - a + 1e-8), 0, 1)


def fuse(coarse: np.ndarray, fine: np.ndarray, sigma: float = 12.0) -> np.ndarray:
    """Basses fréquences de `coarse` + hautes fréquences de `fine` (même échelle)."""
    c = robust01(coarse)
    f = robust01(fine)
    # Ramène la passe fine dans l'échelle de la passe grossière (régression).
    A = np.stack([f.ravel(), np.ones(f.size)], 1)
    k, b = np.linalg.lstsq(A, c.ravel(), rcond=None)[0]
    f = f * k + b
    low_c = cv2.GaussianBlur(c, (0, 0), sigma)
    low_f = cv2.GaussianBlur(f, (0, 0), sigma)
    return low_c + 0.8 * (f - low_f)


def box(a: np.ndarray, r: int) -> np.ndarray:
    return cv2.boxFilter(a, -1, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)


def guided(I: np.ndarray, p: np.ndarray, r: int, eps: float) -> np.ndarray:
    mI, mp = box(I, r), box(p, r)
    cov = box(I * p, r) - mI * mp
    var = box(I * I, r) - mI * mI
    a = cov / (var + eps)
    b = mp - a * mI
    return box(a, r) * I + box(b, r)


def stable_mask(rgb: np.ndarray, ref: np.ndarray) -> np.ndarray:
    """Zone qui ne change pas entre ce stade et le stade 6 (pour l'étalonnage)."""
    a = cv2.GaussianBlur(rgb, (0, 0), 6)
    b = cv2.GaussianBlur(ref, (0, 0), 6)
    # Écart de structure (luminance centrée localement), insensible à la lumière globale.
    la = a.mean(2) - cv2.GaussianBlur(a.mean(2), (0, 0), 40)
    lb = b.mean(2) - cv2.GaussianBlur(b.mean(2), (0, 0), 40)
    diff = np.abs(la - lb)
    m = diff < np.percentile(diff, 55)
    return cv2.erode(m.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)


def finish(d: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """Post-traitement → carte 512×768 float 0..1."""
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    g = guided(lum, d.astype(np.float32), r=6, eps=4e-3)
    g = np.clip(g, 0, 1)
    small = cv2.resize(g, (MW, MH), interpolation=cv2.INTER_AREA)
    # Dilatation douce des zones proches : max local sur un disque de rayon 2.
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dil = cv2.dilate(small, k)
    # On ne dilate que là où il y a une marche de profondeur (pas d'empâtement global).
    step = np.clip((dil - small) * 12.0, 0, 1)
    out = small * (1 - step) + dil * step
    out = cv2.GaussianBlur(out, (0, 0), 0.8)
    return np.clip(out, 0, 1)


def parallax_preview(rgb: np.ndarray, d: np.ndarray, amount: float) -> np.ndarray:
    """Vue décalée (rétro-projection simple) pour juger les halos."""
    h, w = d.shape
    small = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA)
    xs, ys = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    mapx = xs - amount * (d - 0.5)
    mapy = ys - amount * 0.35 * (d - 0.5)
    return cv2.remap(small, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def main() -> None:
    t0 = time.time()
    model = AutoModelForDepthEstimation.from_pretrained(MODEL).eval()
    print("model", MODEL, f"{time.time() - t0:.1f}s")
    (WORK / "depth").mkdir(parents=True, exist_ok=True)

    order = [MASTER_STAGE] + [s for s in STAGE_SOURCES if s != MASTER_STAGE]
    ref_rgb = load_aligned(STAGE_SOURCES[MASTER_STAGE])
    ref_d = None
    finals = {}
    for s in order:
        name = STAGE_SOURCES[s]
        rgb = load_aligned(name)
        t1 = time.time()
        coarse = infer(model, rgb, 518)
        fine = infer(model, rgb, 1022)
        d = fuse(coarse, fine)
        print(f"stage {s} ({name}) inference {time.time() - t1:.1f}s")
        if ref_d is None:
            d = robust01(d, 0.5, 99.7)
            ref_d = d
        else:
            m = stable_mask(rgb, ref_rgb)
            A = np.stack([d[m], np.ones(m.sum())], 1)
            k, b = np.linalg.lstsq(A, ref_d[m], rcond=None)[0]
            d = np.clip(d * k + b, 0, 1)
            err = float(np.median(np.abs(d[m] - ref_d[m])))
            print(f"  calage sur stade 6 : k={k:.3f} b={b:.3f} écart médian={err:.4f} ({m.mean() * 100:.0f} % de pixels)")
        np.save(WORK / "depth" / f"raw-{s}.npy", d.astype(np.float32))
        fin = finish(d, rgb)
        finals[s] = fin
        # 8 bits dans work/ ; 07_scene.py choisit le format livré (PNG ou WebP sans perte).
        Image.fromarray(np.round(fin * 255).astype(np.uint8), "L").save(
            WORK / "depth" / f"stage-{s}.png", optimize=True
        )

    # Planches de contrôle.
    tiles = []
    for s in sorted(finals):
        tiles.append(label(Image.fromarray(np.round(finals[s] * 255).astype(np.uint8)).resize((256, 384)), f"depth {s}"))
    grid(tiles, 7).save(QA / "02-depth-stages.jpg", quality=88)

    rgb6 = load_aligned(STAGE_SOURCES[6])
    d6 = finals[6]
    side = [
        label(Image.fromarray((cv2.resize(rgb6, (MW, MH), interpolation=cv2.INTER_AREA) * 255).astype(np.uint8)), "stage 6"),
        label(Image.fromarray(np.round(d6 * 255).astype(np.uint8)), "depth 6"),
        label(Image.fromarray((parallax_preview(rgb6, d6, 28) * 255).astype(np.uint8)), "parallax +28px"),
        label(Image.fromarray((parallax_preview(rgb6, d6, -28) * 255).astype(np.uint8)), "parallax -28px"),
    ]
    grid(side, 4).save(QA / "02-depth-stage6.jpg", quality=90)
    print(f"total {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
