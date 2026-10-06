"""Chemins et mise en place du pipeline V4 (lanternes de pierre + Calendrier Totoro).

Réutilise les outils du pipeline « univers » (../universes/ucommon.py,
sprites.py) : on fixe A2U_ROOT AVANT de les importer, vers un dossier de
travail local non versionné (art/pipeline/out/v4) :

  out/v4/src/        liens vers les PNG sources (dossier de génération)
  out/v4/out/assets  lanterns/*.webp, calendar/*.webp
  out/v4/out/qa      planches de contrôle
  out/v4/out/report.json

`sync.py` copie ensuite les assets dans apps/web/src/themes/assets/ et le
rapport dans art/pipeline/v4/report.json (versionné, lu par les générateurs
de manifest).

Sources : A2V4_SRC (défaut : le dossier de génération a2-home-review), avec
les sous-dossiers lanterns/ et calendar-totoro/.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
WORK = REPO / "art/pipeline/out/v4"
os.environ["A2U_ROOT"] = str(WORK)
sys.path.insert(0, str(HERE.parent / "universes"))

DEFAULT_SRC = Path.home() / (".codex/.chatgpt-projects/g-p-6abe6e70e194819196e3c831fb996227/"
                             "work/a2-home-review")
GEN = Path(os.environ.get("A2V4_SRC", DEFAULT_SRC))

SOURCES = {
    "l01-lanterns-unlit.png": "lanterns",
    "l02-lanterns-lit.png": "lanterns",
    "l03-kodama-on-lantern.png": "lanterns",
    "t01-busstop-landscape.png": "calendar-totoro",
    "t02-busstop-portrait.png": "calendar-totoro",
    "t03-totoro-sheet.png": "calendar-totoro",
    "t04-catbus-sheet.png": "calendar-totoro",
    "t05-event-icons.png": "calendar-totoro",
}


def stage_sources() -> None:
    """Crée out/v4/src/<fichier> → lien vers la source (idempotent)."""
    src = WORK / "src"
    src.mkdir(parents=True, exist_ok=True)
    for name, sub in SOURCES.items():
        target = GEN / sub / name
        if not target.exists():
            raise SystemExit(f"source manquante : {target}")
        link = src / name
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(target)


stage_sources()

import ucommon  # noqa: E402  (après A2U_ROOT)

ASSETS, QA, REPORT = ucommon.ASSETS, ucommon.QA, ucommon.REPORT
REPO_ASSETS = REPO / "apps/web/src/themes/assets"
REPO_REPORT = HERE / "report.json"


def read_report() -> dict:
    return json.loads(REPORT.read_text()) if REPORT.exists() else {}
