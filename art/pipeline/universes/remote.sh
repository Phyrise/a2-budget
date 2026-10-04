#!/usr/bin/env bash
# Pipeline « univers » (Budget = Chihiro, Courses = Kiki) sur la machine de calcul.
#
#   art/pipeline/universes/remote.sh src <dossier>  # copie les PNG sources (budget-chihiro/, courses-kiki/)
#   art/pipeline/universes/remote.sh push           # copie les scripts
#   art/pipeline/universes/remote.sh run [k03 ...]  # bannières + sprites (ou planches filtrées)
#   art/pipeline/universes/remote.sh pull           # assets → apps/web/src/themes/assets (remplacés),
#                                                   # planches → art/pipeline/out/universes-qa,
#                                                   # puis régénère apps/web/src/themes/manifest.ts
#   art/pipeline/universes/remote.sh all            # push + run + pull
#
# Variables : A2ART_HOST (défaut shono), A2U_REMOTE (défaut a2art/universes, relatif au $HOME distant).
set -euo pipefail

HOST="${A2ART_HOST:-shono}"
REMOTE="${A2U_REMOTE:-a2art/universes}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PY="\$HOME/a2art/env/bin/python"

src() {
  ssh "$HOST" "mkdir -p ~/$REMOTE/src"
  scp -q "$1"/budget-chihiro/b0*.png "$1"/courses-kiki/k0*.png "$HOST:$REMOTE/src/"
}

push() {
  ssh "$HOST" "mkdir -p ~/$REMOTE/scripts ~/$REMOTE/out"
  scp -q "$HERE"/*.py "$HOST:$REMOTE/scripts/"
}

run() {
  local cmd="cd ~/$REMOTE/scripts && export A2U_ROOT=~/$REMOTE"
  if [ $# -eq 0 ]; then
    cmd="$cmd && rm -rf ../out && $PY -u banners.py && $PY -u sprites.py && $PY -u qa_edges.py"
  else
    cmd="$cmd && $PY -u sprites.py $*"
  fi
  ssh "$HOST" "$cmd" < /dev/null
}

pull() {
  local assets="$REPO/apps/web/src/themes/assets"
  rm -rf "$assets"
  mkdir -p "$assets" "$REPO/art/pipeline/out/universes-qa"
  # Une seule archive par dossier (bien plus rapide que scp fichier par fichier).
  ssh "$HOST" "tar -C ~/$REMOTE/out/assets -cf - ." | tar -C "$assets" -xf -
  ssh "$HOST" "tar -C ~/$REMOTE/out/qa -cf - ." | tar -C "$REPO/art/pipeline/out/universes-qa" -xf -
  scp -q "$HOST:$REMOTE/out/report.json" "$HERE/report.json"
  python3 "$HERE/gen_manifest.py"
}

case "${1:-}" in
  src) src "$2" ;;
  push) push ;;
  run) shift; run "$@" ;;
  pull) pull ;;
  all) push; run; pull ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
