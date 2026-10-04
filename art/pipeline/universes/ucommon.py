"""Outils communs du pipeline « univers » (Budget = Chihiro, Courses = Kiki).

Arborescence sur la machine de calcul (A2U_ROOT, défaut ~/a2art/universes) :
  src/   PNG sources (copiés depuis le dossier de génération)
  out/   assets/{budget,courses}/*.webp, qa/*.png, report.json
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(os.path.expanduser(os.environ.get("A2U_ROOT", "~/a2art/universes")))
SRC = ROOT / "src"
OUT = ROOT / "out"
ASSETS = OUT / "assets"
QA = OUT / "qa"
REPORT = OUT / "report.json"


def load_rgba(name: str) -> np.ndarray:
    """PNG source → float32 RGBA [0, 1], alpha droit (non prémultiplié)."""
    return np.asarray(Image.open(SRC / name).convert("RGBA"), dtype=np.float32) / 255.0


def decontaminate(rgba: np.ndarray) -> np.ndarray:
    """Défrangeage : la couleur des bords semi-transparents est tirée des
    pixels quasi opaques voisins (supprime le liseré clair/sombre hérité du
    fond de génération). Ne touche que les bords (≤ ~4 px des pixels opaques) :
    les voiles réellement translucides (brume, lueurs) gardent leur couleur."""
    rgb, a = rgba[..., :3], rgba[..., 3]
    w = np.clip((a - 0.6) / 0.4, 0, 1) ** 2
    est = np.zeros_like(rgb)
    got = np.zeros(a.shape, bool)
    for s in (1.2, 2.5):
        num = cv2.GaussianBlur(rgb * w[..., None], (0, 0), s)
        den = cv2.GaussianBlur(w, (0, 0), s)
        take = (~got) & (den > 0.02)
        est[take] = num[take] / den[take, None]
        got |= take
    t = np.clip((a - 0.2) / 0.65, 0, 1)[..., None]
    out = rgba.copy()
    mix = est * (1 - t) + rgb * t
    out[..., :3] = np.where(got[..., None], mix, rgb)
    return out


def bleed(rgba: np.ndarray) -> np.ndarray:
    """Propage les couleurs des bords sous l'alpha nul (pas de halo au filtrage,
    et WebKit ne voit pas de RGB noir sous les pixels transparents)."""
    out = rgba.copy()
    a = rgba[..., 3]
    m = (a > 0.01).astype(np.float32)
    num = rgba[..., :3] * m[..., None]
    filled = m > 0
    for s in (1.5, 3, 6, 12, 24, 48):
        nb = cv2.GaussianBlur(num, (0, 0), s)
        db = cv2.GaussianBlur(m, (0, 0), s)
        take = (~filled) & (db > 1e-4)
        out[..., :3][take] = nb[take] / db[take, None]
        filled |= take
    return out


def resize_premul(rgba: np.ndarray, w: int, h: int) -> np.ndarray:
    """Redimensionne en alpha prémultiplié puis dé-prémultiplie (pas de franges
    sombres) ; INTER_AREA en réduction."""
    a = rgba[..., 3:4]
    pm = np.concatenate([rgba[..., :3] * a, a], axis=2)
    interp = cv2.INTER_AREA if w < rgba.shape[1] else cv2.INTER_CUBIC
    r = np.clip(cv2.resize(pm, (w, h), interpolation=interp), 0, 1)
    al = r[..., 3:4]
    rgb = np.where(al > 1e-4, r[..., :3] / np.maximum(al, 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 1), al], axis=2)


def clean_alpha(rgba: np.ndarray, floor: float = 0.03) -> np.ndarray:
    out = rgba.copy()
    out[..., 3] = np.clip((out[..., 3] - floor) / (1 - floor), 0, 1)
    return out


def save_sprite(rgba: np.ndarray, path: Path, quality: int = 86) -> dict:
    """WebP RGBA non prémultiplié ; `exact` garde les couleurs propagées."""
    path.parent.mkdir(parents=True, exist_ok=True)
    u8 = np.clip(np.round(bleed(rgba) * 255), 0, 255).astype(np.uint8)
    im = Image.fromarray(u8, "RGBA")
    im.save(path, "WEBP", quality=quality, alpha_quality=90, method=6, exact=True)
    return {"w": im.width, "h": im.height, "bytes": path.stat().st_size}


def save_opaque(im: Image.Image, path: Path, quality: int = 82) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = im.convert("RGB")
    im.save(path, "WEBP", quality=quality, method=6)
    return {"w": im.width, "h": im.height, "bytes": path.stat().st_size}


def update_report(entries: dict) -> None:
    """Fusionne {chemin relatif: {w, h, bytes}} dans out/report.json."""
    data = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    data.update(entries)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(dict(sorted(data.items())), indent=1))


def font(size: int) -> ImageFont.ImageFont:
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              str(Path.home() / "a2art/fonts/DejaVuSans.ttf")):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def contact_sheet(items: list[tuple[str, Path]], out: Path, tile: int = 240, cols: int = 5,
                  bg=(28, 32, 40)) -> None:
    """Planche de contrôle : chaque sprite sur fond sombre, avec son nom et sa taille."""
    f = font(15)
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile, rows * (tile + 24)), bg)
    d = ImageDraw.Draw(sheet)
    for i, (name, p) in enumerate(items):
        im = Image.open(p).convert("RGBA")
        label = f"{name}  {im.width}×{im.height}"
        s = min(1.0, (tile - 16) / max(im.size))
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        x0, y0 = (i % cols) * tile, (i // cols) * (tile + 24)
        d.rectangle([x0 + 2, y0 + 2, x0 + tile - 3, y0 + tile - 3], outline=(60, 66, 80))
        sheet.paste(im, (x0 + (tile - im.width) // 2, y0 + (tile - im.height) // 2), im)
        d.text((x0 + 6, y0 + tile + 2), label, fill=(230, 230, 230), font=f)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
