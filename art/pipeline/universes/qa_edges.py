"""Planche de contrôle des bords : quelques sprites agrandis ×2 sur fond clair,
fond sombre et fond coloré (liseré, franges, halos) → out/qa/edges.png."""
from __future__ import annotations

from PIL import Image

from ucommon import ASSETS, QA

PICKS = [
    ("budget/noface-calm.webp", (20, 0, 200, 150)),
    ("budget/susuwatari-carry-pink.webp", (0, 40, 124, 170)),
    ("budget/noface-fading.webp", (0, 180, 263, 362)),
    ("courses/kiki-wave.webp", (0, 0, 208, 160)),
    ("courses/jiji-teacup.webp", (0, 0, 252, 160)),
    ("courses/dust.webp", (0, 0, 270, 210)),
]
BGS = [(245, 242, 235), (24, 28, 36), (70, 110, 150)]


def main() -> None:
    tiles = []
    for name, box in PICKS:
        im = Image.open(ASSETS / name).convert("RGBA")
        im = im.crop(box)
        im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        row = Image.new("RGB", (im.width * len(BGS), im.height))
        for i, c in enumerate(BGS):
            bg = Image.new("RGBA", im.size, c + (255,))
            bg.alpha_composite(im)
            row.paste(bg.convert("RGB"), (i * im.width, 0))
        tiles.append(row)
    W = max(t.width for t in tiles)
    sheet = Image.new("RGB", (W, sum(t.height + 6 for t in tiles)), (0, 0, 0))
    y = 0
    for t in tiles:
        sheet.paste(t, (0, y))
        y += t.height + 6
    sheet.save(QA / "edges.png")


if __name__ == "__main__":
    main()
