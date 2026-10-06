# Pipeline V4 — lanternes de pierre (tōrō) et univers Totoro du Calendrier

Transforme les planches générées (PNG, sprites à vraie transparence) en WebP
légers dans `apps/web/src/themes/assets/{lanterns,calendar}/` et écrit deux
manifests :

- `apps/web/src/themes/lanterns.ts` (`LANTERN_ART`, `lanternArt`,
  `KODAMA_ON_LANTERN`, `kodamaOnLantern`) — par `gen_lanterns.py` ;
- `calendarTheme` dans `apps/web/src/themes/manifest.ts` (contrat
  `CalendarTheme` de `themes/types.ts`) — par
  `art/pipeline/universes/gen_manifest.py`, étendu pour lire
  `art/pipeline/v4/report.json`.

Poids total V4 : **1,40 Mo** (46 fichiers ; lanternes 657 Ko, calendrier
775 Ko), sous le plafond de 3 Mo.

## Sources

Dossier de génération (`A2V4_SRC`, défaut `…/a2-home-review/`) :

| Fichier | Contenu |
| --- | --- |
| `lanterns/l01-lanterns-unlit.png` | 7 lanternes éteintes, grille 4×2 (case bas-droite vide) : kasuga-moss, yukimi, oribe, kotoji, tachi-carved, ancient-shrine, spirit-light |
| `lanterns/l02-lanterns-lit.png` | la même planche allumée (ambre ; bleu pâle pour spirit-light) |
| `lanterns/l03-kodama-on-lantern.png` | kodama 2×2 : assis jambes pendantes, allongé, à deux, qui salue |
| `calendar-totoro/t01-busstop-landscape.png` / `t02-…-portrait.png` | arrêt de bus sous la pluie, Totoro au parapluie |
| `calendar-totoro/t03-totoro-sheet.png` | 3×2 : parapluie-feuille, paquet-feuille, joie, endormi, Chu-Totoro aux glands, Chibi-Totoro |
| `calendar-totoro/t04-catbus-sheet.png` | Chatbus 2×2 : court, arrêté porte ouverte, ¾ face panneau vide, saut |
| `calendar-totoro/t05-event-icons.png` | 3×3 : repas, sortie, anniversaire, rdv, voyage, maison, autre, parapluie, pousse |

## Tout régénérer (en local, ~25 s)

```sh
python3 -m pip install --user --break-system-packages pillow numpy scipy opencv-python-headless
python3 art/pipeline/v4/lanterns.py   # lanternes + silhouettes + kodama + planches de contrôle
python3 art/pipeline/v4/totoro.py     # bandeaux + Totoro + Chatbus + icônes
python3 art/pipeline/v4/sync.py       # copie dans le dépôt + report.json + manifests
pnpm typecheck && pnpm build
```

Dossier de travail (non versionné) : `art/pipeline/out/v4/` — `src/` (liens
vers les sources), `out/assets/`, `out/qa/` (planches de contrôle),
`out/report.json`, `out/lanterns.json`. Les outils du pipeline « univers »
(`../universes/ucommon.py`, `sprites.py`, `banners.py`, `sheets.py`) sont
réutilisés tels quels : `v4common.py` fixe `A2U_ROOT` avant de les importer.

| Script | Rôle |
| --- | --- |
| `v4common.py` | chemins, liens vers les sources, import des outils « univers » |
| `lanterns.py` | découpe, recalage allumée → éteinte, toile commune, silhouettes, ancres, kodama |
| `v4qa.py` | planches `qa/lantern-align.png` et `qa/lantern-anchors.png` |
| `totoro.py` | bandeaux (+ `qa/calendar-banner-crops.png`) et planches t03–t05 |
| `sync.py` | copie vers `themes/assets/`, `report.json` / `lanterns.json` versionnés, lance les générateurs |
| `gen_lanterns.py` | `themes/lanterns.ts` (Python standard) |

## Lanternes

1. **Découpe** : composantes connexes de l'alpha, attribuées aux cases de la
   grille 4×2 (même méthode que `universes/sprites.py`).
2. **Recalage** de l'allumée sur l'éteinte, sur l'alpha de chaque modèle :
   corrélation de phase (translation sous-pixel), puis ECC euclidien
   initialisé par la phase, gardé seulement s'il améliore l'IoU. Décalages
   mesurés : 0,2 à 0,9 px, rotation ≤ 0,06° ; IoU de l'alpha 0,94–0,96 → 0,95–0,96
   (le reste = mèches de mousse redessinées par la génération).
3. **Allumée recomposée** « éteinte + lumière » : masque = cœur de la lumière
   ajoutée (canal le plus éclairci ≥ 25 % du max ; 8 % pour spirit-light, dont
   les glyphes du fût luisent aussi) élargi par un flou de 8 % de la hauteur.
   Hors de ce masque, les pixels sont ceux de l'éteinte : le fondu
   éteinte → allumée ne fait bouger que la lumière (IoU final de l'alpha
   0,97–0,99). Contrôle : `qa/lantern-align.png` (alpha avant / après,
   allumée brute, finale, fondu 50 %, |Δ luminance| × 4).
4. **Toile commune** aux trois états d'un modèle (union des masques),
   **échelle commune** aux sept modèles (celle de la planche, le plus haut =
   420 px utiles ; `scale` dans le manifest), marge de 6 px.
5. **Silhouette** (Carnet, modèle verrouillé) : alpha de l'éteinte flouté
   (σ 1,6 px), dégradé de brume sombre, opacité 0,94 ; aucun détail de la
   peinture. L'interface n'importe que la silhouette tant que le modèle n'est
   pas débloqué.
6. **Ancres** (coordonnées normalisées de la toile, `qa/lantern-anchors.png`) :
   - `fire` : barycentre de la lumière ajoutée (lissée, ≥ 50 % du max) —
     centre de la lueur vivante, des lucioles qui tournent la nuit ;
   - `roof` : rangée la plus large du tiers supérieur (avant-toit), x =
     centre + 25 % de sa largeur (à droite du fleuron), y = surface du toit
     dans cette colonne + 2 % de la hauteur (le kodama s'assoit dans la mousse).
7. **Kodama** : 4 sprites à la même échelle (le plus haut = 200 px utiles) ;
   `seat` = hauteur de l'assise (fraction de la toile, depuis le haut),
   mesurée à l'œil sur la planche d'ancres. Placement :
   `left = roof.x·W − w/2`, `top = roof.y·H − seat·h` ; taille conseillée :
   le plus grand kodama ≈ 0,18–0,2 × la hauteur du plus haut modèle affiché.

## Calendrier (Totoro)

- Bandeaux opaques qualité 82 : paysage 1536×1024, portrait 1024×1536.
  Cadrages recommandés (object-position), vérifiés sur
  `qa/calendar-banner-crops.png` : bandeau mobile 60 % 40 % (paysage) ou
  50 % 36 % (portrait), fond 16:9 50 % 55 %, fond téléphone 55 % 50 %.
- Totoro ×6 : une échelle pour tous (le grand Totoro au parapluie = 360 px
  utiles) — Chu et Chibi restent petits à côté. Chatbus ×4 : plus grand
  côté 420, même échelle. Icônes 128×128 (contenu ≤ 116) : `kinds` (clés =
  `CALENDAR_KINDS`) + `extras` (`umbrella`, `sprout`).
- Piège : sur t05, l'herbe du chemin (voyage) touche celle de la maison :
  `cuts` retire une colonne de 2 px du masque d'étiquetage (x 828–830).

Après toute nouvelle génération : **regarder chaque planche de contrôle**
(`out/qa/*.png`) et corriger l'ordre des noms ou les coupes si la génération
n'a pas suivi la grille.

## Intégration (côté interface)

- `lanternArt[id]` remplace le dessin au trait dès que la peinture existe :
  respecter `aspect` (toile non 3:4 : `object-fit: contain`, pied en bas) et
  `scale` pour les tailles relatives entre modèles.
- Allumage : superposer `lit` sur `unlit` (mêmes toiles) et fondre
  l'opacité ; la lueur vivante se centre sur `fire`.
- Carnet : un modèle verrouillé n'utilise que `silhouette` (jamais `unlit`
  flouté en CSS).
- Précache PWA : les nouveaux WebP entrent dans `globPatterns` (+1,4 Mo) ;
  rien à exclure (aucun fichier > 4 Mo).
