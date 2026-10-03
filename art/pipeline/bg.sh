#!/usr/bin/env bash
# Exécute des étapes du pipeline à la suite, en arrière-plan, sur la machine de
# calcul (journal dans out/work/<journal>.log) :
#   nohup bash bg.sh <journal> 05_sprites.py "08_placements.py grid" … >/dev/null 2>&1 &
cd "$(dirname "$0")"
log="../out/work/$1.log"
shift
PY="${A2ART_PY:-../env/bin/python}"
: > "$log"
for step in "$@"; do
  echo "== $step" >> "$log"
  # shellcheck disable=SC2086
  OMP_NUM_THREADS="${OMP_NUM_THREADS:-8}" CUDA_VISIBLE_DEVICES= "$PY" -u $step >> "$log" 2>&1 || echo "ÉCHEC $step" >> "$log"
done
echo "TERMINÉ" >> "$log"
