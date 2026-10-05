"""Recalage de chaque peinture de saison sur le stade de base correspondant.

Même méthode que 01_align.py : SIFT sur luminance égalisée (CLAHE) + RANSAC,
similitude (translation + échelle + rotation) affinée par LMEDS. Référence :
le stade de base déjà recalé sur le stade 6 (~/a2art/out/work/aligned) ;
la nuit de saison est recalée sur 04-pause-night recalée. Rééchantillonnage
seulement si la transformation déplace un coin de plus de 0,75 px.

Dérive résiduelle mesurée après recalage :
  - resid_px    : médiane des résidus des appariements retenus (RANSAC) ;
  - local_px    : pire médiane locale (grille 4×6) des résidus des appariements
                  < 8 px — repère les glissements locaux (rocher, berge) ;
  - flow_med/p90: flot optique dense (DIS) base → saison sur les bords présents
                  dans les deux images (les zones repeintes, neige, feuilles,
                  sont exclues par un test de cohérence aller-retour).
drift_px = max(resid_px, local_px) sert à décider de réutiliser la profondeur.

Sorties : work/aligned/<saison>-<stade>.png, work/align.json,
          qa/s01-edges-<saison>.jpg (bords base rouge / saison vert),
          qa/s01-checker-<saison>.jpg (damier base / saison),
          qa/s01-zoom.jpg (1:1 sur la cascade et les rochers).
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from scommon import BASE_ALIGNED, QA, SEASONS, SRC, WORK, H, W, base_name, grid, items, label, src_name, write_json


def gray_file(path) -> np.ndarray:
    g = cv2.cvtColor(cv2.imread(str(path), cv2.IMREAD_COLOR), cv2.COLOR_BGR2GRAY)
    return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(g)


def clahe(g: np.ndarray) -> np.ndarray:
    return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(g)


def matches(ref: np.ndarray, mov: np.ndarray):
    sift = cv2.SIFT_create(nfeatures=12000, contrastThreshold=0.02)
    k1, d1 = sift.detectAndCompute(ref, None)
    k2, d2 = sift.detectAndCompute(mov, None)
    raw = cv2.BFMatcher(cv2.NORM_L2).knnMatch(d2, d1, k=2)
    good = [m for m, n in raw if m.distance < 0.72 * n.distance]
    src = np.float32([k2[m.queryIdx].pt for m in good])
    dst = np.float32([k1[m.trainIdx].pt for m in good])
    return src, dst


def estimate(src: np.ndarray, dst: np.ndarray):
    M, inl = cv2.estimateAffinePartial2D(
        src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=20000, confidence=0.999
    )
    inl = inl.ravel().astype(bool)
    M2, _ = cv2.estimateAffinePartial2D(src[inl], dst[inl], method=cv2.LMEDS)
    if M2 is not None:
        M = M2
    return M, inl


def project(M: np.ndarray, p: np.ndarray) -> np.ndarray:
    return p @ M[:, :2].T + M[:, 2]


def corner_shift(M: np.ndarray) -> float:
    pts = np.float32([[0, 0], [W, 0], [0, H], [W, H], [W / 2, H / 2]])
    return float(np.max(np.linalg.norm(project(M, pts) - pts, axis=1)))


def local_drift(dst: np.ndarray, resid: np.ndarray) -> tuple[float, int]:
    """Pire médiane de résidu par case (4 colonnes × 6 rangées, ≥ 12 appariements)."""
    keep = resid < 8.0
    worst, cells = 0.0, 0
    for i in range(6):
        for j in range(4):
            m = keep & (dst[:, 1] >= i * H / 6) & (dst[:, 1] < (i + 1) * H / 6)
            m &= (dst[:, 0] >= j * W / 4) & (dst[:, 0] < (j + 1) * W / 4)
            if m.sum() >= 12:
                cells += 1
                worst = max(worst, float(np.median(resid[m])))
    return worst, cells


def flow_drift(ref: np.ndarray, mov: np.ndarray) -> tuple[float, float, float]:
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    f = dis.calc(ref, mov, None)
    b = dis.calc(mov, ref, None)
    xs, ys = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    bw = cv2.remap(b, xs + f[..., 0], ys + f[..., 1], cv2.INTER_LINEAR)
    fb = np.linalg.norm(f + bw, axis=2)
    e1 = cv2.Canny(cv2.GaussianBlur(ref, (5, 5), 0), 40, 110) > 0
    e2 = cv2.Canny(cv2.GaussianBlur(mov, (5, 5), 0), 40, 110) > 0
    near = cv2.dilate(e2.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    m = e1 & near & (fb < 0.5)
    mag = np.linalg.norm(f, axis=2)[m]
    if mag.size < 500:
        return float("nan"), float("nan"), float(m.mean())
    return float(np.median(mag)), float(np.percentile(mag, 90)), float(m.mean())


def edges_overlay(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ea = cv2.Canny(cv2.GaussianBlur(a, (5, 5), 0), 40, 110)
    eb = cv2.Canny(cv2.GaussianBlur(b, (5, 5), 0), 40, 110)
    out = np.zeros((*a.shape, 3), np.uint8)
    out[..., 0] = ea
    out[..., 1] = eb
    return out


def checker(a: np.ndarray, b: np.ndarray, cell: int = 128) -> np.ndarray:
    ys, xs = np.mgrid[0:H, 0:W]
    m = ((ys // cell + xs // cell) % 2).astype(bool)
    out = a.copy()
    out[m] = b[m]
    return out


def main() -> None:
    (WORK / "aligned").mkdir(parents=True, exist_ok=True)
    report: dict = {}
    edges = {s: [] for s in SEASONS}
    checks = {s: [] for s in SEASONS}
    zooms = []
    for season, stage in items():
        name = src_name(season, stage)
        ref_path = BASE_ALIGNED / f"{base_name(stage)}.png"
        ref = gray_file(ref_path)
        mov = gray_file(SRC / f"{name}.png")
        src, dst = matches(ref, mov)
        M, inl = estimate(src, dst)
        shift = corner_shift(M)
        warped = shift > 0.75
        rgb = cv2.imread(str(SRC / f"{name}.png"), cv2.IMREAD_COLOR)
        if warped:
            rgb = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)
        cv2.imwrite(str(WORK / "aligned" / f"{name}.png"), rgb)
        mov_al = clahe(cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY))
        resid = np.linalg.norm(project(M, src) - dst, axis=1)
        local, cells = local_drift(dst, resid)
        fmed, fp90, fcover = flow_drift(ref, mov_al)
        r = {
            "base": base_name(stage),
            "matches": int(len(src)),
            "inliers": int(inl.sum()),
            "resid_px": round(float(np.median(resid[inl])), 3),
            "local_px": round(local, 3),
            "local_cells": cells,
            "flow_med_px": round(fmed, 3),
            "flow_p90_px": round(fp90, 3),
            "flow_cover": round(fcover, 4),
            "scale": round(float(np.hypot(M[0, 0], M[1, 0])), 5),
            "rotation_deg": round(float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))), 4),
            "tx": round(float(M[0, 2]), 2),
            "ty": round(float(M[1, 2]), 2),
            "max_shift_px": round(shift, 2),
            "warped": bool(warped),
        }
        r["drift_px"] = round(max(r["resid_px"], r["local_px"]), 3)
        report[name] = r
        print(name, r, flush=True)
        ov = edges_overlay(ref, mov_al)
        edges[season].append(label(Image.fromarray(ov).resize((256, 384), Image.LANCZOS), f"{name} d={r['drift_px']}"))
        base_rgb = cv2.cvtColor(cv2.imread(str(ref_path)), cv2.COLOR_BGR2RGB)
        ck = checker(base_rgb, cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB))
        checks[season].append(label(Image.fromarray(ck).resize((256, 384), Image.LANCZOS), name))
        if stage in (1, 6, "night"):
            zooms.append(label(Image.fromarray(ov[1000:1400, 300:700]), name))
    write_json(report, WORK / "align.json")
    for s in SEASONS:
        grid(edges[s], 4).save(QA / f"s01-edges-{s}.jpg", quality=84)
        grid(checks[s], 4).save(QA / f"s01-checker-{s}.jpg", quality=84)
    grid(zooms, 3).save(QA / "s01-zoom.jpg", quality=84)


if __name__ == "__main__":
    main()
