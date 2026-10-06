"""Planches de contrôle des lanternes (recalage, ancres, kodama posé)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from ucommon import font

BG = (26, 30, 38)


def _u8(x: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(np.round(x * 255), 0, 255).astype(np.uint8))


def _on_bg(rgba: np.ndarray, bg=BG) -> np.ndarray:
    a = rgba[..., 3:4]
    return rgba[..., :3] * a + np.array(bg, np.float32) / 255 * (1 - a)


def _fit(im: Image.Image, h: int) -> Image.Image:
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def align_sheet(items, out: Path, h: int = 260) -> None:
    """Par modèle : alpha avant recalage (rouge = éteinte, vert = allumée,
    jaune = accord), alpha après, allumée recalée brute, allumée finale
    (éteinte + lumière), fondu 50 % éteinte / finale, |Δ luminance| × 4
    éteinte / finale (seule la lumière doit ressortir)."""
    f = font(14)
    rows = []
    for name, ru, rl, wraw, wl in items:
        z = np.zeros(ru.shape[:2], np.float32)
        before = np.stack([ru[..., 3], rl[..., 3], z], axis=2)
        after = np.stack([ru[..., 3], wraw[..., 3], z], axis=2)
        mix = _on_bg(ru) * 0.5 + _on_bg(wl) * 0.5
        lum = lambda x: (_on_bg(x) * [0.3, 0.59, 0.11]).sum(axis=2)
        diff = np.clip(np.abs(lum(wl) - lum(ru)) * 4, 0, 1)
        tiles = [_fit(_u8(t), h) for t in (before, after, _on_bg(wraw), _on_bg(wl), mix,
                                         np.repeat(diff[..., None], 3, 2))]
        row = Image.new("RGB", (sum(t.width + 4 for t in tiles) + 150, h), BG)
        d = ImageDraw.Draw(row)
        d.text((6, 6), name, fill=(240, 240, 240), font=f)
        for i, lbl in enumerate(["avant", "après", "allumée brute", "allumée finale", "fondu 50 %", "|Δ lum| ×4"]):
            d.text((6, 30 + 18 * i), f"{i + 1}. {lbl}", fill=(170, 175, 190), font=f)
        x = 150
        for t in tiles:
            row.paste(t, (x, 0))
            x += t.width + 4
        rows.append(row)
    sheet = Image.new("RGB", (max(r.width for r in rows), len(rows) * (h + 6)), BG)
    for i, r in enumerate(rows):
        sheet.paste(r, (0, i * (h + 6)))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def anchors_sheet(rows, kodama_dir: Path, seats: dict, out: Path, unit: int = 300) -> None:
    """Chaque modèle à l'échelle relative (le plus haut = `unit` px) : allumée
    avec ancres (cercle = fire, croix = roof) et un kodama assis sur `roof`
    (le plus grand sprite de kodama = 0,2 du plus haut modèle), éteinte, silhouette. Fond nuit."""
    tallest = max(m["h"] for _, _, m in rows)
    k = unit / tallest
    kodamas = sorted(kodama_dir.glob("kodama-*.webp"))
    f = font(13)
    cols = []
    for i, (name, outs, m) in enumerate(rows):
        hh = round(m["h"] * k)
        ims = {kind: _fit(_u8(outs[kind]).convert("RGBA"), hh) for kind in ("lit", "unlit", "silhouette")}
        w = ims["lit"].width
        col = Image.new("RGBA", (w * 3 + 16, unit + 40), BG + (255,))
        y0 = unit - hh + 20
        for j, kind in enumerate(("lit", "unlit", "silhouette")):
            col.alpha_composite(ims[kind], (j * (w + 8), y0))
        d = ImageDraw.Draw(col)
        fx, fy = m["fire"]["x"] * w, y0 + m["fire"]["y"] * hh
        d.ellipse([fx - 5, fy - 5, fx + 5, fy + 5], outline=(255, 80, 200), width=2)
        if kodamas:
            kp = kodamas[i % len(kodamas)]
            kim = Image.open(kp).convert("RGBA")
            kmax = max(Image.open(q).height for q in kodamas)  # même échelle pour toutes les poses
            kh = round(0.2 * unit * kim.height / kmax)
            kim = _fit(kim, kh)
            seat = seats.get(kp.stem, 0.75)
            rx, ry = m["roof"]["x"] * w, y0 + m["roof"]["y"] * hh
            col.alpha_composite(kim, (round(rx - kim.width / 2), max(0, round(ry - seat * kh))))
            rx2 = w + 8 + m["roof"]["x"] * w
            d.line([rx2 - 6, ry, rx2 + 6, ry], fill=(80, 255, 120), width=2)
            d.line([rx2, ry - 6, rx2, ry + 6], fill=(80, 255, 120), width=2)
        d.text((4, unit + 22), f"{name} · {m['w']}×{m['h']}", fill=(230, 230, 230), font=f)
        cols.append(col)
    per_row = 4
    rws = [cols[i:i + per_row] for i in range(0, len(cols), per_row)]
    W = max(sum(c.width + 10 for c in r) for r in rws)
    sheet = Image.new("RGB", (W, len(rws) * (unit + 46)), BG)
    for ri, r in enumerate(rws):
        x = 0
        for c in r:
            sheet.paste(c.convert("RGB"), (x, ri * (unit + 46)))
            x += c.width + 10
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
