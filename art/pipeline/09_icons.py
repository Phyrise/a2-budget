"""Icônes PWA et favicon, à partir d'un recadrage du cèdre (stade 6).

  icons/icon-192.png, icons/icon-512.png : plein cadre (le système arrondit) ;
  icons/icon-maskable-512.png             : recadrage plus large — le tronc, la
                                            corde sacrée et « A² » tiennent dans
                                            le cercle de sécurité (rayon 40 %) ;
  icons/apple-touch-icon.png (180)        : plein cadre, opaque ;
  favicon.svg                             : SVG valide (coins arrondis) qui
                                            embarque un PNG 64×64 en data URI.

« A² » ivoire en Fraunces (axe optique 144, graisse 480, doux), posé sur un
léger dégradé sombre en bas de l'image. La police est convertie depuis le
paquet @fontsource-variable/fraunces (woff2 → ttf, fontTools) dans
$A2ART_ROOT/fonts/Fraunces-full.ttf.

Sorties : out/icons/*.png, out/favicon.svg, planche out/qa/09-icons.jpg.
"""
from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from common import ICONS, OUT, QA, ROOT, STAGE_SOURCES, WORK, grid, label

IVORY = (244, 239, 226)
INK = (7, 13, 10)
FONT = ROOT / "fonts" / "Fraunces-full.ttf"

# Recadrages carrés (cx, cy, côté) en pixels du cadrage 1024×1536 du stade 6 :
# le tronc avec la corde sacrée (shimenawa), un peu de canopée et de racines.
CROP_FULL = (612, 560, 760)
CROP_MASKABLE = (600, 600, 1000)
CROP_FAVICON = (630, 560, 560)


def fraunces(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([144, 480, 60, 0])  # opsz, wght, SOFT, WONK
    except OSError:
        pass
    return f


def crop(src: Image.Image, c: tuple[int, int, int], size: int) -> Image.Image:
    cx, cy, side = c
    x0 = max(0, min(src.width - side, cx - side // 2))
    y0 = max(0, min(src.height - side, cy - side // 2))
    im = src.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)
    # Léger rehaussement local (la réduction adoucit la peinture).
    return im.filter(ImageFilter.UnsharpMask(radius=max(1, size // 256), percent=60, threshold=2))


def shade(im: Image.Image, top: float, strength: float, vignette: float = 0.22) -> Image.Image:
    """Dégradé sombre en bas (lisibilité du texte) + vignette douce."""
    w, h = im.size
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    xx = np.linspace(-1, 1, w, dtype=np.float32)[None, :]
    t = np.clip((yy - top) / (1 - top), 0, 1)
    k = 1 - strength * (t * t * (3 - 2 * t))
    r = np.sqrt(xx**2 + ((yy - 0.5) * 2) ** 2)
    k = k * (1 - vignette * np.clip(r - 0.55, 0, 1) ** 1.5)
    ink = np.array(INK, np.float32) / 255.0
    out = a * k[..., None] + ink * (1 - k[..., None]) * 0.6
    return Image.fromarray(np.clip(np.round(out * 255), 0, 255).astype(np.uint8))


def draw_mark(im: Image.Image, cy: float, height: float, glow: bool = True) -> Image.Image:
    """« A² » centré horizontalement ; `cy` = centre vertical, `height` = hauteur
    de la capitale, en fractions du côté."""
    w, h = im.size
    size = max(8, round(height * h / 0.7))  # hauteur de capitale ≈ 0,7 em

    def ink(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
        """Glyphe rendu puis rogné à son encre (boîtes de métrique peu fiables
        avec les axes variables)."""
        pad = font.size
        tmp = Image.new("L", (font.size * 3, font.size * 3), 0)
        ImageDraw.Draw(tmp).text((pad, pad), text, font=font, fill=255)
        return tmp.crop(tmp.getbbox())

    a = ink("A", fraunces(size))
    # Exposant : un « 2 » ordinaire réduit (le glyphe « ² » est déjà petit),
    # ≈ 52 % de la capitale, haut aligné sur l'apex, glissé contre le flanc
    # droit du A (qui est étroit en haut).
    s = ink("2", fraunces(round(size * 0.5)))
    tuck = round(a.width * 0.16)
    total = a.width - tuck + s.width
    x = round((w - total) / 2)
    y = round(cy * h - a.height / 2)
    mask = Image.new("L", im.size, 0)
    mask.paste(a, (x, y))
    mask.paste(s, (x + a.width - tuck, y - round(a.height * 0.04)), s)
    layer = Image.new("RGBA", im.size, IVORY + (0,))
    layer.putalpha(mask)
    out = im.convert("RGBA")
    if glow:
        sh = Image.new("RGBA", im.size, INK + (0,))
        sh.putalpha(layer.getchannel("A").filter(ImageFilter.GaussianBlur(max(1, size * 0.06))).point(lambda v: int(v * 0.75)))
        out.alpha_composite(sh)
    out.alpha_composite(layer)
    return out.convert("RGB")


def save_icon(im: Image.Image, path) -> int:
    """PNG en palette de 256 couleurs (tramage Floyd–Steinberg) : la peinture
    reste fidèle à cette taille et le fichier est 3 à 4 fois plus léger."""
    q = im.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)
    return path.stat().st_size


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main() -> None:
    src = Image.open(WORK / "aligned" / f"{STAGE_SOURCES[6]}.png").convert("RGB")
    ICONS.mkdir(parents=True, exist_ok=True)

    def full(size: int) -> Image.Image:
        im = shade(crop(src, CROP_FULL, size), top=0.52, strength=0.55)
        return draw_mark(im, cy=0.79, height=0.17)

    sizes = {"icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180}
    made = {}
    for name, s in sizes.items():
        im = full(s)
        made[name] = im
        print(name, im.size, save_icon(im, ICONS / name), "octets")

    # Maskable : contenu utile dans le cercle central de rayon 0,4 (spéc. W3C).
    m = shade(crop(src, CROP_MASKABLE, 512), top=0.5, strength=0.5, vignette=0.0)
    m = draw_mark(m, cy=0.7, height=0.13)
    made["icon-maskable-512.png"] = m
    print("icon-maskable-512.png", save_icon(m, ICONS / "icon-maskable-512.png"), "octets")

    # Favicon : SVG valide embarquant un PNG 64×64 (coins arrondis par clipPath).
    fav = shade(crop(src, CROP_FAVICON, 64), top=0.35, strength=0.65, vignette=0.3)
    fav = draw_mark(fav, cy=0.62, height=0.36)
    b64 = base64.b64encode(png_bytes(fav)).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n'
        "  <title>A² Home</title>\n"
        '  <defs><clipPath id="r"><rect width="64" height="64" rx="14"/></clipPath></defs>\n'
        '  <rect width="64" height="64" rx="14" fill="#16261d"/>\n'
        f'  <image clip-path="url(#r)" width="64" height="64" href="data:image/png;base64,{b64}"/>\n'
        "</svg>\n"
    )
    (OUT / "favicon.svg").write_text(svg)
    print("favicon.svg", len(svg), "octets")

    # Planche de contrôle : tailles réelles, masque circulaire, aperçus réduits.
    tiles = []
    for name in made:
        im = Image.open(ICONS / name).convert("RGB")  # ce qui est réellement livré
        t = im.resize((256, 256), Image.LANCZOS) if im.width != 256 else im
        tiles.append(label(t, name))
    circ = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(circ).ellipse([51, 51, 461, 461], fill=255)
    mm = Image.composite(m, Image.new("RGB", (512, 512), (30, 30, 30)), circ).resize((256, 256), Image.LANCZOS)
    tiles.append(label(mm, "maskable / cercle 80 %"))
    small = Image.new("RGB", (256, 256), (32, 33, 36))
    for i, s in enumerate((16, 32, 48, 64)):
        small.paste(fav.resize((s, s), Image.LANCZOS), (8 + i * 62 if s < 64 else 180, 96))
    tiles.append(label(small, "favicon 16/32/48/64"))
    grid(tiles, 3).save(QA / "09-icons.jpg", quality=88)


if __name__ == "__main__":
    main()
