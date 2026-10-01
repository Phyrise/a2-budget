#!/usr/bin/env python3
"""Génère les icônes PWA d'A² Budget (vraies icônes locales, pas de placeholder)."""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "apps/web/public/icons")
os.makedirs(OUT, exist_ok=True)

CREAM = (247, 245, 239, 255)
GREEN = (37, 75, 61, 255)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def rounded_rect(d: ImageDraw.ImageDraw, box, radius: int, fill) -> None:
    """Carré arrondi sans dépendre de ImageDraw.rounded_rectangle."""
    x0, y0, x1, y1 = box
    r = radius
    d.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    d.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    d.pieslice([x0, y0, x0 + 2 * r, y0 + 2 * r], 180, 270, fill=fill)
    d.pieslice([x1 - 2 * r, y0, x1, y0 + 2 * r], 270, 360, fill=fill)
    d.pieslice([x0, y1 - 2 * r, x0 + 2 * r, y1], 90, 180, fill=fill)
    d.pieslice([x1 - 2 * r, y1 - 2 * r, x1, y1], 0, 90, fill=fill)


def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), CREAM)
    d = ImageDraw.Draw(img)
    if maskable:
        # Fond vert pleine surface ; contenu dans la zone sûre centrale (80 %).
        d.rectangle([0, 0, size, size], fill=GREEN)
        content = size * 0.72
    else:
        # Fond crème, carré vert arrondi en retrait.
        inset = int(size * 0.055)
        radius = int(size * 0.18)
        rounded_rect(d, [inset, inset, size - inset, size - inset], radius, GREEN)
        content = size * 0.86
    font = ImageFont.truetype(FONT_PATH, int(content * 0.46))
    text = "A²"
    w, h = d.textsize(text, font=font)
    d.text(((size - w) / 2, (size - h) / 2), text, font=font, fill=CREAM)
    return img


draw_icon(512, False).save(os.path.join(OUT, "icon-512.png"))
draw_icon(192, False).save(os.path.join(OUT, "icon-192.png"))
draw_icon(512, True).save(os.path.join(OUT, "icon-maskable-512.png"))
draw_icon(180, True).save(os.path.join(OUT, "apple-touch-icon.png"))
print("icônes écrites dans", OUT)
