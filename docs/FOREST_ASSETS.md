# Scène forêt — spécification des assets peints (raster)

## Contexte

La scène forêt de la vue **Maison** est actuellement dessinée en SVG/CSS à la main.
Après plusieurs itérations et critiques VLM (GPU3), le constat est clair :

- **L'arrière-plan** (brume, rayons de lumière, silhouettes lointaines) fonctionne
  et donne une ambiance mystique.
- **L'arbre héros** et **la créature** restent perçus comme « illustration vectorielle
  cartoon » : canopée en blobs lisses, branches illisibles dans la masse, racines posées
  dessus, esprit « sticker ».
- Critère d'Arthur : *à 390 px, la scène fixe doit donner envie de rester dessus
  quelques secondes.* Le SVG ne l'atteint pas.

**Décision** : passer à des **assets peints (PNG transparents)** composés en couches.
Le code (Qwen) gère la composition, l'animation et le color-grading ; l'artwork peint
(générateur d'image) fournit les couches ; le VLM critique le résultat.

## Architecture de la scène

La scène est une fenêtre edge-to-edge (ratio 16:11, ~390×268 px à l'écran, livrée en 2x).
Les couches, de l'arrière vers l'avant :

| # | Couche | Asset | Rôle |
|---|--------|-------|------|
| 1 | Fond | `forest-bg.png` | Sous-bois brumeux peint (silhouettes, rayons, sol) |
| 2 | Arbre | `forest-tree.png` | Grand arbre ancien, transparent, ancre de la scène |
| 3 | Brume avant | CSS/SVG | Bande de brume qui traverse devant l'arbre (profondeur) |
| 4 | Créatures | `spirit-*.png` | Petits esprits discrets, transparents |
| 5 | Premier plan | `forest-fg.png` | Fougères/feuillage qui cassent le cadre, transparent |
| 6 | Gardien | `guardian.png` | Silhouette ancienne, transparente (événement rare) |
| 7 | Lumière/brume | CSS/SVG | Rayons, lucioles, vignette, color-grading par vitalité |

Le composant `ForestScene` accepte ces PNGs (imports) et les compose en couches
positionnées. En l'absence d'un asset, il retombe sur la version SVG actuelle (fallback).

## Spécifications des assets

Tous les assets sont livrés en **PNG avec transparence** (sauf le fond), en **2x**
pour la rétine. Palette cible : vert forêt profond, sauge, mousse, ivoire chaud,
ambre doré restreint. Pas de contours durs, pas de style « sticker ».

### 1. `forest-bg.png` — fond (sous-bois brumeux)
- **Taille** : 780 × 536 px (2x de 390×268).
- **Contenu** : un sous-bois brumeux vu de face. Silhouettes d'arbres lointains
  (flous, désaturés), rayons de lumière douce traversant la brume, un sol mousseux
  en bas. **Pas d'arbre central** (l'arbre est une couche séparée).
- **Style** : peinture, atmosphérique, profondeur (perspective aérienne). Lumière
  chaude en haut, plus frais en bas.
- **Transparence** : aucune (fond plein).

### 2. `forest-tree.png` — l'arbre ancien (ancre)
- **Taille** : 560 × 560 px (2x), centré sur l'arbre.
- **Contenu** : un **grand arbre ancien**, lourd, **asymétrique**, noueux.
  - Tronc épais, tordu, avec un creux et de la mousse.
  - **Branches réellement lisibles** dans la masse du feuillage (structure visible).
  - Canopée dense, **irrégulière** (pas de blobs lisses), avec de la profondeur
    (ombres, hautes lumières).
  - **Racines intégrées au sol** (doigts de racines, terre qui s'amoncelle).
- **Style** : peinture, organique, ancien. Pas de style cartoon.
- **Transparence** : oui (fond transparent). L'arbre occupe ~70 % de la hauteur.

### 3. `forest-fg.png` — premier plan (fougères)
- **Taille** : 780 × 220 px (2x), ancré en bas.
- **Contenu** : fougères et feuillage au premier plan, en bas à gauche et à droite,
  qui **cassent le cadre** de la scène. Légèrement flous (profondeur).
- **Style** : peinture, sombre, en avant-plan.
- **Transparence** : oui.

### 4. `spirit-*.png` — petits esprits (créatures discrètes)
- **Taille** : 96 × 96 px (2x) chacun.
- **Contenu** : 2-3 petits esprits originaux du foyer (pas de mascotte).
  - Très discrets, **à peine visibles**, comme cachés derrière la mousse.
  - Pas de sourire, pas de gestes. Une présence.
  - Exemples : un petit esprit de mousse, une lueur de graine, un filet de brume.
- **Style** : peinture, doux, flou aux bords (pas de contour dur).
- **Transparence** : oui.

### 5. `guardian.png` — le gardien sylvestre (événement rare)
- **Taille** : 420 × 520 px (2x).
- **Contenu** : une silhouette ancienne et sacrée (cerf ancien / gardien sylvestre
  original), de dos ou de trois-quarts, entre les troncs. **Pas de sourire, pas de
  gestes.** Une présence qui change l'ambiance.
- **Style** : peinture, mystique, lumineux (halo doux).
- **Transparence** : oui.

## Intégration (code)

Le composant `ForestScene` :
1. Importe les PNGs (si présents).
2. Les compose en couches positionnées (CSS `position: absolute`).
3. Applique le **color-grading** par vitalité (CSS `filter` : saturate/brightness/hue).
4. Anime : balancement doux de l'arbre, dérive de la brume, lucioles, apparition du gardien.
5. Respecte `prefers-reduced-motion`.
6. **Fallback** : si un asset est absent, la couche SVG actuelle est utilisée.

## Critère de validation (gate)

À 390 px, la scène composée (assets peints) doit :
- Sembler **immédiatement ancienne / organique / mystérieuse**.
- Donner envie de **rester dessus quelques secondes**.
- Ne contenir **aucun élément « sticker »**.

Si c'est le cas → on relance les 4 vitalités, les croissances et le gardien.
Si ce n'est pas le cas → on change de stratégie artistique.

## Pipeline recommandé

- **Qwen** = code / composition / animation / color-grading
- **Générateur d'image** = artwork peint (les 5 assets ci-dessus)
- **VLM (GPU3)** = critique visuelle itérative
