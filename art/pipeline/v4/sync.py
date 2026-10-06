"""Copie les sorties V4 dans le dépôt puis régénère les manifests.

  out/v4/out/assets/{lanterns,calendar}/  → apps/web/src/themes/assets/ (dossiers remplacés)
  out/v4/out/report.json, lanterns.json   → art/pipeline/v4/ (versionnés)
  puis gen_lanterns.py (themes/lanterns.ts) et
  ../universes/gen_manifest.py (themes/manifest.ts, dont calendarTheme).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys

from v4common import ASSETS, HERE, REPO_ASSETS, REPORT, WORK

DIRS = ("lanterns", "calendar")


def main() -> None:
    for d in DIRS:
        src, dst = ASSETS / d, REPO_ASSETS / d
        if not src.is_dir():
            raise SystemExit(f"sorties manquantes : {src} (lancer lanterns.py et totoro.py)")
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"  {d:9s} {len(list(dst.glob('*.webp')))} fichiers")
    report = json.loads(REPORT.read_text())
    report = {k: v for k, v in report.items() if k.split("/")[0] in DIRS}
    (HERE / "report.json").write_text(json.dumps(dict(sorted(report.items())), indent=1))
    shutil.copy(WORK / "out/lanterns.json", HERE / "lanterns.json")
    total = sum(v["bytes"] for v in report.values()) / 1024 / 1024
    print(f"  total V4 : {total:.2f} Mo ({len(report)} fichiers)")
    subprocess.run([sys.executable, str(HERE / "gen_lanterns.py")], check=True)
    subprocess.run([sys.executable, str(HERE.parent / "universes/gen_manifest.py")], check=True)


if __name__ == "__main__":
    main()
