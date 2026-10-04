# Pipeline « univers » — Budget (Chihiro) et Courses (Kiki)

Transforme les images générées (PNG 1536×1024 / 1024×1536, sprites à vraie
transparence) en assets WebP légers dans `apps/web/src/themes/assets/` et écrit
`apps/web/src/themes/manifest.ts` (contrat : `apps/web/src/themes/types.ts`).
L'univers Maison (forêt de Yakushima) a son propre pipeline (`art/pipeline/`).

## Sources

Dossier de génération (`…/a2-home-review/`) :

| Fichier | Contenu |
| --- | --- |
| `budget-chihiro/b01-bathhouse-landscape.png` / `b02-…-portrait.png` | maison de bains au crépuscule |
| `budget-chihiro/b03-noface-sheet.png` | Sans-Visage, 3×2 : calme, offre, repu, timide, révérence, s'efface |
| `budget-chihiro/b04-susuwatari-sheet.png` | Noiraudes, 4×2 : rose, jaune, vert, bleu à deux, saut blanc, cachée, endormie, trio |
| `budget-chihiro/b05-gold-konpeito-sheet.png` | 5×4 : 6 pépites, 3 pièces mon, 10 kompeitō |
| `budget-chihiro/b06-noface-bridge.png` | scène du pont |
| `courses-kiki/k01-koriko-landscape.png` / `k02-…-portrait.png` | Koriko |
| `courses-kiki/k03-kiki-sheet.png` | Kiki, 3×2 : vol, balayage A, B, panier, salut, liste |
| `courses-kiki/k04-jiji-basket-sheet.png` | Jiji, 3×2 (dernière case vide) |
| `courses-kiki/k05-basket-broom-sheet.png` | 3 paniers, balai, poussière, étincelles |
| `courses-kiki/k06-category-icons.png` | 9 icônes de rayons, 3×3 |

## Tout régénérer

Machine de calcul : `shono` (ssh sans mot de passe), Python
`~/a2art/env/bin/python` (Pillow, numpy, scipy, opencv). Hôte et dossier
réglables par `A2ART_HOST` / `A2U_REMOTE`.

```sh
P=art/pipeline/universes
$P/remote.sh src "/chemin/vers/a2-home-review"   # une fois : PNG → ~/a2art/universes/src
$P/remote.sh all                                 # push + bandeaux + sprites + planches + pull + manifest
```

Étape par étape : `push` (scripts), `run` (tout, ou `run k03 b05` pour
quelques planches), `pull` (remplace `apps/web/src/themes/assets/`, copie les
planches dans `art/pipeline/out/universes-qa/` — non versionné — et lance
`gen_manifest.py` en local). Sans `shono` : `pip install --user pillow numpy
scipy opencv-python-headless`, puis `A2U_ROOT=<dossier avec src/>` et lancer
`banners.py`, `sprites.py`, `qa_edges.py` à la main, copier `out/assets/*` et
`out/report.json`, puis `python3 gen_manifest.py`.

Ensuite : `pnpm typecheck && pnpm build`.

## Scripts

| Script | Rôle |
| --- | --- |
| `ucommon.py` | chemins, défrangeage, réduction en alpha prémultiplié, propagation sous l'alpha nul, export WebP, planche de contrôle |
| `banners.py` | bandeaux opaques (qualité 82, sans agrandissement) + `qa/banners.png` avec les cadrages recommandés (rouge = bandeau mobile 390×200, bleu = fond 16:9) |
| `sheets.py` | **description des planches** : case → nom, taille cible, groupe d'échelle, coupes |
| `sprites.py` | découpe par composantes connexes de l'alpha, attribution aux cases, export, `qa/<planche>.png` |
| `qa_edges.py` | `qa/edges.png` : bords agrandis ×2 sur fonds clair / sombre / coloré |
| `gen_manifest.py` | `manifest.ts` depuis `report.json` (vérifie que chaque asset existe) |

## Découpe des sprites

1. Composantes connexes de l'alpha (> 3 %, 8-connexité).
2. Chaque composante va à la case qui contient son centre de masse (boîtes de
   `sheets.py`, approximatives : elles départagent seulement).
3. Dans une case : la pose = composantes ≥ 3 % de la plus grande ; les petits
   fragments (étincelles, poussière, poils) sont gardés s'ils sont à moins de
   `keep` px de la pose (260–400 px pour les effets), le reste (≤ 2 px) est du bruit.
4. Rognage + marge, défrangeage des bords (sauf poussière / étincelles, dont le
   bord est la lueur), réduction en alpha prémultiplié puis dé-prémultiplication,
   propagation des couleurs sous l'alpha nul, WebP qualité 86 `exact`.
5. Une échelle par groupe (toutes les poses d'un personnage à la même taille) ;
   `kiki-sweep-a/b` sur la même toile (calées en bas) ; petits objets sur toile
   carrée (96 et 128 px).

Pièges connus : sur `k06`, le manche du balai (maison) passe sous la théière
(boissons) — `cuts` retire une ligne de 2 px du masque d'étiquetage. Après
toute nouvelle génération : **regarder chaque planche de contrôle** et corriger
l'ordre des noms dans `sheets.py` si la génération n'a pas suivi la grille.
