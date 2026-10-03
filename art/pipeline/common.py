"""Chemins et utilitaires partagés du pipeline d'assets A² Home.

Arborescence (sur la machine de calcul, racine $A2ART_ROOT, défaut ~/a2art) :
  source/    21 peintures PNG d'origine (non versionnées)
  pipeline/  ces scripts
  out/
    work/    intermédiaires (alignements, profondeurs pleine taille…)
    assets/  assets finaux → apps/web/src/world/assets/
    icons/   icônes PWA → apps/web/public/icons/
    qa/      planches de contrôle → art/pipeline/out/ (local, gitignoré)
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(os.environ.get("A2ART_ROOT", Path.home() / "a2art"))
SRC = ROOT / "source"
OUT = ROOT / "out"
WORK = OUT / "work"
ASSETS = OUT / "assets"
ICONS = OUT / "icons"
QA = OUT / "qa"
PIPE = Path(__file__).resolve().parent

for d in (WORK, ASSETS, ICONS, QA):
    d.mkdir(parents=True, exist_ok=True)

# Taille de référence du cadrage portrait.
W, H = 1024, 1536
# Taille des cartes (profondeur, masques).
MW, MH = 512, 768

# growthStage (1..7) → peinture source.
STAGE_SOURCES: dict[int, str] = {
    1: "05-growth-0",
    2: "05-growth-1",
    3: "05-growth-2",
    4: "05-growth-3",
    5: "05-growth-4",
    6: "01-master-portrait",
    7: "05-growth-6",
}
MASTER_STAGE = 6

LUT_TARGETS: dict[str, str] = {
    "quiet": "03-vitality-quiet",
    "peaceful": "03-vitality-peaceful",
    "lively": "03-vitality-lively",
    "flourishing": "03-vitality-flourishing",
    "night": "04-pause-night",
}


def load_rgb(name: str) -> np.ndarray:
    """Charge une source en float32 RGB 0..1."""
    im = Image.open(SRC / f"{name}.png").convert("RGB")
    return np.asarray(im, dtype=np.float32) / 255.0


def load_rgba(name: str) -> np.ndarray:
    im = Image.open(SRC / f"{name}.png").convert("RGBA")
    return np.asarray(im, dtype=np.float32) / 255.0


def to_u8(a: np.ndarray) -> np.ndarray:
    return np.clip(np.round(a * 255.0), 0, 255).astype(np.uint8)


def save_png(a: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    arr = a if a.dtype == np.uint8 else to_u8(a)
    Image.fromarray(arr).save(path, optimize=True)


def save_webp(a: np.ndarray | Image.Image, path: Path, quality: int = 84, lossless: bool = False) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = a if isinstance(a, Image.Image) else Image.fromarray(a if a.dtype == np.uint8 else to_u8(a))
    kw: dict = {"method": 6}
    if lossless:
        kw.update(lossless=True, quality=100)
    else:
        kw.update(quality=quality)
        if im.mode == "RGBA":
            kw.update(alpha_quality=100, exact=False)
    im.save(path, "WEBP", **kw)
    return path.stat().st_size


def aligned_path(name: str) -> Path:
    """Version recalée sur le master (créée par 01_align.py)."""
    return WORK / "aligned" / f"{name}.png"


def load_aligned(name: str) -> np.ndarray:
    p = aligned_path(name)
    if not p.exists():
        return load_rgb(name)
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) / 255.0


def write_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False))


def read_json(path: Path):
    return json.loads(path.read_text())


def thumb(a: np.ndarray, w: int) -> Image.Image:
    im = Image.fromarray(a if a.dtype == np.uint8 else to_u8(a))
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)


def label(im: Image.Image, text: str) -> Image.Image:
    from PIL import ImageDraw

    im = im.convert("RGB").copy()
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 8 + 7 * len(text), 16], fill=(0, 0, 0))
    d.text((4, 2), text, fill=(255, 255, 255))
    return im


def grid(images: list[Image.Image], cols: int, bg=(20, 20, 20)) -> Image.Image:
    w = max(i.width for i in images)
    h = max(i.height for i in images)
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * h), bg)
    for k, im in enumerate(images):
        sheet.paste(im.convert("RGB"), ((k % cols) * w, (k // cols) * h))
    return sheet


def bands(profile: np.ndarray, count: int, min_len: int = 4, margin: int = 8) -> list[tuple[int, int]]:
    """Découpe un profil de projection (somme d'un masque par ligne ou colonne)
    en exactement `count` plages de contenu [début, fin).

    Plages = suites de valeurs > 0 ; les miettes (< min_len) sont ignorées ;
    s'il y en a trop, on fusionne les deux plages les plus proches ; s'il en
    manque, on coupe la plus longue à son creux intérieur.
    """
    p = np.asarray(profile, dtype=np.float64)
    runs: list[list[int]] = []
    start = None
    for i, v in enumerate(p):
        if v > 0 and start is None:
            start = i
        elif v <= 0 and start is not None:
            runs.append([start, i])
            start = None
    if start is not None:
        runs.append([start, len(p)])
    runs = [r for r in runs if r[1] - r[0] >= min_len]
    while len(runs) > count:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i] = [runs[i][0], runs[i + 1][1]]
        del runs[i + 1]
    while len(runs) < count:
        i = int(np.argmax([r[1] - r[0] for r in runs]))
        s, e = runs[i]
        if e - s < 2 * margin + 2:
            raise ValueError("plage trop courte pour être coupée")
        inner = p[s + margin : e - margin]
        c = s + margin + int(np.argmin(inner))
        runs[i : i + 1] = [[s, c], [c, e]]
    return [(int(a), int(b)) for a, b in runs]


def cuts_from_bands(b: list[tuple[int, int]], n: int) -> list[int]:
    """Coupes [0, milieux des intervalles…, n] entre plages consécutives."""
    return [0] + [(b[i][1] + b[i + 1][0]) // 2 for i in range(len(b) - 1)] + [n]
