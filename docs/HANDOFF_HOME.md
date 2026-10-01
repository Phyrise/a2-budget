# Handoff — Domaine Maison/Forêt (A² Home)

**Branche** : `agent/home` (worktree `../a2-budget-home`, basée sur `main` `9a37d63`).
**Statut** : domaine livré + testé + documenté ; module Maison autonome livré +
QA visuelle faite. **Aucune mutation de `main`, du store, de la coquille ni du
stockage de production** dans ce lot.

Commits :
- `ae82c06` CORE(home) : domaine Maison/Forêt V2 (migration, tâches, forêt).
- `b7945f9` UI(home) : module Maison autonome (scène forêt, feedback, tâches).

---

## 1. Ce qui est livré

### Domaine (`packages/core/src/home/**`) — priorités 1/2/3
- **Migration V1 → V2 pure et testée** (4 fixtures) : budget profondément
  identique (montants, taux, noms, mois, **réserve comprise**), personnes du
  foyer dérivées, domaines Maison/Forêt/Courses initialisés à vide.
- **Dispatch de versions** (`migrateState`) : V1 → migration, V2 → validation,
  version inconnue/corrompu → échec stable (jamais d'écrasement).
- **Validation V2** (`validateAppState`) : réutilise la validation V1 testée
  pour le budget.
- **Tâches à occurrences explicites** `(taskId, scheduledLocalDate)` /
  `(taskId, once)` : complétion **idempotente**, **undo cohérent**, récurrence
  locale daily/weekly/monthly **sans dérive**, **mois courts prédictibles**,
  répartition factuelle hebdo.
- **Forêt dérivée des complétions** : crédits à identité stable, **cap
  quotidien (3/jour) plafonnant croissance ET vitalité** (anti-spam),
  **tombstones** (annuler/recompléter ne redonne rien), vitalité douce,
  **croissance permanente** (ne diminue jamais), streak avec **jours de pause
  exclus**, pause, **événement rare du gardien** (sans doublon).
- **Dates locales DST-safe**.
- **97 nouveaux tests** (170 au total ; les 73 tests budget sont intacts).
- Contrats : `docs/DOMAIN_CONTRACTS.md`.

### Module Maison (`apps/web/src/modules/chores/**`) — autonome
- `ForestScene` : 4 états de vitalité visuellement distincts (sans nombre),
  canopée qui répond à la vitalité + la croissance, créatures par stade,
  gardien (esprit forestier **original**, pas Ghibli), pause = forêt endormie.
- `CompletionFeedback` : compagnon qui réagit (Jiji/Calcifer), feuilles, phrase
  chaleureuse non compétitive ; `prefers-reduced-motion` respecté.
- `TaskList`/`TaskRow` : occurrences actionnables aujourd'hui, checkbox, assignee.
- `WeeklyDistribution` : répartition factuelle de la semaine.
- `MaisonModule` : compose le tout ; **props + callback** (pas de store).
- QA visuelle : 4 états + gardien capturés à 390×844 (`apps/qa-forest/`,
  gitignoré) et validés par VLM (états distincts, gardien lisible, rien de
  punitif). Aperçu dev : `preview.html` + `vite.preview.config.ts` +
  `scripts/capture-forest.mjs` (hors build de production).

**Avatars conservés** : AL/Jiji et AC/Calcifer (identité actuelle, non
remplacée).

---

## 2. API du domaine (pour l'intégration)

Tout est exporté depuis `@a2/core` (voir `packages/core/src/index.ts` →
`export * from './home/index.js'`).

### Chargement / migration
```ts
import { migrateState, emptyAppState, validateAppState } from '@a2/core';

// À la place de validatePersistedState dans le store :
const result = migrateState(parsedJson);
// result.ok === true  → result.state: AppState (V2)
// result.ok === false → result.reason (mode récupération, contenu brut conservé)
```

### Tâches
```ts
import {
  createTask, creditKeyFor, addCompletion, removeCompletion,
  isActionableToday, actionableTasksToday, weeklyDistribution,
} from '@a2/core';

// Compléter une occurrence (idempotent) :
const { completions, added } = addCompletion(state.chores.completions, task, dueDate, new Date(), id);
// dueDate = task.recurrence === 'none' ? 'once' : localDateKey(today)

// Annuler (undo cohérent) :
const { completions: next, removed } = removeCompletion(completions, task.id, dueDate);
```

### Forêt (à appeler **après** une complétion/annulation)
```ts
import {
  grantCredit, tombstoneCredit, updateStreak, advanceDay,
  evaluateUnlocks, evaluateRareEvents, pauseForest, resumeForest,
  vitalityState,
} from '@a2/core';

// À la complétion (si added) :
let forest = state.forest;
const key = creditKeyFor(task, dueDate);
const { forest: f1, granted } = grantCredit(forest, key, localDateKey(now));
if (granted) {
  const prev = f1.currentStreak;
  const f2 = updateStreak(f1, localDateKey(now));
  const { forest: f3, triggered } = evaluateRareEvents(f2, prev, f2.currentStreak);
  forest = evaluateUnlocks(f3);
  // triggered === 'guardian' → déclencher l'événement rare dans l'UI
}

// À l'annulation (si removed) :
const { forest: f } = tombstoneCredit(state.forest, key);

// Au chargement / changement de jour (décroissance douce, idempotent par jour) :
const forest = advanceDay(state.forest, localDateKey(today));

// Pause / reprise :
pauseForest(forest, localDateKey(today));
resumeForest(forest, localDateKey(today));
```

> **Ordre recommandé** au chargement : `migrateState` → `advanceDay` (pour
> appliquer la décroissance des jours passés) → rendu.

---

## 3. Plan d'intégration (lead / CODEX)

1. **Store** (`apps/web/src/state/store.tsx`) :
   - Remplacer `validatePersistedState` par `migrateState` (le reste du store —
     recovery, `LoadResult`, écritures sérialisées — reste identique).
   - L'état en mémoire devient `AppState` (V2). Les actions budget existantes
     opèrent sur `state.budget` (mêmes fonctions core, budget inchangé).
   - Ajouter les actions tâches/forêt (compléter/annuler une occurrence →
     `addCompletion`/`removeCompletion` + `grantCredit`/`tombstoneCredit` +
     `updateStreak`/`evaluateRareEvents`/`evaluateUnlocks`).
   - Appeler `advanceDay` au chargement.
2. **Navigation / coquille** (domaine CODEX) :
   - Intégrer `MaisonModule` dans la navigation (module « Maison »).
   - Passer `tasks`, `completions`, `forest`, `people`, `today` en props et
     `onToggle` en callback.
3. **Import/export** : adapter `exportImport.ts` à `AppState` (V2) ; l'import
   d'un JSON V1 doit passer par `migrateState`.
4. **PWA / stockage** : la clé de stockage reste la même ; le schéma V2 est
   migré in-place au premier chargement (pas de perte de données).

---

## 4. Vérifications restantes (avant publication)

- [ ] Intégration store (migration au chargement, actions tâches/forêt).
- [ ] Intégration navigation (module Maison dans la coquille CODEX).
- [ ] Import/export V2 + import V1 (via `migrateState`).
- [ ] E2E : migration V1→V2 sur un vrai localStorage, complétion/annulation,
  cap quotidien, gardien, pause.
- [ ] QA visuelle sur appareil réel (safe-areas, clavier, zones tactiles).
- [ ] Vérifier la cohérence des fixtures du rapport (réserve/reste/manque) —
  voir la note d'Arthur : `réserve 500 + reste 370 → manque 130` ; `manque 265`
  correspond au scénario de base `reste 235`.

---

## 5. Limites honnêtes

- La forêt est un **prototype** (CSS/SVG originaux), pas une simulation
  complète ; les créatures/gardien sont des placeholders visuels à enrichir
  avec de l'artwork généré (identité : aquarelle, forêt de fantasy japonaise,
  chaleureuse, originale — **pas** de Ghibli).
- Les nombres internes (vitalité, crédits, stades) sont choisis pour valider
  le concept ; ils peuvent évoluer sans casser les garanties.
- Le module Maison n'est **pas encore câblé** au store ni à la navigation
  (composants autonomes, prêts à l'intégration).
- QA visuelle faite via VLM sur captures 390×844 (pas d'appareil réel).
