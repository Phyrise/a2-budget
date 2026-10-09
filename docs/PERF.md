# Charge de l'app (V5.4) — état, marge, pistes

Mesuré le 9 octobre 2026 sur le build de production de `main` (V5.3). Rien dans l'app n'a
changé : seulement des sondes dans `apps/web/scripts/perf-*.mjs`.

## Refaire les mesures

```sh
pnpm --filter @a2/web build
cd apps/web
node scripts/perf-probe.mjs bundle                 # poids (≈ 1 s)
node scripts/perf-probe.mjs runtime                # téléphone émulé, invité (≈ 5 min)
node scripts/perf-probe.mjs runtime --cpu 1 --only tabs   # sans ralentissement
npx vite build --sourcemap --outDir /tmp/a2-map --emptyOutDir
node scripts/perf-probe.mjs composition /tmp/a2-map        # octets par source
# connecté : pnpm --filter @a2/web build:emu, émulateurs 8180/9180 sous verrou, puis
node scripts/perf-emu.mjs --months 12              # VIDE les émulateurs (≈ 10 min)
```

Chaque commande finit par une ligne `JSON:` (à garder pour comparer deux versions).

Conditions : Chromium de Playwright, 390×844, DPR 3, tactile, processeur ralenti ×4 par CDP
(≈ Android d'entrée de gamme ; un iPhone récent est plus rapide que ce Mac Intel à ×1).
GPU **matériel** (ANGLE Metal, Intel Iris Plus) : les chiffres WebGL sont réels, pas logiciels.
Foyer réaliste (`perf-household.mjs`) : 11 tâches dont Courses, ≈ 3 faits/jour, 2 courses
par semaine, 1 moment/semaine, budget mensuel, une lettre du cercle par personne et par semaine.

Limites : le CPU des processus (SystemInfo) est faussé par le ralentissement ×4 (≈ 50 %
même onglet immobile ; à ×1 : 0,1 à 1 %) — on lit donc la part du fil principal. « Arrière-plan »
est simulé (`document.hidden` + `visibilitychange`) : l'app réagit, mais le navigateur continue
de peindre ; sur un vrai téléphone, plus aucune image n'est produite. Le RSS mesuré est celui de
Chrome sur Mac (plus gros que Safari iOS).

## 1. Poids

| Morceau | brut | gzip | quand |
|---|---|---|---|
| entrée `index-*.js` | 899 Kio | 338 Kio | toujours |
| CSS | 191 Kio | 38 Kio | toujours |
| Firebase `session-*.js` | 648 Kio | 193 Kio | connecté seulement |
| moteur forêt (ogl + world) | 152 Kio | 51 Kio | Maison / fond |
| service worker | 31 Kio | 9 Kio | — |
| labo Noiraudes (DEV) | 28 Kio | 10 Kio | mode développeur |

Démarrage : 1,09 Mio brut, **376 Kio gzip**. Les onglets ne sont pas découpés : Budget
(28 Kio), Courses (21), Calendrier (38), Maison (48), rituels (62) sont dans l'entrée.
Entrée par source : react-dom 205 Kio, `themes` 82 Kio (dont **103 Kio d'images base64**
inlinées dans l'entrée : 25 petits WebP), `@a2/core` 80, `creatures` 64, `rituals` 62.

Build : 241 fichiers, 26,1 Mio. Images (famille : fichiers → décodé RGBA) :

- peintures de la forêt, saison en cours : 14 → 3,35 Mio (105 Mio décodées, max 1536×2304)
- peintures des 3 autres saisons (à la demande) : 21 → 11,8 Mio
- bandeaux Budget/Courses : 6 → 1,65 Mio ; bandeaux de saison : 8 → 2,73 Mio
- compagnons : **Jiji 10 → 112 Kio (2,2 Mio décodés)**, **Calcifer 5 → 82 Kio (1,6 Mio)**
- Kiki 102 Kio, Chat-bus 235 Kio, Totoro 72 Kio, Sans-Visage 61 Kio, Noiraudes 51 Kio
- lanternes 0,62 Mio, effets forêt 0,51 Mio, créatures 0,38 Mio, icônes PWA 0,58 Mio
- polices : 13 woff2, 565 Kio ; sons : aucun fichier (synthèse Web Audio)

Précache du service worker : **185 entrées, 9,71 Mio**. 1er chargement mesuré : 9,96 Mio
(223 requêtes : images 8,8 Mio, JS 0,6 Mio gzip, polices 0,56 Mio). Visite suivante :
**0 octet** sur le réseau.

## 2. Exécution (invité, foyer de 6 mois)

Visite suivante, jusqu'à l'écran : 0,40 s à ×1 ; 4,5 s à ×4 (1re peinture 1,37 s ; fil
4,4 s dont JS 0,9 s, style + mise en page 1,0 s, le reste = décodage et envoi des peintures).

| Fenêtre (×4) | fil occupé | images/s | rAF | tas JS | DOM |
|---|---|---|---|---|---|
| Maison (forêt animée) | **84 %** | 34 | 1 boucle, 410 dessins/s | 7,2 Mio | 669 |
| Maison au repos 60 s | 71 % | 30 | 1 | 7,4 Mio | 675 |
| Budget (Noiraudes) | 0,6 % | 0 | 0 | 8,3 Mio | 1 119 |
| Courses | 0,5 % | 0 | 0 | 6,4 Mio | 291 |
| Calendrier | 0,1 % | 0 | 0 | 7,3 Mio | 780 |
| « Immobile », Maison | **42 %** | 0 | 0 | 8,4 Mio | 684 |
| mouvement réduit, Maison | 0,2 % | 0 | 0 | 10,3 Mio | 1 346 |
| arrière-plan, Maison | 36 % (JS 0 %) | 0 | 0 | 7,3 Mio | 676 |

À ×1 : Maison 10 % du fil, 61 images/s, GPU 11 % ; les autres onglets < 1 %.

- **La forêt** est le seul coût continu : 1 boucle rAF, toile 487×660 (≈ 1,25 px/pt), 28 textures
  ≈ **40 Mio de mémoire GPU** (plus grande 1536×2304 + mipmaps), restent chargées sur les
  autres onglets. « Immobile » : 24 textures ≈ 44 Mio + toile 975×1320 (≈ 15 Mio).
- **« Immobile » n'arrête pas tout** : deux animations CSS infinies restent sur Maison,
  `ritual-breathe` (box-shadow de la carte du cercle, ≈ 21 points de fil à ×4) et
  `weekly-goal-breathe` (opacité d'un élément SVG, ≈ 15 points). Toutes deux repeignent à
  chaque image. Les mettre en pause ramène Maison immobile de 41 % à 4,6 %.
- **Arrière-plan** : l'app arrête sa boucle, ses dessins et son JS (0 rAF, 0 dessin) ;
  il ne reste que ces deux animations CSS, que le navigateur suspend sur un vrai téléphone.
- Minuteurs : 1 h (mise à jour du SW), 400 ms (Noiraudes, Budget), 60 s (Calendrier).
- RSS Chrome : rendu 250 à 315 Mio, GPU 150 à 205 Mio.

## 3. Stockage sur le téléphone

| | invité (6 mois) | connecté, AL (12 mois, a migré) | connecté, AC (a rejoint) |
|---|---|---|---|
| localStorage | 173 k car. (338 Kio) | **960 k car. (1,9 Mio)** | 321 k car. (0,6 Mio) |
| IndexedDB (cache Firestore) | — | ≈ 2,0 Mio (1 496 docs) | ≈ 1,6 Mio |
| Cache Storage | 11,2 Mio | 11,2 Mio | 11,2 Mio |
| `storage.estimate()` | 12,5 Mio | 15,2 Mio | 13,2 Mio |

Cache Storage : précache 9,71 Mio + saisons à la demande 1,26 Mio + découvertes 0,20 Mio.
Chez AL, trois copies de ≈ 319 k caractères : `sync:v1` (vivante, ≈ +320 k car./an),
`state:v1` et `backup-pre-sync` (figées, voulues : on ne perd jamais rien). Le quota
localStorage (≈ 5 Mo par origine) laisse plusieurs années, mais c'est le premier mur.

## 4. Serveur (Firestore, quotas Spark)

**Écouteurs ouverts par téléphone visible : 20** (mesuré) — 15 collections en delta, le
foyer, la fiche de l'autre (présence), **ma propre fiche (lettres)**, `play/a`, `play/b`.

Mesuré sur émulateurs (foyer de 12 mois) :

- foyer : **1 493 documents, 621 Kio** (hors index ; `completions` 940 docs / 377 Kio = 60 %).
- les deux ouverts sans rien toucher : 1 battement/min chacun ; **chaque écriture est lue
  2 fois** (par l'autre, et renvoyée à son auteur) : 10 écritures → 20 lectures en 130 s.
- un geste (ajouter un article) : 3 écritures, ≈ 9 documents reçus par téléphone.
- rejoindre (AC) : relecture complète, 2 992 docs reçus, 2,8 Mio. La réouverture d'AL a reçu
  1 497 docs : artefact du test (tout le foyer écrit en 32 s, donc dans le chevauchement de
  2 min des curseurs) ; en vrai, une réouverture coûte ≈ 20 lectures + quelques docs.
- transfert : ≈ 3 à 4 Kio/min par téléphone visible (longues interrogations + battements).

Estimation par jour (modèle `dayCost` corrigé de l'écho, gestes à 3 écritures) :

| | écritures | lectures | suppressions |
|---|---|---|---|
| journée calme (30 min visibles chacun, 10 ouvertures, 30 gestes) | ≈ 250 (1,2 %) | ≈ 950 (1,9 %) | 0 |
| grosse journée (3 h chacun, 15 ouvertures, 120 tab., 120 gestes) | ≈ 980 (4,9 %) | ≈ 2 700 (5,4 %) | 0 |
| quota Spark | 20 000 | 50 000 | 20 000 |

Dans la grosse journée, la **présence fait ≈ 60 % des écritures et des lectures** (360
battements, 60 ouvertures/fermetures, 120 onglets). Rares : resynchronisation complète tous
les 25 jours (≈ 1 500 lectures/téléphone après 1 an), point de reprise mensuel (1 écriture,
1 suppression). Stockage : ≈ 0,6 Mio/an (≈ 1,5 Mio avec index) pour 1 Gio. Transfert :
≈ 20 à 50 Mio/mois pour 10 Gio. L'app elle-même est servie par GitHub Pages, pas Firebase.

## 5. Gros postes et pistes (aucune appliquée)

1. **Deux animations CSS sous « Immobile »** (≈ 37 % du fil à ×4) : les couper sous
   `forestMotion: still` ou passer à une opacité sur une couche à part (composée). Petit
   effort, risque nul.
2. **Forêt animée** (84 % du fil à ×4, 34 im/s) : plafonner à 30 im/s quand rien ne bouge
   vite, ou baisser la toile sur les téléphones lents. Gain ≈ moitié du fil ; effort moyen.
3. **Présence** (60 % du trafic) : battement à 120 s (fenêtre « là » à 5 min) → −180
   écritures et −360 lectures/grosse journée. Écouter les lettres sans recevoir l'écho des
   battements (fiche à part `memberState/{rôle}-letters` ou champ lu à l'ouverture) → −1
   lecture par battement. Petit effort, risque faible (règles à étendre).
4. **Entrée JS** (338 Kio gzip) : sortir les 103 Kio de base64 (`assetsInlineLimit`) et
   découper Calendrier/Courses/Budget en `lazy()` → ≈ −100 Kio gzip au démarrage.
   Effort moyen, risque faible (précache inchangé).
5. **Précache** (9,7 Mio à l'installation) : ne précacher que les peintures de la saison
   en cours en 1536 px et le reste à la demande → ≈ −3 Mio. Effort moyen.
6. **Textures** (40 Mio GPU, gardées hors Maison) : les libérer hors Maison coûterait un
   rechargement au retour ; à garder tant que la mémoire tient.
7. **localStorage d'AL** : `backup-pre-sync` double `state:v1` (≈ 320 k car.) ; garder
   une seule copie figée. Petit effort, à faire avec soin (règle « jamais perdre »).

## 6. Place pour la suite

- **Un compagnon de plus** (Teto, Ponyo, Hin, Yakul) au format de Jiji/Calcifer : 5 à 10
  sprites, **80 à 120 Kio** de téléchargement (+1 % du précache), 1,5 à 2,2 Mio décodés
  quand il est affiché, 0 lecture ou écriture en plus (la présence porte déjà le rôle).
  Quatre compagnons : ≈ +0,4 Mio de précache. Négligeable.
- **Une scène de plus** façon forêt : 14 peintures ≈ 3,4 Mio par saison (×4 saisons à la
  demande) et ≈ 40 Mio GPU si elle vit en même temps que la forêt — c'est la vraie limite
  sur un téléphone modeste ; une scène en DOM/CSS comme Budget coûte ≈ 0 en continu.
- **Serveur** : marge ≈ ×18 sur les lectures et ×20 sur les écritures un gros jour.
- **Stockage** : 1 Gio Firestore ≫ 0,6 Mio/an ; sur le téléphone, le localStorage
  (≈ +0,6 Mio par an : seule `sync:v1` grandit) est le premier plafond, dans
  plusieurs années.
