"""Univers Totoro du Calendrier : bandeaux opaques + sprites (Totoro, Chatbus,
icônes de nature d'événement), avec les outils du pipeline « univers ».

  python3 art/pipeline/v4/totoro.py           # tout
  python3 art/pipeline/v4/totoro.py banners   # seulement les bandeaux

Sorties : out/v4/out/assets/calendar/*.webp, qa/t0*.png, qa/calendar-banner-crops.png.
"""
from __future__ import annotations

import sys

from PIL import Image, ImageDraw

import v4common  # noqa: F401  (A2U_ROOT + sources)
from banners import DESKTOP, MOBILE, PHONE, frame
from sheets import Sheet, grid
from sprites import process
from ucommon import ASSETS, QA, SRC, font, save_opaque, update_report

QUALITY = 82

# Cadrages recommandés (object-fit: cover ; object-position x %, y %) vérifiés
# sur qa/calendar-banner-crops.png : Totoro et l'abri restent dans le cadre.
BANNERS = {
    "calendar/banner-landscape.webp": ("t01-busstop-landscape.png",
                                       [("bandeau", MOBILE, (60, 40)), ("desktop", DESKTOP, (50, 55))]),
    "calendar/banner-portrait.webp": ("t02-busstop-portrait.png",
                                      [("téléphone", PHONE, (55, 50)), ("bandeau", MOBILE, (50, 36))]),
}

TOTORO = grid(["totoro-umbrella", "totoro-gift", "totoro-joy",
               "totoro-sleeping", "chu-totoro-acorns", "chibi-totoro-peek"],
              3, 2, "h", 360, "totoro", keep=60)

CATBUS = grid(["catbus-running", "catbus-waiting", "catbus-sign", "catbus-leap"],
              2, 2, "fit", 420, "catbus", keep=60)

ICONS = grid(["icon-repas", "icon-sortie", "icon-anniversaire",
              "icon-rdv", "icon-voyage", "icon-maison",
              "icon-autre", "icon-parapluie", "icon-pousse"], 3, 3, "fit", 116,
             keep=40, square=128)

SHEETS = [
    Sheet("t03-totoro-sheet.png", "calendar", TOTORO),
    Sheet("t04-catbus-sheet.png", "calendar", CATBUS),
    # L'herbe du chemin (voyage) touche celle de la maison : coupe de 2 px entre les deux.
    Sheet("t05-event-icons.png", "calendar", ICONS, cuts=[(828, 418, 830, 836)]),
]


def banners() -> None:
    report, rows = {}, []
    f = font(13)
    for out, (src, frames) in BANNERS.items():
        im = Image.open(SRC / src).convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        report[out] = save_opaque(im, ASSETS / out, QUALITY)
        print(f"  {out:34s} {im.width}×{im.height} {report[out]['bytes'] // 1024} Ko")
        tiles = []
        for label, aspect, pos in frames:
            c = im.crop(frame(im.width, im.height, aspect, pos))
            c = c.resize((round(200 * c.width / c.height), 200), Image.LANCZOS)
            ImageDraw.Draw(c).text((4, 4), f"{out} · {label} {pos}", fill=(255, 255, 255), font=f)
            tiles.append(c)
        row = Image.new("RGB", (sum(t.width + 6 for t in tiles), 200), (20, 20, 24))
        x = 0
        for t in tiles:
            row.paste(t, (x, 0))
            x += t.width + 6
        rows.append(row)
    sheet = Image.new("RGB", (max(r.width for r in rows), len(rows) * 206), (20, 20, 24))
    for i, r in enumerate(rows):
        sheet.paste(r, (0, i * 206))
    QA.mkdir(parents=True, exist_ok=True)
    sheet.save(QA / "calendar-banner-crops.png")
    update_report(report)


def main() -> None:
    only = sys.argv[1:]
    if not only or "banners" in only:
        banners()
    for sheet in SHEETS:
        if only and not any(sheet.file.startswith(p) for p in only):
            continue
        print(sheet.file)
        update_report(process(sheet))


if __name__ == "__main__":
    main()
