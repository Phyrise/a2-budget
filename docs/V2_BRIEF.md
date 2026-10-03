# A² Home V2 — brief « Yakushima »

Refonte complète de l'interface d'A² Home. **Le domaine (`packages/core`) et la
persistance (`apps/web/src/state`) sont conservés** : formules du budget,
migration V1→V2, tâches, forêt, 195 tests. On refait **tout le reste** : la
coquille, le système de design, les écrans, et une scène forêt vivante en
WebGL. L'ancienne version (Qwen) est consultable avec
`git show archive/qwen-v1:<chemin>` (ex. `apps/web/src/components/AmountInput.tsx`
pour la saisie de montants, `apps/web/src/views/SettingsView.tsx`).

## 1. Vision

On ouvre l'app et on se trouve au bord d'un sanctuaire de la forêt de
Yakushima (Shiratani Unsuikyō, la forêt de Mononoke) : un cèdre millénaire
dans la brume, mousse humide, ruisseau sombre, une lumière rare. **La forêt
respire** — la brume dérive entre les troncs, l'eau coule, un rayon pâle
pulse, des spores flottent, les fougères du premier plan bougent. Chaque tâche
faite pose une petite lumière dans la forêt, qui reste jusqu'au soir. Semaine
après semaine, le cèdre grandit (7 stades peints). La nuit (pause), la forêt
dort, éclairée par les kodama.

L'interface prolonge ce monde : **thème sombre unique**, encre presque noire
tirée du sous-bois, texte ivoire, mousse, et une seule couleur chaude — l'ambre
de la lumière (rare). Typographie : **Fraunces** (titres, grands montants,
optique douce, légèrement « éditoriale ») + **Inter** (interface, chiffres
tabulaires). Polices auto-hébergées (`@fontsource-variable/*`, déjà installées,
importées dans `styles/tokens.css`).

Exigence : **magnifique, immersif, fini** — pas un prototype. Chaque écran doit
pouvoir être capturé et montré. Détails soignés : états vides illustrés,
transitions, focus visibles, micro-interactions, typographie fine (césure,
espaces insécables avant « : ; ? ! € »), montants alignés.

## 2. Mise en page (mobile d'abord, 390×844)

```
┌──────────────────────────────┐  ← monde plein bord, sous la barre d'état
│  A² Home              ◷  ⚙   │  header ivoire sur dégradé sombre
│                              │
│      [ forêt vivante ]       │  Maison : ~54svh ; Budget/Courses : bandeau ~24svh
│  « La forêt est paisible »   │  phrase qualitative (Maison)
│▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁│
│╭────────────────────────────╮│  « feuille » : surface encre opaque, coins 30px,
││ Aujourd'hui            +   ││  bord haut fondu dans la forêt, grain papier subtil
││ ○ Arroser les plantes  🐈  ││
││ ○ Sortir les poubelles 🔥  ││
│╰────────────────────────────╯│
│   ( Budget · Maison · Courses )   ← pilule flottante, zone du pouce, safe-area
└──────────────────────────────┘
```

- **Un seul canvas** pour toute l'app, monté par la coquille (`WorldStage`
  dans `world/WorldContext.tsx`), positionné en `fixed` derrière le contenu.
  La coquille choisit la présentation selon le module et la largeur :
  - Maison mobile : `hero` animé, hauteur `--world-h: 54svh` ;
  - Budget / Courses mobile : `banner` fixe (`live: false`), `--world-h: 24svh` ;
  - ≥ 1024 px : `backdrop` — le monde occupe toute la fenêtre, l'interface est
    un carnet de 480 px à droite (sur la feuille encre), l'arbre visible à gauche.
- Le contenu défile par-dessus : un espaceur de hauteur `--world-h` puis la
  feuille (classe `.screen-sheet`). Pas de `backdrop-filter` au-dessus du canvas
  animé (coût GPU) : la feuille est opaque, son bord supérieur est un dégradé
  vers transparent de ~40 px.
- Quand on fait défiler, la scène peut se figer (`live: false`) dès qu'elle est
  majoritairement recouverte.
- Navigation : pilule flottante en bas (icône + libellé), `aria-current`.
  Historique et Réglages : deux boutons ronds en haut à droite (sur le dégradé
  du header), ouvrant des **feuilles plein écran** (dialog modal, focus piégé,
  Échap, retour au bouton d'origine, glisser vers le bas pour fermer).
- L'app s'ouvre sur le **dernier module utilisé** (Maison par défaut), mémorisé
  dans `localStorage` sous `a2-budget:ui:v1` (clé distincte des données ;
  jamais `localStorage.clear()`). `?module=` dans l'URL reste supporté.

## 3. Écrans

### Budget (« le Foyer »)
Règle d'or : **lisible en 2 secondes**, rien ne bouge. Au premier écran à
390×844 : mois, salaires des deux, **à verser** (AL, AC, total), dépenses
totales, **reste**. Bandeau peint fixe (paysage) avec « Octobre 2026 » et
navigation de mois (‹ ›, retour au mois courant). Cartes encre, montants en
Fraunces tabulaires, détail du calcul repliable (« AC : 40 % × 3 000 € + 20 % ×
675 € »), liste des dépenses éditable en place (renommer, montant, retirer,
ajouter), réserve/loisirs si configurée, déficit en terre cuite jamais masqué.
Saisie : `inputmode="decimal"`, virgule ou point, rejet des ambiguïtés
(`parseAmountInput` de core), chaîne d'édition séparée de la valeur validée
(cf. ancien `AmountInput.tsx`/`draftField.ts`). **Aucun calcul financier dans
React** : uniquement l'API de `@a2/core`.

### Maison (la clairière)
Hero vivant. Sous la scène : phrase d'humeur (« La forêt est paisible ce
matin » / « La forêt dort » en pause), puis la feuille :
- **Aujourd'hui** : tâches actionnables (case de 48 px, titre, compagnon de la
  personne assignée : Jiji pour AL, Calcifer pour AC, les deux pour ensemble).
  Cocher = coche instantanée + `useWorld().pulse({ id, who, fromClientX/Y })`
  depuis la case + réaction du compagnon (sprite qui sautille 1,2 s). Les
  tâches faites se replient en bas (« Fait aujourd'hui · 3 »), annulables.
- **À venir** : prochaines occurrences (cette semaine), non cochables.
- **Ajouter** : bouton + → feuille d'ajout (titre, qui, récurrence avec jour de
  semaine / jour du mois choisis, pas imposés à aujourd'hui).
- Éditer / supprimer une tâche (appui long ou menu ⋯) — à ajouter au store.
- **Cette semaine** : une phrase discrète (« AL 4 · AC 3 · ensemble 2 »), pas de
  score, pas de compétition.
- Pause : « Mettre la maison en pause » / « Réveiller la forêt » (Réglages et
  menu Maison).
- Gardien : quand `forest.lastRareEvent` passe à `guardian`, appeler
  `useWorld().playGuardian()` une seule fois (mémoriser « déjà vu »).

### Courses (nouveau module complet)
Liste commune : ajout rapide (champ toujours visible, Entrée), articles
cochables (barrés, regroupés en bas « Dans le panier »), suppression par
glissement ou bouton, quantité facultative (« ×2 », « 500 g »), catégories
automatiques simples (fruits & légumes, frais, épicerie, maison…) par mots-clés
français, vider le panier, suggestions des articles fréquents. Bandeau peint fixe.
Domaine dans `packages/core/src/home/groceries.ts` (pur, testé), champs
optionnels ajoutés à `GroceryItem` de façon rétrocompatible (validation V2).

### Historique (feuille)
Contextuel au module : Budget = mois existants (revenus, contributions,
dépenses, reste ; tap → ouvre le mois) ; Maison = faits Maison par jour (qui,
quoi), sans score ; Courses = derniers articles achetés.

### Réglages (feuille)
Personnes (nom, salaire de base, taux de base, taux variable), dépenses
récurrentes, réserve par défaut, « Appliquer au mois affiché », pause de la
forêt, **Forêt : vivante / douce / immobile** (stocké dans `a2-budget:ui:v1`),
export/import JSON (résumé + confirmation), recommencer à zéro (confirmation
forte), à propos. Les valeurs par défaut s'appliquent aux nouveaux mois.

## 4. Monde (moteur WebGL)

- Rendu 2.5D d'une peinture : OGL (`ogl`, ~16 KB gz), shaders sur mesure.
  Pas de Three.js, pas de 3D.
- Couche couleur du stade courant + profondeur → parallaxe (dérive lente
  automatique, doigt / souris, gyroscope désactivé) ; eau (masque R) en
  écoulement à deux phases ; vent sur feuillage (masque G, 1–2 px) et cadre de
  fougères au premier plan (couche séparée, parallaxe plus forte) ; 2–3 nappes de
  brume (bruit précalculé, modulées par la profondeur) ; rayons additifs depuis
  `lightSource` ; spores / lucioles en `gl.POINTS` ; étalonnage final par LUT 3D
  interpolée (humeur, nuit), vignette, grain.
- Humeurs : quiet = brume dense, pluie fine, quasi pas de rayon ;
  peaceful = brume douce, 1 rayon pâle ; lively = brume qui se lève, 2–3 rayons,
  gouttes scintillantes ; flourishing = rayons, spores dorées, mousse lumineuse.
  Pause = nuit (LUT nuit, clair de lune, lucioles, kodama luisants).
- Croissance : changement de stade = fondu organique (dissolution bruitée
  partant des racines, 3–4 s, joué une fois). Progression entre stades : subtile
  (densité de spores / mousse lumineuse), jamais de chiffre.
- Lumières du jour : une orbe douce par tâche faite aujourd'hui, posée sur une
  ancre stable (hash de l'id), teinte selon qui (argent / braise / or). `pulse`
  la fait monter depuis l'écran jusqu'à son ancre (≈1,6 s), petit souffle de
  vent, kodama le plus proche tourne la tête. Annuler = la lumière s'éteint.
  **Les tâches restantes ne sont jamais représentées** (pas de dette visible).
- Créatures débloquées (ids `CREATURES`) : sprites à leurs emplacements,
  discrets, à demi cachés ; kodama selon l'humeur (cachés en quiet, visibles en
  flourishing, luisants la nuit).
- Gardien : ≈10 s — le vent tombe, la brume s'illumine, le gardien apparaît à
  mi-profondeur en se dévoilant dans la brume, puis se dissout en lucioles.
  Tap pour passer.
- Politique de rendu : 60 fps 3 s après interaction → 30 → 15 → gel à 45 s ;
  arrêt hors écran / onglet caché ; DPR plafonné (1,5 / 1,25 / 1) ; paliers de
  qualité auto ; perte de contexte WebGL gérée ; `prefers-reduced-motion` ou
  réglage « immobile » = images fixes en fondu ; sans WebGL = peinture fixe
  (`<img>`) + brume CSS légère. La feuille est interactive avant le monde.
- Mémoire GPU < 60 MB ; textures décodées hors fil (`createImageBitmap`).

## 5. Architecture et propriété des fichiers

| Chemin | Propriétaire |
|---|---|
| `art/pipeline/**`, `apps/web/src/world/assets/**`, `apps/web/src/world/manifest.ts` | agent ASSETS |
| `apps/web/src/world/engine/**`, `apps/web/src/world/LivingForest.tsx` | agent MONDE |
| `apps/web/src/app/**`, `apps/web/src/ui/**`, `apps/web/src/styles/**` (sauf `tokens.css`), `features/budget/**`, `features/history/**`, `features/settings/**`, `apps/web/src/sw.ts`, `index.html`, e2e | agent UI |
| `packages/core/**`, `apps/web/src/state/**`, `features/maison/**`, `features/courses/**` | agent MAISON |
| `world/types.ts`, `world/WorldContext.tsx`, `world/worldState.ts`, `styles/tokens.css`, `docs/V2_BRIEF.md`, manifests (`package.json`) | lead |

Contrats : `world/types.ts` (monde, manifest), `useApp()` (store), `useWorld()`
(pulse/gardien/présentation). Écrans = composants sans props exportés :
`BudgetScreen`, `MaisonScreen`, `CoursesScreen`, `HistorySheetContent`,
`SettingsSheetContent`. Le système de design (`ui/`) est construit par l'agent
UI ; en parallèle, l'agent MAISON s'appuie sur les jetons de `tokens.css` et
les classes utilitaires de base décrites ci-dessous, puis harmonise à
l'intégration.

Classes de base garanties par la coquille (agent UI, `styles/base.css`) :
`.screen-sheet` (la feuille), `.sheet-section`, `.section-title`, `.btn`,
`.btn--primary`, `.btn--ghost`, `.icon-btn`, `.field`, `.chip`, `.card`,
`.amount` (Fraunces tabulaire), `.muted`, `.visually-hidden`.

## 6. Qualité

- `pnpm typecheck`, `pnpm test`, `pnpm build` passent.
- Accessibilité : contraste ≥ 4,5:1, zones tactiles ≥ 44 px, focus visible
  (anneau ambre), labels explicites, canvas `aria-hidden`, rien d'informatif
  seulement dans la scène, `prefers-reduced-motion` respecté.
- Données : jamais d'appel réseau, rien dans l'URL sauf `?module=`, clés
  `a2-budget:*` uniquement.
- Vérification visuelle obligatoire : captures Playwright à 390×844 (et
  1440×900) de chaque écran / état, regardées et critiquées avant de conclure.
