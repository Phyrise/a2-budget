#!/usr/bin/env bash
# Pipeline des saisons (forêt printemps / automne / hiver + bandeaux Budget / Courses)
# sur la machine de calcul (CPU uniquement).
#
#   art/pipeline/seasons/remote.sh src <a2-home-review>  # PNG sources → ~/a2art/seasons/src (une fois)
#   art/pipeline/seasons/remote.sh push                  # scripts + copie des scripts de base utilisés
#   art/pipeline/seasons/remote.sh run [s01_align ...]   # étapes (défaut : s01 → s04)
#   art/pipeline/seasons/remote.sh views                 # planches réduites → art/pipeline/out/seasons-v
#   art/pipeline/seasons/remote.sh pull                  # assets → apps/web/src/{world,themes}/assets/seasons
#                                                        # (remplacés), puis les deux manifests
#   art/pipeline/seasons/remote.sh manifest              # régénère seulement les deux manifests
#   art/pipeline/seasons/remote.sh all                   # push + run + pull
#
# Variables : A2ART_HOST (défaut shono), A2S_REMOTE (défaut a2art/seasons, relatif au $HOME distant).
set -euo pipefail

HOST="${A2ART_HOST:-shono}"
REMOTE="${A2S_REMOTE:-a2art/seasons}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPE="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PY="\$HOME/a2art/env/bin/python"
WORLD="$REPO/apps/web/src/world/assets"
THEMES="$REPO/apps/web/src/themes/assets"

src() {
  local d="$1"
  ssh "$HOST" "mkdir -p ~/$REMOTE/src/forest ~/$REMOTE/src/banners ~/$REMOTE/base"
  scp -q "$d"/forest-seasons/{spring,autumn,winter}/*.png "$HOST:$REMOTE/src/forest/"
  scp -q "$d"/budget-chihiro/seasons/*.png "$d"/courses-kiki/seasons/*.png "$HOST:$REMOTE/src/banners/"
}

push() {
  ssh "$HOST" "mkdir -p ~/$REMOTE/pipeline/base ~/$REMOTE/base"
  scp -q "$HERE"/*.py "$HOST:$REMOTE/pipeline/"
  # Fonctions de base réutilisées telles quelles (profondeur, LUT, manifest).
  scp -q "$PIPE"/common.py "$PIPE"/02_depth.py "$PIPE"/04_luts.py "$PIPE"/10_manifest.py \
    "$PIPE"/placements.json "$HOST:$REMOTE/pipeline/base/"
  # Masques livrés (référence des planches de contrôle).
  scp -q "$WORLD"/masks.png "$WORLD"/masks-light.png "$HOST:$REMOTE/base/"
}

run() {
  local steps=("$@")
  [ ${#steps[@]} -gt 0 ] || steps=(s01_align s02_depth s03_luts s04_export)
  for s in "${steps[@]}"; do
    echo "== $s"
    ssh "$HOST" "cd ~/$REMOTE/pipeline && OMP_NUM_THREADS=16 CUDA_VISIBLE_DEVICES= $PY -u ${s%.py}.py" < /dev/null
  done
}

views() {
  ssh "$HOST" "cd ~/$REMOTE && mkdir -p qa_small && $PY -c '
from pathlib import Path
from PIL import Image
for p in sorted(Path(\"qa\").glob(\"*.jpg\")):
    im = Image.open(p).convert(\"RGB\")
    s = min(1.0, 1100 / max(im.size))
    im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS).save(Path(\"qa_small\") / p.name, quality=72)
'"
  mkdir -p "$PIPE/out/seasons-v"
  ssh "$HOST" "tar -C ~/$REMOTE/qa_small -cf - ." | tar -C "$PIPE/out/seasons-v" -xf -
  ssh "$HOST" "tar -C ~/$REMOTE/work -cf - align.json depth.json luts.json export.json" | tar -C "$PIPE/out/seasons-v" -xf -
}

manifest() {
  # Le manifest du monde est écrit par 10_manifest.py (numpy/Pillow, donc sur
  # l'hôte) à partir des assets DU DÉPÔT : copie de travail dans
  # ~/$REMOTE/manifest-root (A2ART_ROOT) + placements résolus de la base.
  local root="$REMOTE/manifest-root"
  ssh "$HOST" "rm -rf ~/$root && mkdir -p ~/$root/out/assets ~/$root/out/work && cp ~/a2art/out/work/placements.resolved.json ~/$root/out/work/"
  tar -C "$WORLD" -cf - . | ssh "$HOST" "tar -C ~/$root/out/assets -xf -"
  ssh "$HOST" "cd ~/$REMOTE/pipeline/base && A2ART_ROOT=~/$root $PY -u 10_manifest.py" < /dev/null
  scp -q "$HOST:$root/out/manifest.ts" "$REPO/apps/web/src/world/manifest.ts"
  python3 "$PIPE/universes/gen_manifest.py"
}

pull() {
  rm -rf "$WORLD/seasons" "$THEMES/seasons"
  mkdir -p "$WORLD/seasons" "$THEMES/seasons"
  ssh "$HOST" "tar -C ~/a2art/out/assets/seasons -cf - ." | tar -C "$WORLD/seasons" -xf -
  ssh "$HOST" "tar -C ~/$REMOTE/out/themes/seasons -cf - ." | tar -C "$THEMES/seasons" -xf -
  manifest
}

case "${1:-}" in
  src) src "$2" ;;
  push) push ;;
  run) shift; run "$@" ;;
  views) views ;;
  pull) pull ;;
  manifest) manifest ;;
  all) push; run; pull ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
