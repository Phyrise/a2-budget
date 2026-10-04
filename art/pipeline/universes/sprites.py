"""Découpe des planches de sprites (alpha réel) en WebP RGBA.

Pour chaque planche de sheets.py :
  1. composantes connexes de l'alpha (> 3 %, 8-connexité) ;
  2. chaque composante va à la case contenant son centre de masse ;
  3. dans une case, les « grosses » composantes (≥ 3 % de la plus grande) font
     la pose ; les petits fragments (étincelles, poussière, poils) ne sont
     gardés que s'ils sont à moins de `keep` px de la pose (le reste = bruit) ;
  4. rognage avec une petite marge, défrangeage, réduction en alpha
     prémultiplié puis dé-prémultiplication, propagation des couleurs sous
     l'alpha nul, WebP (`exact`) ;
  5. planche de contrôle out/qa/<planche>.png (fond sombre + nom + taille).

  python sprites.py            # toutes les planches
  python sprites.py k03 b05    # seulement les planches dont le nom commence ainsi
"""
from __future__ import annotations

import sys

import cv2
import numpy as np
from scipy import ndimage as ndi

from sheets import SHEETS, Cell, Sheet
from ucommon import (ASSETS, QA, clean_alpha, contact_sheet, decontaminate, load_rgba,
                     resize_premul, save_sprite, update_report)

THR = 0.03
PAD = 6  # marge transparente finale (px de sortie)


def assign(sheet: Sheet, lab: np.ndarray, n: int, shape) -> dict[int, list[int]]:
    """Composante → index de case (centre de masse dans la boîte, sinon la plus proche)."""
    H, W = shape
    idx = np.arange(1, n + 1)
    com = ndi.center_of_mass(np.ones(shape), lab, idx)
    out: dict[int, list[int]] = {i: [] for i in range(len(sheet.cells))}
    for k, (cy, cx) in zip(idx, com):
        fx, fy = cx / W, cy / H
        best, bd = None, 9e9
        for i, c in enumerate(sheet.cells):
            x0, y0, x1, y1 = c.box
            if x0 <= fx < x1 and y0 <= fy < y1:
                best = i
                break
            d = (max(x0 - fx, 0, fx - x1) * W) ** 2 + (max(y0 - fy, 0, fy - y1) * H) ** 2
            if d < bd:
                best, bd = i, d
        out[best].append(int(k))
    return out


def extract(rgba: np.ndarray, lab: np.ndarray, areas: np.ndarray, comps: list[int], cell: Cell):
    """Masque de la pose (grosses composantes + fragments proches) et boîte englobante."""
    if not comps:
        raise SystemExit(f"case vide : {cell.name}")
    a = np.array([areas[k - 1] for k in comps])
    big = [k for k, s in zip(comps, a) if s >= 0.03 * a.max()]
    main = np.isin(lab, big)
    ys, xs = np.nonzero(main)
    m = cell.keep + 4
    y0, y1 = max(ys.min() - m, 0), min(ys.max() + m + 1, lab.shape[0])
    x0, x1 = max(xs.min() - m, 0), min(xs.max() + m + 1, lab.shape[1])
    dist = ndi.distance_transform_edt(~main[y0:y1, x0:x1])
    sub = lab[y0:y1, x0:x1]
    keep = set(big)
    dropped = []
    for k in comps:
        if k in keep:
            continue
        sel = sub == k
        if sel.any() and dist[sel].min() <= cell.keep and areas[k - 1] >= 3:
            keep.add(k)
        else:
            dropped.append(int(areas[k - 1]))
    mask = np.isin(lab, list(keep))
    # Halo très faible (< seuil) autour des pixels gardés, sans voler les voisins.
    halo = cv2.dilate(mask.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    halo &= (lab == 0) | mask
    ys, xs = np.nonzero(mask)
    box = (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1)
    return halo, box, len(keep), dropped


def crop(rgba: np.ndarray, mask: np.ndarray, box, margin: int) -> np.ndarray:
    y0, y1, x0, x1 = box
    H, W = mask.shape
    out = np.zeros((y1 - y0 + 2 * margin, x1 - x0 + 2 * margin, 4), np.float32)
    sy0, sy1 = max(y0 - margin, 0), min(y1 + margin, H)
    sx0, sx1 = max(x0 - margin, 0), min(x1 + margin, W)
    part = rgba[sy0:sy1, sx0:sx1].copy()
    part[..., 3] *= mask[sy0:sy1, sx0:sx1]
    oy, ox = sy0 - (y0 - margin), sx0 - (x0 - margin)
    out[oy:oy + part.shape[0], ox:ox + part.shape[1]] = part
    return out


def dim(box, mode: str) -> int:
    h, w = box[1] - box[0], box[3] - box[2]
    return {"h": h, "w": w, "fit": max(h, w)}[mode]


def process(sheet: Sheet) -> dict:
    rgba = load_rgba(sheet.file)
    fg = rgba[..., 3] > THR
    for x0, y0, x1, y1 in sheet.cuts:
        fg[y0:y1, x0:x1] = False
    lab, n = ndi.label(fg, structure=np.ones((3, 3)))
    areas = ndi.sum(np.ones(lab.shape), lab, np.arange(1, n + 1))
    by_cell = assign(sheet, lab, n, lab.shape)
    found = []
    for i, cell in enumerate(sheet.cells):
        mask, box, kept, dropped = extract(rgba, lab, areas, by_cell[i], cell)
        found.append((cell, mask, box))
        print(f"  {cell.name:28s} comps={len(by_cell[i]):3d} gardées={kept:3d} "
              f"bruit={len(dropped):3d} (max {max(dropped, default=0):4d} px) "
              f"boîte={box[3] - box[2]}×{box[1] - box[0]}")
    # Échelle par groupe : la plus petite qui respecte la cible de chaque case.
    scale: dict[str, float] = {}
    for cell, _, box in found:
        s = cell.target / dim(box, cell.mode)
        key = cell.group or cell.name
        scale[key] = min(scale.get(key, 9.0), s)
    images: dict[str, np.ndarray] = {}
    for cell, mask, box in found:
        s = scale[cell.group or cell.name]
        margin = int(np.ceil(3 / s)) + 2
        src = crop(rgba, mask, box, margin)
        if cell.decon:
            src = decontaminate(src)
        h, w = src.shape[:2]
        r = clean_alpha(resize_premul(src, max(1, round(w * s)), max(1, round(h * s))))
        if cell.square:
            h, w = r.shape[:2]
            S = max(cell.square, h, w)
            r = np.pad(r, (((S - h) // 2, S - h - (S - h) // 2),
                           ((S - w) // 2, S - w - (S - w) // 2), (0, 0)))
        else:
            r = np.pad(r, ((PAD, PAD), (PAD, PAD), (0, 0)))
        images[cell.name] = r
    for names in sheet.align:  # même toile (calées en bas, centrées) pour les animations
        H = max(images[k].shape[0] for k in names)
        W = max(images[k].shape[1] for k in names)
        for k in names:
            im = images[k]
            canvas = np.zeros((H, W, 4), np.float32)
            ox = (W - im.shape[1]) // 2
            canvas[H - im.shape[0]:, ox:ox + im.shape[1]] = im
            images[k] = canvas
    report, items = {}, []
    for cell, _, _ in found:
        path = ASSETS / sheet.out / f"{cell.name}.webp"
        report[f"{sheet.out}/{cell.name}.webp"] = save_sprite(images[cell.name], path)
        items.append((cell.name, path))
    contact_sheet(items, QA / f"{sheet.file[:-4]}.png", cols=min(5, len(items)))
    return report


def main() -> None:
    only = sys.argv[1:]
    for sheet in SHEETS:
        if only and not any(sheet.file.startswith(p) for p in only):
            continue
        print(sheet.file)
        update_report(process(sheet))


if __name__ == "__main__":
    main()
