"""Bandeaux opaques des univers (WebP qualité ~82, pas d'agrandissement).

  paysage 1536×1024 (source native ; ~1600 px demandés, on n'agrandit pas) ;
  portrait 1024×1536.
Planche de contrôle out/qa/banner-crops.png : rendu réel des cadrages
recommandés (bandeau mobile 390×200, fond desktop 16:9, fond téléphone).
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from ucommon import ASSETS, QA, SRC, font, save_opaque, update_report

QUALITY = 82
MAX_W = 1600

# Cadrages recommandés (object-fit: cover ; object-position x %, y %) :
#   « bandeau » = bandeau mobile 390×200, « desktop » = fond 16:9,
#   « téléphone » = fond plein écran 390×844. Rendus dans qa/banner-crops.png.
MOBILE, DESKTOP, PHONE = 390 / 200, 16 / 9, 390 / 844
BANNERS = {
    "budget/banner-landscape.webp": ("b01-bathhouse-landscape.png",
                                     [("bandeau", MOBILE, (50, 10)), ("desktop", DESKTOP, (50, 35))]),
    "budget/banner-portrait.webp": ("b02-bathhouse-portrait.png",
                                    [("téléphone", PHONE, (60, 50)), ("bandeau", MOBILE, (50, 18))]),
    "budget/scene-bridge.webp": ("b06-noface-bridge.png",
                                 [("bandeau", MOBILE, (50, 45)), ("desktop", DESKTOP, (50, 45))]),
    "courses/banner-landscape.webp": ("k01-koriko-landscape.png",
                                      [("bandeau", MOBILE, (50, 8)), ("desktop", DESKTOP, (50, 20))]),
    "courses/banner-portrait.webp": ("k02-koriko-portrait.png",
                                     [("téléphone", PHONE, (62, 50)), ("bandeau", MOBILE, (50, 22))]),
}


def frame(w: int, h: int, aspect: float, pos: tuple[int, int]):
    """Rectangle visible avec object-fit: cover + object-position (x %, y %)."""
    if w / h > aspect:
        cw, ch = round(h * aspect), h
    else:
        cw, ch = w, round(w / aspect)
    x = round((w - cw) * pos[0] / 100)
    y = round((h - ch) * pos[1] / 100)
    return x, y, x + cw, y + ch


def main() -> None:
    report, rows = {}, []
    f = font(13)
    for out, (src, frames) in BANNERS.items():
        im = Image.open(SRC / src).convert("RGB")
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        report[out] = save_opaque(im, ASSETS / out, QUALITY)
        print(f"  {out:34s} {im.width}×{im.height} {report[out]['bytes'] // 1024} Ko")
        # Rendu réel de chaque cadrage, à hauteur commune de 200 px.
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
    sheet.save(QA / "banner-crops.png")
    update_report(report)


if __name__ == "__main__":
    main()
