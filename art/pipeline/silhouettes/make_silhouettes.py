#!/usr/bin/env python3
"""Silhouettes du Carnet de la forêt (A² Home V4).

Le Carnet montre une silhouette pour chaque créature pas encore rencontrée.
Pour qu'on ne puisse pas « tricher » (appui long, clic droit, inspecteur), la
silhouette est une VRAIE image à part, générée ici à partir de la forme du
sprite : rien du dessin d'origine n'y survit (ni couleur, ni yeux, ni trait).

Recette, par sprite :
  1. alpha du sprite → fermeture morphologique (bouche les petits trous :
     yeux, reflets, interstices) ;
  2. réduction à SIL_H px de haut (2× la vignette du Carnet) ;
  3. flou gaussien léger (bords de brume, aucun détail) ;
  4. remplissage d'un ton sombre de brume, très légèrement plus clair en
     haut (lumière de canopée), alpha plafonné à 0,9.

Sortie : WebP RGBA (qualité 82, alpha 90), quelques Ko chacun, dans
apps/web/src/themes/assets/silhouettes/<id>.webp. Le petit manifeste
apps/web/src/themes/silhouettes.ts les importe (écrit à la main : 14 lignes).

Usage (depuis la racine du dépôt) :
    python3 art/pipeline/silhouettes/make_silhouettes.py
Pillow requis (local : python3 -m pip install --user pillow ;
shono : ~/a2art/env/bin/python).
"""

from __future__ import annotations

import pathlib
import sys

from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[3]
SRC = ROOT / "apps/web/src/world/assets/sprites"
OUT = ROOT / "apps/web/src/themes/assets/silhouettes"

KODAMA = [f"kodama-{i}" for i in range(1, 9)]
CREATURES = ["moss-ling", "seed-spirit", "leaf-sprite", "ember-wisp", "mushroom-pip", "water-drip"]

SIL_H = 216  # px : la vignette du Carnet fait 108 px de haut (DPR 2)
PAD = 10  # marge pour le flou
TOP = (78, 94, 87)  # brume éclairée (haut)
BOTTOM = (34, 46, 41)  # brume sombre (bas)
ALPHA_MAX = 0.9


def silhouette(src: pathlib.Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A")
    # Fermeture : dilatation puis érosion (bouche les trous, garde le contour).
    k = max(3, (min(im.size) // 40) | 1)
    closed = alpha.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    # Les petites taches très transparentes (lueurs) s'affirment un peu.
    closed = closed.point(lambda v: 0 if v < 18 else min(255, int(v * 1.25)))

    scale = SIL_H / im.height
    w = max(1, round(im.width * scale))
    small = closed.resize((w, SIL_H), Image.LANCZOS)

    canvas_a = Image.new("L", (w + 2 * PAD, SIL_H + 2 * PAD), 0)
    canvas_a.paste(small, (PAD, PAD))
    soft = canvas_a.filter(ImageFilter.GaussianBlur(2.2))
    soft = soft.point(lambda v: int(v * ALPHA_MAX))

    # Dégradé vertical de brume (aucune information du sprite d'origine).
    grad = Image.new("RGB", (1, canvas_a.height))
    for y in range(canvas_a.height):
        t = y / max(1, canvas_a.height - 1)
        grad.putpixel((0, y), tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)))
    fill = grad.resize(canvas_a.size)
    out = fill.convert("RGBA")
    out.putalpha(soft)
    # Pas de RGB parasite là où l'alpha est nul (WebKit, compression).
    bg = Image.new("RGBA", out.size, (*BOTTOM, 0))
    return Image.composite(out, bg, soft.point(lambda v: 255 if v > 0 else 0))


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for sid in KODAMA + CREATURES:
        src = SRC / f"{sid}.webp"
        if not src.exists():
            print(f"absent : {src}", file=sys.stderr)
            return 1
        dst = OUT / f"{sid}.webp"
        silhouette(src).save(dst, "WEBP", quality=82, alpha_quality=90, method=6)
        size = dst.stat().st_size
        total += size
        print(f"{sid:14s} {size / 1024:5.1f} Ko")
    print(f"total          {total / 1024:5.1f} Ko")
    # Contrôle : les pixels visibles n'ont que des tons de brume (aucune
    # couleur du sprite d'origine n'a survécu, à la compression près).
    for sid in KODAMA + CREATURES:
        im = Image.open(OUT / f"{sid}.webp").convert("RGBA")
        px = im.tobytes()
        for i in range(0, len(px), 4):
            r, g, b, a = px[i], px[i + 1], px[i + 2], px[i + 3]
            if a > 40 and not (BOTTOM[0] - 12 <= r <= TOP[0] + 12 and BOTTOM[1] - 12 <= g <= TOP[1] + 12 and BOTTOM[2] - 12 <= b <= TOP[2] + 12):
                print(f"couleur inattendue dans {sid} : {(r, g, b, a)}", file=sys.stderr)
                return 1
    print("contrôle : tons de brume uniquement")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
