"""Placements de la scène (ancres de lumière, kodama, créatures, gardien, rayons).

Les positions sont choisies À LA MAIN en regardant la peinture (stade 6) :

  python 08_placements.py grid    # planche avec grille de coordonnées (out/qa/08-grid.jpg)
  python 08_placements.py         # lit placements.json, lit la profondeur au
                                  # pied de chaque point dans la carte du stade 6,
                                  # vérifie (pas sur l'eau, pas dans le ciel) et
                                  # dessine la planche de contrôle (out/qa/08-check.jpg)

placements.json (coordonnées normalisées 0..1 du cadrage portrait, origine en
haut à gauche ; `scale` = hauteur du sprite / hauteur de l'image) :
  anchors[]          {x, y, note}
  kodamaSpots[]      {x, y, scale, sprite?, note}
  creatureSpots{id}  {x, y, scale, note}
  guardianSpot       {x, y, scale, note}   (x, y = pieds)
  lightSource        {x, y}

Sortie : out/work/placements.resolved.json (profondeurs ajoutées).
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from common import ASSETS, PIPE, QA, STAGE_SOURCES, WORK, read_json, write_json

W, H = 1024, 1536


def font(size: int):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


def stage6() -> Image.Image:
    return Image.open(WORK / "aligned" / f"{STAGE_SOURCES[6]}.png").convert("RGB")


def depth6() -> np.ndarray:
    p = WORK / "depth" / "stage-6.png"  # écrit par 02_depth.py
    return np.asarray(Image.open(p).convert("L"), dtype=np.float32) / 255.0


def masks() -> np.ndarray | None:
    p = ASSETS / "masks.png"
    if not p.exists():
        return None
    return np.asarray(Image.open(p).convert("RGBA"), dtype=np.float32) / 255.0


def sample(m: np.ndarray, x: float, y: float, r: int = 2) -> float:
    h, w = m.shape[:2]
    cx, cy = int(round(x * (w - 1))), int(round(y * (h - 1)))
    return float(np.median(m[max(0, cy - r) : cy + r + 1, max(0, cx - r) : cx + r + 1]))


def draw_grid() -> None:
    im = stage6().resize((768, 1152), Image.LANCZOS)
    d = ImageDraw.Draw(im, "RGBA")
    f = font(15)
    for k in range(1, 20):
        v = k / 20
        major = k % 2 == 0
        col = (255, 255, 0, 150) if major else (255, 255, 255, 70)
        d.line([(v * 768, 0), (v * 768, 1152)], fill=col, width=1)
        d.line([(0, v * 1152), (768, v * 1152)], fill=col, width=1)
        if major:
            d.text((v * 768 + 2, 2), f"{v:.1f}", fill=(255, 255, 0, 255), font=f, stroke_width=2, stroke_fill=(0, 0, 0))
            d.text((2, v * 1152 + 2), f"{v:.1f}", fill=(255, 255, 0, 255), font=f, stroke_width=2, stroke_fill=(0, 0, 0))
    im.save(QA / "08-grid.jpg", quality=80)
    # Profondeur avec la même grille (petite).
    dm = Image.fromarray((depth6() * 255).astype(np.uint8)).convert("RGB").resize((384, 576), Image.BILINEAR)
    d = ImageDraw.Draw(dm, "RGBA")
    for k in range(1, 10):
        v = k / 10
        d.line([(v * 384, 0), (v * 384, 576)], fill=(255, 80, 80, 160))
        d.line([(0, v * 576), (384, v * 576)], fill=(255, 80, 80, 160))
    dm.save(QA / "08-grid-depth.jpg", quality=80)


def paste_sprite(canvas: Image.Image, path, x: float, y: float, scale: float, anchor="bottom") -> None:
    sp = Image.open(path).convert("RGBA")
    h = max(4, round(scale * H))
    w = max(1, round(sp.width * h / sp.height))
    sp = sp.resize((w, h), Image.LANCZOS)
    px, py = round(x * W - w / 2), round(y * H - (h if anchor == "bottom" else h / 2))
    canvas.alpha_composite(sp, (px, py))


def check() -> None:
    pl = read_json(PIPE / "placements.json")
    dep = depth6()
    mk = masks()
    warnings = []

    def resolve(p: dict, kind: str) -> dict:
        out = {"x": round(p["x"], 4), "y": round(p["y"], 4), "depth": round(sample(dep, p["x"], p["y"]), 3)}
        if "scale" in p:
            out["scale"] = p["scale"]
        if mk is not None:
            water, sky = sample(mk[..., 0], p["x"], p["y"], 3), sample(mk[..., 3], p["x"], p["y"], 3)
            if water > 0.3 or sky > 0.3:
                warnings.append(f"{kind} ({p['x']:.3f}, {p['y']:.3f}) : eau {water:.2f}, ciel {sky:.2f} — {p.get('note', '')}")
        return out

    res = {
        "anchors": [resolve(a, "ancre") for a in pl["anchors"]],
        "kodamaSpots": [resolve(k, "kodama") for k in pl["kodamaSpots"]],
        "creatureSpots": {cid: resolve(c, cid) for cid, c in pl["creatureSpots"].items()},
        "guardianSpot": resolve(pl["guardianSpot"], "gardien"),
        "lightSource": {"x": pl["lightSource"]["x"], "y": pl["lightSource"]["y"]},
    }
    write_json(res, WORK / "placements.resolved.json")
    for w in warnings:
        print("ATTENTION", w)

    canvas = stage6().convert("RGBA")
    sprites = ASSETS / "sprites"
    # Gardien (semi-transparent : il se dévoile dans la brume).
    g = pl["guardianSpot"]
    ghost = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    paste_sprite(ghost, sprites / "guardian.webp", g["x"], g["y"], g["scale"])
    ghost.putalpha(Image.fromarray((np.asarray(ghost)[..., 3] * 0.75).astype(np.uint8)))
    canvas.alpha_composite(ghost)
    for i, k in enumerate(pl["kodamaSpots"]):
        name = k.get("sprite", f"kodama-{i % 8 + 1}")
        paste_sprite(canvas, sprites / f"{name}.webp", k["x"], k["y"], k["scale"])
    for cid, c in pl["creatureSpots"].items():
        paste_sprite(canvas, sprites / f"{cid}.webp", c["x"], c["y"], c["scale"])
    d = ImageDraw.Draw(canvas, "RGBA")
    f = font(22)
    ls = pl["lightSource"]
    lx, ly = ls["x"] * W, ls["y"] * H
    for ang in np.linspace(-0.5, 0.5, 5):
        d.line([(lx, ly), (lx + np.sin(ang + 0.35) * 900, ly + np.cos(ang + 0.35) * 900)], fill=(255, 230, 160, 60), width=6)
    d.ellipse([lx - 18, ly - 18, lx + 18, ly + 18], outline=(255, 220, 120, 255), width=4)
    cols = {"a": (220, 230, 255), "b": (255, 150, 80), "both": (255, 215, 120)}
    for i, (a, r) in enumerate(zip(pl["anchors"], res["anchors"])):
        x, y = a["x"] * W, a["y"] * H
        c = list(cols.values())[i % 3]
        rad = 7 + 9 * r["depth"]
        d.ellipse([x - rad * 2.2, y - rad * 2.2, x + rad * 2.2, y + rad * 2.2], fill=c + (50,))
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=c + (230,), outline=(0, 0, 0, 255), width=2)
        d.text((x + rad + 3, y - 12), f"{i} {r['depth']:.2f}", fill=(255, 255, 255, 255), font=f, stroke_width=3, stroke_fill=(0, 0, 0))
    for name, p in [("gardien", pl["guardianSpot"])] + [(cid, c) for cid, c in pl["creatureSpots"].items()]:
        x, y = p["x"] * W, p["y"] * H
        d.line([(x - 10, y), (x + 10, y)], fill=(255, 0, 255, 255), width=3)
        d.text((x + 8, y + 2), name, fill=(255, 120, 255, 255), font=font(18), stroke_width=3, stroke_fill=(0, 0, 0))
    for i, k in enumerate(pl["kodamaSpots"]):
        x, y = k["x"] * W, k["y"] * H
        d.text((x + 8, y + 2), f"k{i}", fill=(160, 255, 160, 255), font=font(18), stroke_width=3, stroke_fill=(0, 0, 0))
    # Zone visible du héros mobile (390×528 px, cadrage « cover » autour du
    # cèdre) : le bas passe sous le bord fondu de la feuille vers y ≈ 0,80.
    for yy, txt in ((0.8, "bord de la feuille (mobile)"), (0.864, "bas du canvas (mobile)")):
        for x0 in range(0, W, 24):
            d.line([(x0, yy * H), (x0 + 12, yy * H)], fill=(255, 255, 255, 170), width=2)
        d.text((8, yy * H - 22), txt, fill=(255, 255, 255, 220), font=font(16), stroke_width=3, stroke_fill=(0, 0, 0))
    canvas.convert("RGB").resize((768, 1152), Image.LANCZOS).save(QA / "08-check.jpg", quality=82)
    # Les mêmes points sur les stades 1, 3 et 7 (le cèdre change : rien ne doit
    # flotter dans le vide), bande utile y 0,30–0,80.
    tiles = []
    for st in (1, 3, 7):
        im = Image.open(WORK / "aligned" / f"{STAGE_SOURCES[st]}.png").convert("RGBA")
        for i, k in enumerate(pl["kodamaSpots"]):
            paste_sprite(im, sprites / f"{k.get('sprite', f'kodama-{i % 8 + 1}')}.webp", k["x"], k["y"], k["scale"])
        for cid, c in pl["creatureSpots"].items():
            paste_sprite(im, sprites / f"{cid}.webp", c["x"], c["y"], c["scale"])
        dd = ImageDraw.Draw(im, "RGBA")
        for a in pl["anchors"]:
            x, y = a["x"] * W, a["y"] * H
            dd.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(255, 220, 140, 200), outline=(0, 0, 0, 255), width=2)
        tiles.append(im.convert("RGB").crop((0, int(0.3 * H), W, int(0.8 * H))).resize((512, 384), Image.LANCZOS))
    sheet = Image.new("RGB", (512 * 3, 384))
    for i, t in enumerate(tiles):
        sheet.paste(t, (512 * i, 0))
    sheet.save(QA / "08-check-stages.jpg", quality=80)
    # Zoom sur la moitié basse (sprites lisibles).
    canvas.convert("RGB").crop((0, 640, 1024, 1536)).resize((768, 672), Image.LANCZOS).save(QA / "08-check-low.jpg", quality=84)
    print(f"{len(res['anchors'])} ancres, {len(res['kodamaSpots'])} kodama, {len(res['creatureSpots'])} créatures")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "grid":
        draw_grid()
    else:
        check()
