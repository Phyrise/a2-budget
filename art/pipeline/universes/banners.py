"""Bandeaux opaques des univers (WebP qualité ~82, pas d'agrandissement).

  paysage 1536×1024 (source native ; ~1600 px demandés, on n'agrandit pas) ;
  portrait 1024×1536.
Planche de contrôle out/qa/banners.png avec les cadrages recommandés
(bandeau mobile 390×200 et fond desktop 16:9) dessinés par-dessus.
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from ucommon import ASSETS, QA, SRC, font, save_opaque, update_report

QUALITY = 82
MAX_W = 1600

# sortie → (source, cadrage recommandé : object-position x %, y % pour le
# bandeau mobile ~200 px de haut, puis pour un fond desktop 16:9)
BANNERS = {
    "budget/banner-landscape.webp": ("b01-bathhouse-landscape.png", (60, 30), (50, 45)),
    "budget/banner-portrait.webp": ("b02-bathhouse-portrait.png", (55, 25), (50, 30)),
    "budget/scene-bridge.webp": ("b06-noface-bridge.png", (20, 55), (35, 55)),
    "courses/banner-landscape.webp": ("k01-koriko-landscape.png", (60, 15), (50, 30)),
    "courses/banner-portrait.webp": ("k02-koriko-portrait.png", (60, 22), (50, 30)),
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
    report, thumbs = {}, []
    for out, (src, mobile, desktop) in BANNERS.items():
        im = Image.open(SRC / src).convert("RGB")
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        report[out] = save_opaque(im, ASSETS / out, QUALITY)
        print(f"  {out:34s} {im.width}×{im.height} {report[out]['bytes'] // 1024} Ko")
        t = im.copy()
        t.thumbnail((480, 480))
        d = ImageDraw.Draw(t)
        d.rectangle(frame(t.width, t.height, 390 / 200, mobile), outline=(255, 80, 80), width=2)
        d.rectangle(frame(t.width, t.height, 16 / 9, desktop), outline=(80, 200, 255), width=2)
        d.text((6, 6), out, fill=(255, 255, 255), font=font(14))
        thumbs.append(t)
    W = sum(t.width for t in thumbs) + 8 * len(thumbs)
    sheet = Image.new("RGB", (W, max(t.height for t in thumbs)), (20, 20, 24))
    x = 0
    for t in thumbs:
        sheet.paste(t, (x, 0))
        x += t.width + 8
    QA.mkdir(parents=True, exist_ok=True)
    sheet.save(QA / "banners.png")
    update_report(report)


if __name__ == "__main__":
    main()
