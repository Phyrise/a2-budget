# Pipeline des saisons — forêt et bandeaux des univers

La forêt de base (pluie, mousse, vert profond) est l'**été / saison des
pluies**. Ce pipeline ajoute le **printemps**, l'**automne** et l'**hiver** :
pour chaque saison, 7 stades (même cadrage que la base) et une LUT nuit. Il
ajoute aussi des bandeaux **automne / hiver** pour Budget (Chihiro) et Courses
(Kiki). Il remplit `WorldManifest.seasons` (`apps/web/src/world/manifest.ts`)
et `BudgetTheme.seasons` / `CoursesTheme.seasons`
(`apps/web/src/themes/manifest.ts`). Les contrats sont dans `world/types.ts`
(`SeasonSet`) et `themes/types.ts`.

## Hors précache : le motif `season-`

Chaque fichier livré se trouve sous un dossier `assets/seasons/`, et son nom
commence par `season-` (`season-<saison>-stage-<n>.webp`,
`season-<saison>-lut-night.png`, `season-<thème>-<saison>-<cadre>.webp`).
Vite les émet donc sous `assets/season-*-<hash>.<ext>`. La coquille les
**exclut du précache** (`injectManifest.globIgnores: ['assets/season-*']`) et
les sert depuis le cache à l'exécution : la saison en cours (stade actuel et
stade suivant) d'abord, puis la saison suivante environ 14 jours avant le
changement. Les deux manifests rappellent ce motif dans leur en-tête. Tant
que l'exclusion n'est pas en place, `pnpm build` précache les 32 fichiers, soit
environ 9,6 Mo.

## Sources

| Fichier (`…/a2-home-review/`) | Recalé sur |
| --- | --- |
| `forest-seasons/<s>/<s>-stage-{1..7}.png` (1024×1536) | stade de base n : 1 = 05-growth-0, 2 = -1, 3 = -2, 4 = -3, 5 = -4, 6 = 01-master-portrait, 7 = 05-growth-6 |
| `forest-seasons/<s>/<s>-night.png` | 04-pause-night |
| `budget-chihiro/seasons/b-bathhouse-{autumn,winter}-{landscape,portrait}.png` | — (bandeaux autonomes) |
| `courses-kiki/seasons/k-koriko-{autumn,winter}-{landscape,portrait}.png` | — |

## Régénérer

Machine de calcul : `shono` (CPU uniquement, `~/a2art/env/bin/python`).
Prérequis : le pipeline de base a déjà tourné sur l'hôte. Les scripts lisent
`~/a2art/out/work/aligned/` et `~/a2art/out/work/depth/raw-<n>.npy`.

```sh
P=art/pipeline/seasons
$P/remote.sh src "/chemin/vers/a2-home-review"  # une fois : PNG → ~/a2art/seasons/src
$P/remote.sh all       # push + s01 → s04 (≈ 15 min, dont la profondeur ≈ 11 min) + pull + manifests
$P/remote.sh views     # planches réduites + rapports JSON → art/pipeline/out/seasons-v/ (gitignoré)
pnpm typecheck && pnpm build
node apps/web/scripts/qa-saisons-assets.mjs <port>   # avec un serveur Vite sur <port>
```

- `pull` remplace `apps/web/src/{world,themes}/assets/seasons/`, puis lance
  `manifest`. Cette étape régénère les **deux** manifests :
  `10_manifest.py` tourne sur l'hôte à partir d'une copie des assets **du
  dépôt** (`~/a2art/seasons/manifest-root`), et `universes/gen_manifest.py`
  tourne en local.
- `remote.sh pull` du pipeline de base récupère aussi les saisons de la forêt
  (`~/a2art/out/assets/seasons/`). En revanche, `universes/remote.sh pull`
  remplace `themes/assets/` en entier : relancer ensuite
  `seasons/remote.sh pull`.
- Les générateurs sont facultatifs vis-à-vis des saisons. Sans dossier
  `seasons/`, le manifest produit est identique à celui de la base.

## Scripts

| Script | Rôle |
| --- | --- |
| `scommon.py` | Chemins, table des stades, seuils de réutilisation de la profondeur, planches. Les scripts de base `common.py`, `02_depth.py`, `04_luts.py` et `10_manifest.py` sont copiés dans `pipeline/base/` par `push` et importés tels quels. |
| `s01_align.py` | Recalage par SIFT sur la luminance égalisée (CLAHE), RANSAC puis LMEDS, similitude : c'est la méthode de `01_align.py`. L'image n'est rééchantillonnée que si un coin bouge de plus de 0,75 px. Le script mesure la dérive résiduelle : résidu médian, pire médiane locale sur une grille 4×6 et flot DIS aller-retour sur les bords communs. Il produit `qa/s01-edges-<s>.jpg` (bords de la base en rouge, de la saison en vert, jaune = superposés), `qa/s01-checker-<s>.jpg` (damier) et `qa/s01-zoom.jpg` (1:1 sur la cascade). |
| `s02_depth.py` | Depth Anything V2 Large, avec les passes et la fusion de `02_depth.py`. Calage linéaire sur `raw-<n>.npy` de base (échelle du stade 6) sur la zone stable, puis le même `finish`. Écart à la carte de base : MAE et part des pixels qui bougent de plus de 0,12. Planches : `qa/s02-depth-<s>.jpg` et `qa/s02-parallax.jpg` (couleur de saison avec profondeur de base ou propre, ±28 px). |
| `s03_luts.py` | LUT nuit par saison, de la maîtresse de saison (stade 6) vers la nuit de saison. Réglages de `04_luts.py`. Contrôle : écart à la cible avec la LUT de saison et avec la LUT nuit de base. Planches : `qa/s03-luts.jpg` et `qa/s03-lut-ramps.jpg`. |
| `s04_export.py` | Exports, décision sur la profondeur, planches `s04-stages-<s>`, `s04-masks`, `s04-masks-water` (masques de base sur les saisons) et `s04-banners` (cadrages réels des bandeaux). |
| `views.py` | Réduction des planches pour l'inspection. |

## Formats livrés

- **Couleur** : `world/assets/seasons/<s>/season-<s>-stage-<n>.webp`,
  1536×2304 : la peinture recalée est agrandie comme la base
  (`../upscale.py`, cache `work/upscaled/`). La qualité WebP vaut 80 par
  défaut et descend par pas de 2 jusqu'à 76 au plus bas, tant que l'image
  dépasse 600 Ko (saisons plus détaillées que la base : ≈ 640 Ko à q80).
  Moyenne obtenue : 575 Ko par image, environ 4 Mo par saison (chargée à la
  demande, stade par stade).
- **Profondeur** : la carte du stade de base est réutilisée (même import,
  donc même URL) quand trois conditions sont réunies :
  - dérive ≤ 2 px ;
  - MAE ≤ 0,035 ;
  - moins de 3 % des pixels bougent de plus de 0,12.

  Sinon, le script exporte `season-<s>-depth-<n>.(webp|png)` (512×768, sans
  perte, même échelle). **Résultat actuel : les 21 stades réutilisent la
  profondeur de base.**
- **LUT nuit** : `season-<s>-lut-night.png`, bande 1089×33, même format que
  `luts/*.png`.
- **Masques, premier plan, placements** : ceux de la base pour toutes les
  saisons.
- **Bandeaux** : `themes/assets/seasons/season-<budget|courses>-<autumn|winter>-<landscape|portrait>.webp`.
  WebP opaque qualité 82, paysage 1536×1024, portrait 1024×1536, de 300 à
  420 Ko. Mêmes cadrages recommandés que les bandeaux de base.

## Mesures (passe du 5 octobre 2026)

« Résidu » : médiane des résidus des appariements retenus après recalage.
« Locale » : pire médiane par case. « Flot » : flot dense sur les bords
communs. Le seuil de décision porte sur max(résidu, locale).

| Image | Base | Appariements (retenus) | Résidu | Locale | Flot méd. / p90 | Rééchant. (coin) | Écart profondeur (MAE / > 0,12) | Profondeur | WebP |
|---|---|---|---|---|---|---|---|---|---|
| spring-stage-1 | 05-growth-0 | 1515 (1433) | 0,56 | 0,80 | 0,48 / 0,78 | oui (1,21) | 0,017 / 1,7 % | base | q76 · 334 Ko |
| spring-stage-2 | 05-growth-1 | 1760 (1546) | 0,65 | 1,11 | 0,57 / 0,94 | oui (1,67) | 0,019 / 1,7 % | base | q76 · 340 Ko |
| spring-stage-3 | 05-growth-2 | 1890 (1796) | 0,53 | 0,80 | 0,56 / 0,83 | non (0,56) | 0,016 / 1,5 % | base | q76 · 353 Ko |
| spring-stage-4 | 05-growth-3 | 1422 (1324) | 0,54 | 0,93 | 0,46 / 0,82 | oui (1,12) | 0,018 / 1,0 % | base | q76 · 340 Ko |
| spring-stage-5 | 05-growth-4 | 1699 (1562) | 0,61 | 1,01 | 0,52 / 0,86 | oui (1,11) | 0,015 / 1,2 % | base | q76 · 353 Ko |
| spring-stage-6 | 01-master-portrait | 943 (898) | 0,60 | 0,80 | 0,39 / 0,71 | oui (0,90) | 0,021 / 2,0 % | base | q76 · 321 Ko |
| spring-stage-7 | 05-growth-6 | 1818 (1658) | 0,49 | 0,83 | 0,52 / 0,82 | non (0,57) | 0,020 / 1,8 % | base | q76 · 353 Ko |
| spring-night | 04-pause-night | 1689 (1610) | 0,51 | 0,66 | 0,73 / 1,04 | non (0,74) | — | — | cible LUT |
| autumn-stage-1 | 05-growth-0 | 2099 (1940) | 0,52 | 0,89 | 0,45 / 0,90 | non (0,63) | 0,011 / 0,1 % | base | q76 · 331 Ko |
| autumn-stage-2 | 05-growth-1 | 1970 (1821) | 0,66 | 1,03 | 0,52 / 0,85 | oui (0,90) | 0,011 / 0,1 % | base | q76 · 327 Ko |
| autumn-stage-3 | 05-growth-2 | 2142 (2035) | 0,57 | 0,80 | 0,53 / 0,79 | non (0,58) | 0,012 / 0,0 % | base | q76 · 333 Ko |
| autumn-stage-4 | 05-growth-3 | 1942 (1760) | 0,59 | 0,86 | 0,46 / 0,77 | oui (0,78) | 0,010 / 0,1 % | base | q76 · 314 Ko |
| autumn-stage-5 | 05-growth-4 | 2229 (2118) | 0,67 | 0,95 | 0,58 / 0,89 | oui (1,01) | 0,011 / 0,1 % | base | q76 · 313 Ko |
| autumn-stage-6 | 01-master-portrait | 1371 (1240) | 0,59 | 0,89 | 0,39 / 0,71 | oui (1,09) | 0,013 / 0,1 % | base | q76 · 318 Ko |
| autumn-stage-7 | 05-growth-6 | 2175 (2041) | 0,60 | 0,88 | 0,48 / 0,78 | oui (1,09) | 0,012 / 0,0 % | base | q76 · 350 Ko |
| autumn-night | 04-pause-night | 1554 (1454) | 0,55 | 0,77 | 0,51 / 0,79 | non (0,61) | — | — | cible LUT |
| winter-stage-1 | 05-growth-0 | 987 (932) | 0,53 | 0,92 | 0,75 / 1,14 | non (0,54) | 0,013 / 0,5 % | base | q80 · 315 Ko |
| winter-stage-2 | 05-growth-1 | 1184 (1071) | 0,62 | 0,94 | 0,59 / 1,09 | oui (1,48) | 0,013 / 0,9 % | base | q78 · 304 Ko |
| winter-stage-3 | 05-growth-2 | 1073 (994) | 0,53 | 0,93 | 0,47 / 1,02 | non (0,22) | 0,015 / 0,7 % | base | q76 · 324 Ko |
| winter-stage-4 | 05-growth-3 | 1077 (991) | 0,54 | 0,90 | 0,51 / 0,92 | oui (1,07) | 0,014 / 0,6 % | base | q80 · 317 Ko |
| winter-stage-5 | 05-growth-4 | 1604 (1526) | 0,46 | 0,60 | 0,35 / 0,69 | non (0,26) | 0,009 / 0,3 % | base | q76 · 303 Ko |
| winter-stage-6 | 01-master-portrait | 581 (512) | 0,56 | 0,81 | 0,56 / 1,05 | non (0,59) | 0,021 / 0,8 % | base | q78 · 316 Ko |
| winter-stage-7 | 05-growth-6 | 1194 (1120) | 0,52 | 0,76 | 0,39 / 0,71 | oui (1,07) | 0,015 / 0,8 % | base | q76 · 311 Ko |
| winter-night | 04-pause-night | 675 (595) | 0,55 | 1,02 | 0,67 / 1,12 | non (0,57) | — | — | cible LUT |

Toutes les distances sont en pixels de l'image 1024×1536 (sources, avant agrandissement).

LUT nuit : écart moyen à la cible (0..1). Le saut maximal entre nœuds voisins
vaut de 0,06 à 0,18 pour les LUT de base.

| Saison | Sans LUT | LUT nuit de base | LUT de saison | Saut max entre nœuds |
|---|---|---|---|---|
| spring | 0,197 | 0,053 | 0,033 | 0,094 |
| autumn | 0,129 | 0,050 | 0,032 | 0,106 |
| winter | 0,162 | 0,052 | 0,042 | 0,188 |

## Constats visuels

- **Recalage** : les peintures de saison sont des retouches du cadrage de base,
  donc décalées d'au plus 1,7 px avant recalage et de 1,1 px au plus après. Sur
  les planches de bords, tout est superposé (jaune), sauf les textures que la
  neige recouvre (rouge seul en hiver). Le damier ne montre aucune cassure.
- **Profondeur** : l'hiver ne change pas les silhouettes. La neige se pose sur
  les rochers et les troncs existants, et l'écart de profondeur reste ≤ 0,9 %.
  Le printemps est la saison qui s'écarte le plus (1 à 2 %). Deux zones en
  sont la cause : le massif de rhododendrons roses au premier plan à gauche, et
  le talus moussu du fond à gauche, plus clair et plus brumeux, sur lequel le
  modèle hésite. Avec une parallaxe doublée (±56 px), la profondeur de base ne
  produit ni déchirure ni halo autour des fleurs (planche zoomée vérifiée).
  Elle est donc réutilisée.
- **Masques** : l'eau (R) tombe toujours sur le ruisseau, y compris en hiver,
  où le ruisseau n'est pas gelé : la neige ne couvre que les rochers. Le
  feuillage (G) recouvre en hiver des fougères enneigées. Le vent de 1 à 2 px
  y reste plausible.
- **LUT** : la LUT nuit de base laisserait l'automne trop chaud et le printemps
  trop rose. Les LUT de saison suivent les nuits peintes. En hiver, la rampe
  d'essai montre un léger creux dans les tons désaturés moyens, d'ampleur
  comparable aux LUT d'humeur de base.
