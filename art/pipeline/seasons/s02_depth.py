"""Profondeur des stades de saison et décision de réutiliser celle de la base.

Pour chaque saison et chaque stade 1..7, sur la peinture recalée (s01) :
  1. Depth Anything V2 Large, mêmes passes et fusion que 02_depth.py (518 +
     1022 px), importées telles quelles du script de base ;
  2. calage linéaire sur la profondeur brute du stade de base correspondant
     (raw-<n>.npy, déjà dans l'échelle du stade 6) sur la zone stable
     (stable_mask de 02_depth.py) → même échelle que la base ;
  3. même post-traitement (finish : filtre guidé, 512×768, dilatation douce).
Comparaison avec la carte de base livrée (work/depth/stage-<n>.png de base) :
  depth_mae     = écart absolu moyen (0..1) ;
  depth_changed = part des pixels dont la profondeur bouge de plus de 0,12
                  (silhouette ajoutée ou supprimée : congère, tronc enneigé…).
La décision (réutiliser ou non) est prise par s04_export.py avec la dérive de s01.

Sorties : work/depth/<saison>-stage-<n>.png (512×768, 8 bits, blanc = près),
          work/depth.json, qa/s02-depth-<saison>.jpg (base | saison | écart ×4),
          qa/s02-parallax.jpg (couleur de saison + profondeur de base, ±28 px).
"""
from __future__ import annotations

import importlib
import os
import time

import cv2
import numpy as np
import torch
from PIL import Image

from scommon import BASE_DEPTH, QA, SEASONS, WORK, grid, label, load_aligned, load_base, to_u8, write_json

base = importlib.import_module("02_depth")  # copie du script de base (remote.sh push)
from transformers import AutoModelForDepthEstimation  # noqa: E402

torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "16")))
CHANGE = 0.12


def base_final(n: int) -> np.ndarray:
    return np.asarray(Image.open(BASE_DEPTH / f"stage-{n}.png").convert("L"), dtype=np.float32) / 255.0


def main() -> None:
    t0 = time.time()
    model = AutoModelForDepthEstimation.from_pretrained(base.MODEL).eval()
    (WORK / "depth").mkdir(parents=True, exist_ok=True)
    only = os.environ.get("A2S_ONLY", "")
    report: dict = {}
    if (WORK / "depth.json").exists() and only:
        import json

        report = json.loads((WORK / "depth.json").read_text())
    sheets: dict[str, list] = {s: [] for s in SEASONS}
    parallax = []
    for season in SEASONS:
        if only and season not in only.split(","):
            continue
        for n in range(1, 8):
            name = f"{season}-stage-{n}"
            rgb = load_aligned(season, n)
            ref_rgb = load_base(n)
            t1 = time.time()
            d = base.fuse(base.infer(model, rgb, 518), base.infer(model, rgb, 1022))
            ref_raw = np.load(BASE_DEPTH / f"raw-{n}.npy")
            m = base.stable_mask(rgb, ref_rgb)
            A = np.stack([d[m], np.ones(m.sum())], 1)
            k, b = np.linalg.lstsq(A, ref_raw[m], rcond=None)[0]
            d = np.clip(d * k + b, 0, 1)
            np.save(WORK / "depth" / f"raw-{name}.npy", d.astype(np.float32))
            fin = base.finish(d, rgb)
            Image.fromarray(to_u8(fin), "L").save(WORK / "depth" / f"{name}.png", optimize=True)
            ref_fin = base_final(n)
            diff = np.abs(fin - ref_fin)
            report[name] = {
                "k": round(float(k), 4),
                "b": round(float(b), 4),
                "stable_frac": round(float(m.mean()), 3),
                "depth_mae": round(float(diff.mean()), 4),
                "depth_p95": round(float(np.percentile(diff, 95)), 4),
                "depth_changed": round(float((diff > CHANGE).mean()), 4),
            }
            print(name, f"{time.time() - t1:.0f}s", report[name], flush=True)
            sheets[season] += [
                label(Image.fromarray(to_u8(ref_fin)).resize((160, 240)), f"base {n}"),
                label(Image.fromarray(to_u8(fin)).resize((160, 240)), f"{season} {n}"),
                label(Image.fromarray(to_u8(np.clip(diff * 4, 0, 1))).resize((160, 240)),
                      f"x4 {report[name]['depth_changed'] * 100:.1f}%"),
            ]
            if n == 6:
                for amt in (28, -28):
                    pv = base.parallax_preview(rgb, ref_fin, amt)
                    parallax.append(label(Image.fromarray(to_u8(pv)).resize((256, 384)), f"{season} base-depth {amt:+d}"))
                    pv = base.parallax_preview(rgb, fin, amt)
                    parallax.append(label(Image.fromarray(to_u8(pv)).resize((256, 384)), f"{season} own-depth {amt:+d}"))
        # 3 rangées (base, saison, écart ×4) × 7 stades.
        tiles = sheets[season]
        if tiles:
            grid(tiles[0::3] + tiles[1::3] + tiles[2::3], 7).save(QA / f"s02-depth-{season}.jpg", quality=84)
        write_json(report, WORK / "depth.json")
    if parallax:
        grid(parallax, 4).save(QA / "s02-parallax.jpg", quality=84)
    print(f"total {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
