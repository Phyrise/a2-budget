"""Chemins et utilitaires du pipeline des saisons (printemps, automne, hiver).

Arborescence sur la machine de calcul (racine $A2S_ROOT, défaut ~/a2art/seasons) :
  src/forest/   <saison>-stage-{1..7}.png, <saison>-night.png (1024×1536)
  src/banners/  b-bathhouse-<saison>-<cadre>.png, k-koriko-<saison>-<cadre>.png
  base/         masks.png, masks-light.png (copie des masques livrés, pour les planches)
  pipeline/     ces scripts (+ copie des scripts de base, importés par s02/s03)
  work/         recalages, profondeurs brutes, rapports JSON
  qa/           planches de contrôle
Le pipeline de base (art/pipeline, racine ~/a2art) fournit :
  ~/a2art/out/work/aligned/<source>.png   stades de base recalés sur le stade 6
  ~/a2art/out/work/depth/raw-<n>.npy      profondeurs de base (échelle du stade 6)
Sorties livrées :
  ~/a2art/out/assets/seasons/<saison>/    forêt (récupérées aussi par remote.sh pull de base)
  $A2S_ROOT/out/themes/seasons/           bandeaux Budget / Courses
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(os.path.expanduser(os.environ.get("A2S_ROOT", "~/a2art/seasons")))
BASE = Path(os.path.expanduser(os.environ.get("A2ART_ROOT", "~/a2art")))
SRC = ROOT / "src" / "forest"
SRC_BANNERS = ROOT / "src" / "banners"
WORK = ROOT / "work"
QA = ROOT / "qa"
BASE_ALIGNED = BASE / "out" / "work" / "aligned"
BASE_DEPTH = BASE / "out" / "work" / "depth"
WORLD_OUT = BASE / "out" / "assets" / "seasons"
THEMES_OUT = ROOT / "out" / "themes" / "seasons"
MASKS = ROOT / "base"
PIPE = Path(__file__).resolve().parent

for d in (WORK, QA, WORLD_OUT, THEMES_OUT):
    d.mkdir(parents=True, exist_ok=True)

# Le pipeline de base (common.py, 02_depth.py, 04_luts.py) est copié dans base/
# par remote.sh push : s02 et s03 en importent les fonctions telles quelles.
sys.path.insert(0, str(PIPE / "base"))

W, H = 1024, 1536
MW, MH = 512, 768
SEASONS = ["spring", "autumn", "winter"]
# growthStage → peinture de base (même table que common.STAGE_SOURCES).
BASE_STAGES = {
    1: "05-growth-0",
    2: "05-growth-1",
    3: "05-growth-2",
    4: "05-growth-3",
    5: "05-growth-4",
    6: "01-master-portrait",
    7: "05-growth-6",
}
BASE_NIGHT = "04-pause-night"
# Seuils de réutilisation de la profondeur de base (cf. README).
MAX_DRIFT_PX = 2.0
MAX_DEPTH_MAE = 0.035
MAX_DEPTH_CHANGED = 0.03  # part des pixels dont la profondeur bouge de > 0,12


def src_name(season: str, stage: int | str) -> str:
    return f"{season}-night" if stage == "night" else f"{season}-stage-{stage}"


def base_name(stage: int | str) -> str:
    return BASE_NIGHT if stage == "night" else BASE_STAGES[int(stage)]


def items():
    """(saison, stade) pour toutes les peintures de saison : 7 stades + nuit."""
    for s in SEASONS:
        for n in list(range(1, 8)) + ["night"]:
            yield s, n


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def aligned_path(season: str, stage) -> Path:
    return WORK / "aligned" / f"{src_name(season, stage)}.png"


def load_aligned(season: str, stage) -> np.ndarray:
    return load_rgb(aligned_path(season, stage))


def load_base(stage) -> np.ndarray:
    return load_rgb(BASE_ALIGNED / f"{base_name(stage)}.png")


def to_u8(a: np.ndarray) -> np.ndarray:
    return np.clip(np.round(a * 255.0), 0, 255).astype(np.uint8)


def write_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False))


def read_json(path: Path):
    return json.loads(path.read_text())


def label(im: Image.Image, text: str) -> Image.Image:
    im = im.convert("RGB").copy()
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 8 + 6 * len(text), 14], fill=(0, 0, 0))
    d.text((4, 1), text, fill=(255, 255, 255))
    return im


def grid(images: list[Image.Image], cols: int, bg=(20, 20, 20)) -> Image.Image:
    w = max(i.width for i in images)
    h = max(i.height for i in images)
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * h), bg)
    for k, im in enumerate(images):
        sheet.paste(im.convert("RGB"), ((k % cols) * w, (k // cols) * h))
    return sheet


def tile(a: np.ndarray, w: int) -> Image.Image:
    im = Image.fromarray(a if a.dtype == np.uint8 else to_u8(a))
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
