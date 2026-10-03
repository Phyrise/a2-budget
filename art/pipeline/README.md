# Pipeline d'assets du monde (A² Home)

Transforme les peintures générées (`art/source/*.png`, non versionnées) en
assets prêts pour le moteur WebGL (`apps/web/src/world/assets/`), régénère
`apps/web/src/world/manifest.ts` (contrat `WorldManifest` de
`world/types.ts`) et les icônes PWA (`apps/web/public/icons/`,
`apps/web/public/favicon.svg`).

Le calcul tourne sur la machine **shono** (CPU uniquement — les GPU sont
réservés à d'autres services), dans `~/a2art` :

```
~/a2art/
  source/     les peintures (copie de art/source/, mêmes tailles)
  pipeline/   ces scripts (copiés par remote.sh push)
  env/        Python 3.11 : torch CPU, transformers, numpy, pillow, scipy,
              opencv-python-headless, fonttools, brotli
  fonts/      Fraunces-full.ttf (converti depuis @fontsource-variable/fraunces)
  out/work/   intermédiaires (alignements, profondeurs, SAM 3, journaux, JSON)
  out/assets/ assets finaux        → apps/web/src/world/assets/
  out/icons/  icônes PWA            → apps/web/public/icons/
  out/qa/     planches de contrôle  → art/pipeline/out/ (gitignoré)
```

## Tout régénérer

```sh
# depuis la racine du dépôt (Mac)
art/pipeline/remote.sh push                       # scripts → shono
ssh shono 'cd ~/a2art/pipeline && bash run_all.sh' # ≈ 35–45 min (SAM 3 ≈ 17 min)
art/pipeline/remote.sh pull-views                 # planches réduites → art/pipeline/out/v/
art/pipeline/remote.sh pull                       # assets, icônes, manifest.ts, favicon.svg
pnpm build
```

`SKIP_SAM=1` et `SKIP_DEPTH=1` (variables de `run_all.sh`) réutilisent les
segmentations SAM 3 et les profondeurs déjà calculées (≈ 8 min au lieu de 40).
`art/pipeline/remote.sh run 05_sprites.py` exécute une seule étape.

Première installation de shono : copier `art/source/*.png` dans
`~/a2art/source/` (vérifier les tailles), créer `~/a2art/env` (venv
Python 3.11, paquets ci-dessus ; le modèle Depth Anything V2 Large se
télécharge au premier lancement), copier
`node_modules/.pnpm/@fontsource-variable+fraunces@*/…/files/fraunces-latin-full-normal.woff2`
dans `~/a2art/fonts/` puis le convertir en TTF (fontTools, cf. `09_icons.py`).
SAM 3 : dépôt `~/sam3_official`, environnement `~/miniconda3/envs/sam3_local`.

## Étapes

| Script | Rôle | Sorties |
|---|---|---|
| `00_overview.py` | Planches d'aperçu des sources (inventaire, modes, tailles). | `qa/00-*` |
| `01_align.py` | Recalage de chaque variante portrait sur le stade 6 (SIFT + RANSAC, similitude) ; rééchantillonnage seulement si la dérive dépasse 0,75 px. Dérives mesurées : ≤ 1,2 px. | `work/aligned/`, `work/align.json`, `qa/01-*` |
| `02_depth.py` | Profondeur Depth Anything V2 Large (2 passes 518/1022 px fusionnées), normalisation robuste (percentiles) sur le stade 6, autres stades calés sur la zone stable, filtre guidé, réduction 512×768, légère dilatation des marches proches. | `work/depth/stage-N.png`, `qa/02-*` |
| `sam3_segment.py` | Segmentation par concepts texte (SAM 3, CPU, env séparé) : eau, fougères, feuilles, rochers, troncs… | `work/sam3/<image>/<concept>.png` |
| `03_masks.py` | Masques RGBA 512×768 : R eau (SAM 3 affiné par la couleur), G feuillage (SAM 3 moins le rigide), B cèdre (union des changements entre stades), A trouées de lumière (clair, peu saturé, lointain, en haut). | `assets/masks.png`, `qa/03-*` |
| `04_luts.py` | LUT 3D 33³ par humeur et nuit : régression couleur par paires de pixels (master → cible recalée, images réduites et floutées), lissage laplacien dans l'espace LUT, rappel vers un repli affine global là où la peinture n'a pas de données, moindres carrés repondérés (Huber). | `assets/luts/*.png`, `work/luts.json`, `qa/04-*` |
| `05_sprites.py` | Kodama ×8, créatures ×6, gardien, compagnons (planches V3 uniquement) : découpe en grille recalée sur les creux de l'alpha, décontamination des bords, redimensionnement prémultiplié, couleurs propagées sous l'alpha nul. | `assets/sprites/*.webp`, `qa/05-*` |
| `06_fx.py` | Planche d'effets (fond noir) : plancher de bruit soustrait avec genou doux, découpe par rangées/colonnes, WebP RGBA (RGB sur noir + A = luminance normalisée). | `assets/fx/*.webp`, `qa/06-*` |
| `07_scene.py` | Couleur par stade (WebP q84), profondeur (sans perte), cadre de premier plan (alpha vérifié, liseré nettoyé), bandeaux Budget (paysage) et Courses (recadrage 3:2 de « lively »), image d'attente ≤ 3 Ko. | `assets/stages/`, `assets/depth/`, `assets/foreground.webp`, `assets/banners/`, `assets/placeholder.webp`, `qa/07-*` |
| `08_placements.py` | `grid` : peinture quadrillée pour choisir les points à l'œil ; sans argument : lit `placements.json`, ajoute la profondeur (carte du stade 6), avertit si un point tombe sur l'eau ou le ciel, dessine la planche de contrôle (sprites posés). | `work/placements.resolved.json`, `qa/08-*` |
| `09_icons.py` | Icônes PWA (192, 512, maskable 512 avec marge de sécurité, apple-touch 180) et favicon SVG (PNG 64 px embarqué) : recadrage du cèdre + « A² » ivoire en Fraunces. | `icons/*.png`, `favicon.svg`, `qa/09-icons.jpg` |
| `10_manifest.py` | Écrit `manifest.ts` : imports Vite de chaque asset, placements, formats documentés, poids total. | `out/manifest.ts` |

## Formats livrés

- **Stades** : `stages/stage-N.webp`, 1024×1536, même cadrage pour les 7
  stades (growthStage 1..7 = 05-growth-0, -1, -2, -3, -4, 01-master-portrait,
  05-growth-6).
- **Profondeur** : `depth/stage-N.webp` (ou `.png`), 512×768, gris, sans
  perte, blanc = près.
- **Masques** : `masks.png`, RGBA 512×768 **non prémultiplié** (R eau, G
  feuillage, B cèdre, A trouées de lumière).
- **LUT** : `luts/<humeur>.png`, bande 1089×33 ; pixel (x = r + 33·b, y = g),
  r, g, b ∈ 0..32 → couleur de sortie pour l'entrée (r, g, b)/32.
- **Sprites / premier plan** : WebP RGBA non prémultiplié, couleurs propagées
  sous l'alpha nul (filtrage sans halo).
- **Effets** : WebP RGBA, RGB = élément sur noir pur (additif), A = luminance
  normalisée (RGB ≤ A → utilisable en alpha prémultiplié).

## Placements

`placements.json` est édité à la main en regardant `qa/08-grid.jpg` (et la
vue zoomée de la moitié basse), puis vérifié sur `qa/08-check.jpg`. Repères :
dans le héros mobile (390×528 px, cadrage « cover » autour du cèdre), seule la
bande y ≈ 0,05–0,80 est visible ; le bas passe sous la feuille. L'emplacement
de kodama i reçoit le sprite i de `sprites.kodama` (ordre écrit par
`10_manifest.py` d'après le champ `sprite`).

## Contrôles visuels

Chaque étape écrit ses planches dans `out/qa/` ; `remote.sh pull-views` les
rapatrie réduites (≤ 900 px) dans `art/pipeline/out/v/`. Dans l'app :
`apps/web/scripts/qa-assets.mjs` (Playwright) capture le module Maison à
390×844, le labo du moteur (`world-lab.html`) et les bandeaux.
