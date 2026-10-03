#!/usr/bin/env bash
# Prépare deux builds de production pour les tests PWA (offline + update).
# - dist-v1 : la version courante.
# - dist-v2 : un rebuild avec un marqueur « v2 » dans le titre (précache différent).
# À la fin, le dist canonique (sans marqueur) est reconstruit pour `pnpm preview`.
set -euo pipefail
cd "$(dirname "$0")/.."   # apps/web

OUT=/tmp/a2-budget/pwa
rm -rf "$OUT"
mkdir -p "$OUT"

echo ">> build v1"
pnpm build
cp -r dist "$OUT/dist-v1"

echo ">> build v2 (marqueur titre)"
perl -pi -e 's#<title>A² Home</title>#<title>A² Home v2</title>#' index.html
grep -q 'A² Home v2' index.html
pnpm build
cp -r dist "$OUT/dist-v2"

echo ">> restauration du dist canonique"
git checkout -- index.html
pnpm build

echo ">> OK : $OUT/dist-v1 et $OUT/dist-v2"
