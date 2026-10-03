"""Planches d'aperçu des sources (inspection visuelle, aucune sortie d'asset)."""
from __future__ import annotations

from PIL import Image

from common import QA, SRC, grid, label

names = sorted(p.stem for p in SRC.glob("*.png"))
print(len(names), "sources")
for n in names:
    im = Image.open(SRC / f"{n}.png")
    print(f"{n:28s} {im.size} {im.mode}")

portrait = [n for n in names if Image.open(SRC / f"{n}.png").size == (1024, 1536)]
thumbs = []
for n in portrait:
    im = Image.open(SRC / f"{n}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
    im = Image.alpha_composite(bg, im).convert("RGB").resize((256, 384), Image.LANCZOS)
    thumbs.append(label(im, n))
grid(thumbs, 6).save(QA / "00-overview-portrait.jpg", quality=88)

wide = [n for n in names if n not in portrait]
thumbs = []
for n in wide:
    im = Image.open(SRC / f"{n}.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
    im = Image.alpha_composite(bg, im).convert("RGB").resize((768, 512), Image.LANCZOS)
    thumbs.append(label(im, n))
grid(thumbs, 2).save(QA / "00-overview-wide.jpg", quality=88)

# Stades de croissance côte à côte, plus grands.
from common import STAGE_SOURCES

thumbs = []
for s, n in STAGE_SOURCES.items():
    im = Image.open(SRC / f"{n}.png").convert("RGB").resize((384, 576), Image.LANCZOS)
    thumbs.append(label(im, f"stage {s}: {n}"))
grid(thumbs, 4).save(QA / "00-stages.jpg", quality=88)
