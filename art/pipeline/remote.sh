#!/usr/bin/env bash
# Pilote le pipeline sur la machine de calcul (CPU uniquement).
#
#   art/pipeline/remote.sh push              # copie les scripts (*.py, *.json, *.sh)
#   art/pipeline/remote.sh run 02_depth.py   # exécute un script (après push)
#   art/pipeline/remote.sh all               # push + run_all.sh + pull
#   art/pipeline/remote.sh pull-qa           # planches de contrôle → art/pipeline/out/qa
#   art/pipeline/remote.sh pull-views        # planches réduites (≤ 900 px) → art/pipeline/out/v
#   art/pipeline/remote.sh pull              # assets → apps/web/src/world/assets (remplacé en entier),
#                                            # icônes → public/icons, manifest.ts, favicon.svg
#
# Variables : A2ART_HOST (défaut shono), A2ART_REMOTE (défaut ~/a2art sur l'hôte).
set -euo pipefail

HOST="${A2ART_HOST:-shono}"
REMOTE="${A2ART_REMOTE:-a2art}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PY="\$HOME/$REMOTE/env/bin/python"

push() {
  ssh "$HOST" "mkdir -p ~/$REMOTE/pipeline ~/$REMOTE/out"
  scp -q "$HERE"/*.py "$HERE"/*.json "$HERE"/*.sh "$HOST:$REMOTE/pipeline/"
}

run() {
  local script="$1"; shift
  ssh "$HOST" "cd ~/$REMOTE/pipeline && OMP_NUM_THREADS=16 CUDA_VISIBLE_DEVICES= $PY -u $script $*" < /dev/null
}

pull_qa() {
  mkdir -p "$HERE/out/qa"
  scp -q -r "$HOST:$REMOTE/out/qa/." "$HERE/out/qa/"
}

pull_views() {
  ssh "$HOST" "cd ~/$REMOTE/out && mkdir -p qa_small && $PY -c '
from pathlib import Path
from PIL import Image
for p in sorted(Path(\"qa\").glob(\"*.jpg\")):
    im = Image.open(p).convert(\"RGB\")
    s = min(1.0, 900 / max(im.size))
    im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS).save(Path(\"qa_small\") / p.name, quality=74)
'"
  mkdir -p "$HERE/out/v"
  scp -q -r "$HOST:$REMOTE/out/qa_small/." "$HERE/out/v/"
}

pull() {
  local assets="$REPO/apps/web/src/world/assets"
  local icons="$REPO/apps/web/public/icons"
  # Le dossier des assets appartient au pipeline : remplacé en entier.
  rm -rf "$assets"
  mkdir -p "$assets" "$icons"
  scp -q -r "$HOST:$REMOTE/out/assets/." "$assets/"
  scp -q -r "$HOST:$REMOTE/out/icons/." "$icons/"
  scp -q "$HOST:$REMOTE/out/manifest.ts" "$REPO/apps/web/src/world/manifest.ts"
  if ssh "$HOST" "test -f ~/$REMOTE/out/favicon.svg"; then
    scp -q "$HOST:$REMOTE/out/favicon.svg" "$REPO/apps/web/public/favicon.svg"
  fi
}

case "${1:-}" in
  push) push ;;
  run) shift; run "$@" ;;
  pull-qa) pull_qa ;;
  pull-views) pull_views ;;
  pull) pull ;;
  all) push; ssh "$HOST" "cd ~/$REMOTE/pipeline && bash run_all.sh"; pull_qa; pull ;;
  *) sed -n '2,14p' "$0"; exit 1 ;;
esac
