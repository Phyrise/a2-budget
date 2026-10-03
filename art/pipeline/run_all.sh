#!/usr/bin/env bash
# Chaîne complète du pipeline d'assets, sur la machine de calcul (CPU seul).
# À lancer depuis $A2ART_ROOT/pipeline (défaut ~/a2art/pipeline) :
#   bash run_all.sh            # tout (≈ 35–45 min, dont SAM 3 ≈ 17 min)
#   SKIP_SAM=1 bash run_all.sh # réutilise out/work/sam3 (masques plus rapides)
#   SKIP_DEPTH=1 bash run_all.sh
set -euo pipefail
cd "$(dirname "$0")"

PY="${A2ART_PY:-../env/bin/python}"
SAM_PY="${A2ART_SAM_PY:-$HOME/miniconda3/envs/sam3_local/bin/python}"
export CUDA_VISIBLE_DEVICES=
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-16}"

step() {
  echo "== $*"
  local t0=$SECONDS
  "$@"
  echo "   ($((SECONDS - t0)) s)"
}

step "$PY" -u 00_overview.py
step "$PY" -u 01_align.py
[ -n "${SKIP_DEPTH:-}" ] || step "$PY" -u 02_depth.py
[ -n "${SKIP_SAM:-}" ] || step "$SAM_PY" -u sam3_segment.py
step "$PY" -u 03_masks.py
step "$PY" -u 04_luts.py
step "$PY" -u 05_sprites.py
step "$PY" -u 06_fx.py
step "$PY" -u 07_scene.py
step "$PY" -u 08_placements.py grid
step "$PY" -u 08_placements.py
step "$PY" -u 09_icons.py
step "$PY" -u 10_manifest.py
echo "TERMINÉ"
