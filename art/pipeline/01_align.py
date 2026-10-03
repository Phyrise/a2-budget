"""Recalage de toutes les variantes portrait sur la peinture maîtresse (stade 6).

Les images générées dérivent légèrement (décalage, zoom, rotation). On estime une
similitude (translation + échelle + rotation) par appariement SIFT + RANSAC, ce
qui ignore naturellement les zones qui diffèrent (le cèdre selon le stade, la
lumière selon l'humeur). Si la dérive est inférieure à ~0,75 px partout, l'image
est conservée telle quelle (pas de rééchantillonnage inutile).

Sorties : out/work/aligned/<nom>.png, out/work/align.json, planches out/qa/01-*.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from common import LUT_TARGETS, QA, SRC, STAGE_SOURCES, WORK, H, W, grid, label, write_json

MASTER = STAGE_SOURCES[6]
TARGETS = [n for s, n in STAGE_SOURCES.items() if s != 6] + list(LUT_TARGETS.values()) + [
    "06-clean-plate",
    "10-guardian-scene",
]


def gray(name: str) -> np.ndarray:
    im = cv2.imread(str(SRC / f"{name}.png"), cv2.IMREAD_COLOR)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    # Égalisation locale : rend l'appariement robuste aux changements de lumière.
    return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(g)


def estimate(ref: np.ndarray, mov: np.ndarray):
    sift = cv2.SIFT_create(nfeatures=12000, contrastThreshold=0.02)
    k1, d1 = sift.detectAndCompute(ref, None)
    k2, d2 = sift.detectAndCompute(mov, None)
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    raw = matcher.knnMatch(d2, d1, k=2)
    good = [m for m, n in raw if m.distance < 0.72 * n.distance]
    src = np.float32([k2[m.queryIdx].pt for m in good])
    dst = np.float32([k1[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(
        src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=20000, confidence=0.999
    )
    inl = inl.ravel().astype(bool)
    # Raffinement moindres carrés sur les inliers.
    M2, _ = cv2.estimateAffinePartial2D(src[inl], dst[inl], method=cv2.LMEDS)
    if M2 is not None:
        M = M2
    proj = (src[inl] @ M[:, :2].T) + M[:, 2]
    resid = np.linalg.norm(proj - dst[inl], axis=1)
    return M, int(inl.sum()), len(good), float(np.median(resid)), dst[inl]


def corner_shift(M: np.ndarray) -> float:
    pts = np.float32([[0, 0], [W, 0], [0, H], [W, H], [W / 2, H / 2]])
    proj = pts @ M[:, :2].T + M[:, 2]
    return float(np.max(np.linalg.norm(proj - pts, axis=1)))


def edges_overlay(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ea = cv2.Canny(cv2.GaussianBlur(a, (5, 5), 0), 40, 110)
    eb = cv2.Canny(cv2.GaussianBlur(b, (5, 5), 0), 40, 110)
    out = np.zeros((*a.shape, 3), np.uint8)
    out[..., 0] = ea
    out[..., 1] = eb
    return out


def main() -> None:
    ref = gray(MASTER)
    (WORK / "aligned").mkdir(parents=True, exist_ok=True)
    report = {}
    overlays = []
    Image.open(SRC / f"{MASTER}.png").convert("RGB").save(WORK / "aligned" / f"{MASTER}.png")
    for name in TARGETS:
        mov = gray(name)
        M, ninl, ngood, resid, pts = estimate(ref, mov)
        shift = corner_shift(M)
        scale = float(np.hypot(M[0, 0], M[1, 0]))
        rot = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
        warped = shift > 0.75
        rgb = cv2.imread(str(SRC / f"{name}.png"), cv2.IMREAD_COLOR)
        if warped:
            rgb = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)
            mov_al = cv2.warpAffine(mov, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
        else:
            mov_al = mov
        cv2.imwrite(str(WORK / "aligned" / f"{name}.png"), rgb)
        # Répartition spatiale des inliers (pour juger de la fiabilité).
        cover = np.histogram2d(pts[:, 1], pts[:, 0], bins=[6, 4], range=[[0, H], [0, W]])[0]
        report[name] = {
            "inliers": ninl,
            "matches": ngood,
            "residual_px": round(resid, 3),
            "scale": round(scale, 5),
            "rotation_deg": round(rot, 4),
            "tx": round(float(M[0, 2]), 2),
            "ty": round(float(M[1, 2]), 2),
            "max_shift_px": round(shift, 2),
            "warped": warped,
            "empty_cells": int((cover < 3).sum()),
        }
        print(name, report[name])
        ov = edges_overlay(ref, mov_al)
        overlays.append(label(Image.fromarray(ov).resize((341, 512), Image.LANCZOS), name))
    write_json(report, WORK / "align.json")
    grid(overlays, 6).save(QA / "01-align-edges.jpg", quality=85)

    # Zoom 1:1 sur une zone stable (rochers / cascade) : contours maître (rouge) vs cible (vert).
    crops = []
    for name in TARGETS:
        mov = cv2.cvtColor(cv2.imread(str(WORK / "aligned" / f"{name}.png")), cv2.COLOR_BGR2GRAY)
        mov = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(mov)
        ov = edges_overlay(ref, mov)[1000:1400, 300:700]
        crops.append(label(Image.fromarray(ov), name))
    grid(crops, 5).save(QA / "01-align-zoom.jpg", quality=85)


if __name__ == "__main__":
    main()
