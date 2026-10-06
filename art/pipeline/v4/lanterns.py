"""Lanternes de pierre (tōrō) : éteinte, allumée, silhouette + kodama sur le toit.

  python3 art/pipeline/v4/lanterns.py

Pour chaque modèle (planche l01 éteinte / l02 allumée, grille 4×2, case
bas-droite vide) :
  1. découpe par composantes connexes de l'alpha (comme sprites.py) ;
  2. RECALAGE de l'allumée sur l'éteinte : corrélation de phase sur l'alpha
     (translation), puis ECC euclidien (rotation + translation) initialisé
     par la phase ; on garde l'ECC seulement s'il améliore l'IoU de l'alpha ;
  3. même toile pour les deux (union des masques), même échelle pour TOUS les
     modèles (le plus haut fait 420 px utiles) : la taille relative de la
     planche est conservée ;
  4. ancres en coordonnées normalisées de la toile : `fire` = barycentre de la
     lumière ajoutée (allumée − éteinte), `roof` = point de la surface du
     toit à droite du fleuron (là où l'on assoit un kodama) ;
  5. silhouette (Carnet, modèle pas encore débloqué) : l'alpha de l'éteinte,
     légèrement flouté, rempli d'un ton sombre de brume — la vraie image n'est
     jamais chargée tant que le modèle n'est pas débloqué ;
  6. planches de contrôle : qa/lantern-align.png (différence d'alpha avant /
     après recalage, fondu à 50 %), qa/lantern-anchors.png (ancres + kodama
     posé), qa/l03-kodama-on-lantern.png.
Écrit out/report.json (fichiers) et out/lanterns.json (ancres, recalage).
"""
from __future__ import annotations

import json

import cv2
import numpy as np
from scipy import ndimage as ndi

import v4common
from sheets import Sheet, grid
from sprites import PAD, assign, crop, extract, process
from ucommon import (ASSETS, QA, clean_alpha, decontaminate, load_rgba, resize_premul,
                     save_sprite, update_report)
from v4qa import align_sheet, anchors_sheet

IDS = ["kasuga-moss", "yukimi", "oribe", "kotoji", "tachi-carved", "ancient-shrine", "spirit-light"]
TARGET_H = 420          # hauteur utile du plus haut modèle (px)
THR = 0.03
# Seuil du cœur de lumière (fraction du max) : la lanterne spirituelle a aussi
# des glyphes lumineux le long du fût, plus faibles que la fenêtre.
LIGHT_CORE = {"spirit-light": 0.08}
MIST_TOP = np.array([0.30, 0.36, 0.38], np.float32)   # ton de brume (haut)
MIST_BOTTOM = np.array([0.17, 0.22, 0.24], np.float32)  # (bas)

KODAMA = grid(["kodama-sit", "kodama-lying", "kodama-pair", "kodama-wave"], 2, 2, "h", 200,
              "kodama", keep=40)
# Hauteur (fraction de la toile du sprite, depuis le haut) de l'assise du
# kodama : ce point se pose sur `roof`. Mesuré à l'œil sur qa/lantern-anchors.png.
KODAMA_SEAT = {"kodama-sit": 0.70, "kodama-lying": 0.93, "kodama-pair": 0.74, "kodama-wave": 0.74}


def cells() -> list:
    return grid(IDS + [None], 4, 2, "h", TARGET_H, "lantern", keep=40)


def label(rgba: np.ndarray, sheet: Sheet):
    fg = rgba[..., 3] > THR
    lab, n = ndi.label(fg, structure=np.ones((3, 3)))
    areas = ndi.sum(np.ones(lab.shape), lab, np.arange(1, n + 1))
    return lab, areas, assign(sheet, lab, n, lab.shape)


def iou(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a > 0.5, b > 0.5
    return float((a & b).sum() / max((a | b).sum(), 1))


def register(ua: np.ndarray, la: np.ndarray) -> tuple[np.ndarray, dict]:
    """Matrice 2×3 (WARP_INVERSE_MAP) qui ramène l'alpha allumé `la` sur `ua`."""
    win = cv2.createHanningWindow(ua.shape[::-1], cv2.CV_32F)
    (dx, dy), resp = cv2.phaseCorrelate(ua, la, win)
    phase = np.array([[1, 0, dx], [0, 1, dy]], np.float32)
    warp_t = lambda m: cv2.warpAffine(la, m, ua.shape[::-1], flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    best, info = phase, {"dx": round(float(dx), 2), "dy": round(float(dy), 2),
                         "rot_deg": 0.0, "method": "phase", "response": round(float(resp), 3)}
    score = iou(ua, warp_t(phase))
    try:
        m = phase.copy()
        crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        sm_u = cv2.GaussianBlur(ua, (0, 0), 1.5)
        sm_l = cv2.GaussianBlur(la, (0, 0), 1.5)
        _, m = cv2.findTransformECC(sm_u, sm_l, m, cv2.MOTION_EUCLIDEAN, crit, None, 5)
        s = iou(ua, warp_t(m))
        if s > score + 1e-4:
            best, score = m, s
            info.update(dx=round(float(m[0, 2]), 2), dy=round(float(m[1, 2]), 2),
                        rot_deg=round(float(np.degrees(np.arctan2(m[1, 0], m[0, 0]))), 3), method="ecc")
    except cv2.error as e:  # pas de convergence : on garde la phase
        info["ecc"] = str(e).splitlines()[-1][:80]
    info["iou_before"] = round(iou(ua, la), 4)
    info["iou_after"] = round(score, 4)
    return best, info


def warp_rgba(rgba: np.ndarray, m: np.ndarray, shape) -> np.ndarray:
    """Déplace un RGBA en alpha prémultiplié (pas de franges), puis dé-prémultiplie."""
    a = rgba[..., 3:4]
    pm = np.concatenate([rgba[..., :3] * a, a], axis=2)
    w = cv2.warpAffine(pm, m, shape[::-1], flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                       borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    al = w[..., 3:4]
    rgb = np.where(al > 1e-4, w[..., :3] / np.maximum(al, 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 1), np.clip(al, 0, 1)], axis=2)


def light_mask(unlit: np.ndarray, lit: np.ndarray, core_thr: float) -> np.ndarray:
    """Zone où la lanterne allumée diffère « par la lumière » : cœur de la
    lumière ajoutée (canal le plus éclairci ≥ core_thr × max, lissé) élargi par
    un flou large (8 % de la hauteur). Hors de cette zone, la texture est celle
    de l'éteinte : le fondu éteinte → allumée ne fait bouger que la lumière."""
    gain = np.clip(lit[..., :3] - unlit[..., :3], 0, 1).max(axis=2)
    gain *= np.minimum(unlit[..., 3], lit[..., 3])
    g = cv2.GaussianBlur(gain, (0, 0), 3)
    core = (g >= core_thr * g.max()).astype(np.float32)
    m = cv2.GaussianBlur(core, (0, 0), 0.08 * unlit.shape[0])
    return np.clip(m / max(m.max(), 1e-6) * 2.5, 0, 1)


def compose_lit(unlit: np.ndarray, lit: np.ndarray, core_thr: float = 0.25) -> np.ndarray:
    """Allumée finale = éteinte + lumière (mélange prémultiplié dans light_mask)."""
    m = light_mask(unlit, lit, core_thr)[..., None]
    pm = lambda x: np.concatenate([x[..., :3] * x[..., 3:4], x[..., 3:4]], axis=2)
    out = pm(unlit) * (1 - m) + pm(lit) * m
    a = out[..., 3:4]
    rgb = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 1), a], axis=2).astype(np.float32)


def bbox(mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    return ys.min(), ys.max() + 1, xs.min(), xs.max() + 1


def fire_anchor(unlit: np.ndarray, lit: np.ndarray) -> tuple[float, float]:
    """Barycentre de la lumière ajoutée (canal le plus éclairci, lissé)."""
    gain = np.clip(lit[..., :3] - unlit[..., :3], 0, 1).max(axis=2)
    gain *= np.minimum(unlit[..., 3], lit[..., 3])
    g = cv2.GaussianBlur(gain, (0, 0), 3)
    g = np.where(g >= 0.5 * g.max(), g, 0)
    ys, xs = np.indices(g.shape)
    tot = g.sum()
    return float((xs * g).sum() / tot / g.shape[1]), float((ys * g).sum() / tot / g.shape[0])


def roof_anchor(alpha: np.ndarray) -> tuple[float, float]:
    """Point de la surface du toit, à droite du fleuron : rangée la plus large
    dans le tiers supérieur (l'avant-toit), x = centre + 25 % de sa largeur,
    y = premier pixel opaque depuis le haut dans cette colonne (médiane ±3),
    abaissé de 2 % de la hauteur (le kodama s'assoit dans la mousse du toit)."""
    op = alpha > 0.5
    h, w = op.shape
    top = op[: int(h * 0.42)]
    widths = top.sum(axis=1)
    r = int(np.argmax(widths))
    xs = np.nonzero(top[r])[0]
    x0, x1 = xs.min(), xs.max()
    x = int(round((x0 + x1) / 2 + 0.25 * (x1 - x0)))
    ys = []
    for c in range(max(x - 3, 0), min(x + 4, w)):
        col = np.nonzero(op[:, c])[0]
        if len(col):
            ys.append(col.min())
    return x / w, float(np.median(ys)) / h + 0.02


def silhouette(unlit: np.ndarray) -> np.ndarray:
    h, w = unlit.shape[:2]
    a = cv2.GaussianBlur(unlit[..., 3], (0, 0), 1.6)
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    rgb = MIST_TOP * (1 - t) + MIST_BOTTOM * t
    rgb = np.broadcast_to(rgb, (h, w, 3))
    return np.concatenate([rgb, (np.clip(a, 0, 1) * 0.94)[..., None]], axis=2).astype(np.float32)


def lanterns() -> dict:
    U, L = load_rgba("l01-lanterns-unlit.png"), load_rgba("l02-lanterns-lit.png")
    sheet = Sheet("l01-lanterns-unlit.png", "lanterns", cells())
    labU, areasU, byU = label(U, sheet)
    labL, areasL, byL = label(L, sheet)
    found = []
    for i, cell in enumerate(sheet.cells):
        mU, boxU, *_ = extract(U, labU, areasU, byU[i], cell)
        mL, boxL, *_ = extract(L, labL, areasL, byL[i], cell)
        m = 48  # région de recalage : union des deux boîtes + marge
        y0 = max(min(boxU[0], boxL[0]) - m, 0)
        y1 = min(max(boxU[1], boxL[1]) + m, U.shape[0])
        x0 = max(min(boxU[2], boxL[2]) - m, 0)
        x1 = min(max(boxU[3], boxL[3]) + m, U.shape[1])
        ru = U[y0:y1, x0:x1].copy()
        ru[..., 3] *= mU[y0:y1, x0:x1]
        rl = L[y0:y1, x0:x1].copy()
        rl[..., 3] *= mL[y0:y1, x0:x1]
        M, info = register(np.ascontiguousarray(ru[..., 3]), np.ascontiguousarray(rl[..., 3]))
        wraw = warp_rgba(rl, M, ru.shape[:2])
        wl = compose_lit(ru, wraw, LIGHT_CORE.get(cell.name, 0.25))
        union = (ru[..., 3] > THR) | (wl[..., 3] > THR)
        found.append((cell, ru, rl, wl, union, bbox(union), info, wraw))
        print(f"  {cell.name:16s} {info['method']:5s} dx={info['dx']:+6.2f} dy={info['dy']:+6.2f} "
              f"rot={info['rot_deg']:+.3f}° IoU {info['iou_before']:.4f} → {info['iou_after']:.4f}")
    scale = min(TARGET_H / (f[5][1] - f[5][0]) for f in found)
    margin = int(np.ceil(3 / scale)) + 2
    report, meta, rows = {}, {}, []
    for cell, ru, rl, wl, union, box, info, _ in found:
        outs = {}
        for kind, src in (("unlit", ru), ("lit", wl)):
            c = decontaminate(crop(src, union, box, margin))
            h, w = c.shape[:2]
            r = clean_alpha(resize_premul(c, max(1, round(w * scale)), max(1, round(h * scale))))
            outs[kind] = np.pad(r, ((PAD, PAD), (PAD, PAD), (0, 0)))
        outs["silhouette"] = silhouette(outs["unlit"])
        for kind, im in outs.items():
            rel = f"lanterns/lantern-{cell.name}-{kind}.webp"
            q = 80 if kind == "silhouette" else 86
            report[rel] = save_sprite(im, ASSETS / rel, quality=q)
        h, w = outs["unlit"].shape[:2]
        fx, fy = fire_anchor(outs["unlit"], outs["lit"])
        rx, ry = roof_anchor(outs["unlit"][..., 3])
        meta[cell.name] = {
            "w": w, "h": h, "aspect": round(w / h, 4),
            "fire": {"x": round(fx, 3), "y": round(fy, 3)},
            "roof": {"x": round(rx, 3), "y": round(ry, 3)},
            "align": info,
        }
        rows.append((cell.name, outs, meta[cell.name]))
    tallest = max(m["h"] for m in meta.values())
    for m in meta.values():
        m["scale"] = round(m["h"] / tallest, 4)
    align_sheet([(n, f[1], f[2], f[7], f[3]) for n, f in zip(IDS, found)], QA / "lantern-align.png")
    return report, meta, rows


def main() -> None:
    report, meta, rows = lanterns()
    update_report(report)
    print("l03-kodama-on-lantern.png")
    update_report(process(Sheet("l03-kodama-on-lantern.png", "lanterns", KODAMA)))
    kodama = {c.name: {"seat": KODAMA_SEAT[c.name]} for c in KODAMA}
    (v4common.WORK / "out/lanterns.json").write_text(
        json.dumps({"lanterns": meta, "kodama": kodama}, indent=1, ensure_ascii=False))
    anchors_sheet(rows, ASSETS / "lanterns", KODAMA_SEAT, QA / "lantern-anchors.png")


if __name__ == "__main__":
    main()
