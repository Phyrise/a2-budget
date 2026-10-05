"""LUT nuit par saison : maîtresse de saison (stade 6) → nuit de saison.

Même méthode et mêmes réglages que 04_luts.py (fonctions importées du script
de base) : images réduites 256×384 et floutées, régression trilinéaire
régularisée (laplacien + rappel vers un repli affine), Huber. La nuit de saison
est recalée sur 04-pause-night (s01), donc dans le cadrage de la maîtresse.

Contrôles (work/luts.json) : écart moyen à la cible sans LUT, avec la LUT de
saison et avec la LUT nuit de base (pour juger l'intérêt d'une LUT propre).

Sorties : ~/a2art/out/assets/seasons/<saison>/season-<saison>-lut-night.png,
          qa/s03-luts.jpg (maîtresse | LUT saison | cible | écart ×3 | LUT de
          base | LUT saison sur stade 1), qa/s03-lut-ramps.jpg.
"""
from __future__ import annotations

import importlib

import cv2
import numpy as np
from PIL import Image

from scommon import BASE, QA, SEASONS, WORK, WORLD_OUT, grid, label, load_aligned, to_u8, write_json

luts = importlib.import_module("04_luts")  # copie du script de base (remote.sh push)

BASE_NIGHT_LUT = BASE / "out" / "assets" / "luts" / "night.png"


def small(a: np.ndarray) -> np.ndarray:
    return cv2.GaussianBlur(cv2.resize(a, (256, 384), interpolation=cv2.INTER_AREA), (0, 0), 0.8)


def mid(a: np.ndarray) -> np.ndarray:
    return cv2.resize(a, (512, 768), interpolation=cv2.INTER_AREA)


def main() -> None:
    base_lut = luts.png_to_lut(np.asarray(Image.open(BASE_NIGHT_LUT).convert("RGB")))
    report, rows = {}, []
    ramps = [label(Image.fromarray(to_u8(luts.test_ramp())), "identité")]
    blur = lambda a: cv2.GaussianBlur(a, (0, 0), 2)  # noqa: E731
    for season in SEASONS:
        master = load_aligned(season, 6)
        night = load_aligned(season, "night")
        print(season, "nuit", flush=True)
        lut, _ = luts.fit(small(master), small(night))
        png = luts.lut_to_png(lut)
        out = WORLD_OUT / season / f"season-{season}-lut-night.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(png).save(out, optimize=True)
        q = luts.png_to_lut(png)
        src_m, tgt_m = mid(master), mid(night)
        res = luts.apply_lut(src_m, q)
        res_base = luts.apply_lut(src_m, base_lut)
        cube = q.reshape(luts.N, luts.N, luts.N, 3)
        report[season] = {
            "mae_identity": round(float(np.abs(blur(src_m) - blur(tgt_m)).mean()), 4),
            "mae_lut": round(float(np.abs(blur(res) - blur(tgt_m)).mean()), 4),
            "mae_base_night_lut": round(float(np.abs(blur(res_base) - blur(tgt_m)).mean()), 4),
            "max_node_step": round(max(float(np.abs(np.diff(cube, axis=a)).max()) for a in range(3)), 4),
            "bytes": out.stat().st_size,
        }
        print("   ", report[season], flush=True)
        s1 = luts.apply_lut(mid(load_aligned(season, 1)), q)
        tiles = [
            (src_m, f"{season} maîtresse"),
            (res, "LUT nuit saison"),
            (tgt_m, "cible nuit"),
            (np.clip(np.abs(res - tgt_m) * 3, 0, 1), "écart x3"),
            (res_base, "LUT nuit de base"),
            (s1, "LUT saison sur stade 1"),
        ]
        rows.append(grid([label(Image.fromarray(to_u8(cv2.resize(a, (200, 300)))), t) for a, t in tiles], 6))
        ramps.append(label(Image.fromarray(to_u8(luts.apply_lut(luts.test_ramp(), q))), season))
    grid(rows, 1).save(QA / "s03-luts.jpg", quality=84)
    grid(ramps, 2).save(QA / "s03-lut-ramps.jpg", quality=84)
    write_json(report, WORK / "luts.json")


if __name__ == "__main__":
    main()
