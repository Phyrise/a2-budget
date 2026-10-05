# A² Home — Contrats du domaine Maison / Forêt (V2, extensions V3, V3.2 et V4)

Ce document est la référence du **domaine Maison / Forêt** (A² Home), séparé
du budget. En cas de divergence avec le code, **ce document fait foi** ; toute
modification de contrat est coordonnée avec le lead avant d'être appliquée.

Le budget (V1) reste décrit dans `CONTRACTS.md`. Ce domaine **ne modifie pas**
les formules du budget : il compose l'état applicatif modulaire V2 autour du
budget existant, **profondément identique** (réserve comprise).

Implémentation : `packages/core/src/home/**` (fichiers `types.ts`, `dates.ts`,
`tasks.ts`, `choreActions.ts`, `forest.ts`, `groceries.ts`, `appState.ts`,
`fixtures/v1.ts` ; V3 : `occurrences.ts`, `taskEdit.ts`, `upcoming.ts`,
`skips.ts`, `balance.ts`, `rituals.ts`, `focus.ts`, `careValidation.ts`,
`validationHelpers.ts` ; V3.2 : `calendarTypes.ts`, `calendar.ts`,
`calendarOccurrences.ts`, `forestProgress.ts` ; V4 : `groceryMemory.ts`,
`taskCalendar.ts`, `lanterns.ts`). Tests : `*.test.ts` du même
dossier (V3 : `care.*.test.ts`). Store : `apps/web/src/state/store.tsx` (§9),
`careActions.ts` (§11.8), `calendarActions.ts` (§12.5) et `budgetActions.ts`
(V4, §14.4). Le budget V4 (euros entiers, paiements du mois, solde du compte
commun) est décrit dans `CONTRACTS.md` §2ter.

---

## 1. Principes directeurs

- **Local-first** : aucune donnée ne quitte l'appareil. Pas de backend, pas de
  compte, pas de synchro.
- **Sécurité des données d'abord** : la migration V1 → V2 est pure et testée ;
  les données corrompues ou d'une version inconnue ne sont **jamais** écrasées
  silencieusement (mode récupération, géré par le store).
- **Pas de gamification toxique** : aucune XP visible, aucun score, aucun
  classement, aucune compétition, aucune punition. La forêt **ne meurt jamais** :
  la croissance est permanente ; seule la vitalité court terme fluctue.
- **Fonctions pures** : toutes les opérations du domaine ne mutent jamais leurs
  entrées et retournent de nouveaux objets.
- **Dates locales** : toutes les dates du domaine sont des clés locales
  `YYYY-MM-DD` (fuseau de l'utilisateur), jamais UTC.

---

## 2. État applicatif modulaire (V2)

`AppState` (schéma `schemaVersion: 2`) :

```
AppState
├── schemaVersion: 2
├── household
│   └── people: Person[]            // identité partagée { id, name }
├── budget                          // === budget V1, profondément identique ===
│   ├── settings: Settings
│   ├── months: MonthRecord[]
│   └── selectedMonth: string
├── chores
│   ├── tasks: HouseholdTask[]
│   └── completions: ChoreCompletion[]
├── forest: ForestState
├── groceries
│   ├── items: GroceryItem[]        // liste commune (à acheter + panier)
│   └── history?: GroceryPurchase[] // achats archivés (optionnel)
├── rituals?: { circles }           // V3 (§11.6)
├── focus?: { sessions }            // V3 (§11.7)
└── calendar?: { events }           // V3.2 — calendrier commun (§12)
```

- `household.people` : identité partagée des deux personnes (dérivée des
  réglages budget à la migration). Utilisée par la coquille, les tâches et la
  forêt. Les ids stables (`a`, `b`) sont conservés.
- `budget` : **profondément identique** à la V1 (mêmes types, mêmes champs,
  réserve comprise). La validation V2 réutilise la validation V1 testée.
- `chores` : tâches (modèles récurrents) + faits Maison (occurrences terminées).
- `forest` : état de la forêt (vitalité, croissance, crédits, pause).
- `groceries` : liste de courses commune + historique des achats (§10).

> **Évolution rétrocompatible** : les champs ajoutés en V2 après coup
> (courses : `quantity`, `category`, `addedAt`, `doneAt`, `addedBy`, `history`)
> sont **optionnels**. Un JSON V2 qui ne les a pas se charge à l'identique
> (aucun champ inventé) ; `schemaVersion` reste `2`.

> **Règle** : on ne **greffe jamais** les domaines Maison/Forêt sur
> `schemaVersion: 1` — le validateur V1 supprimerait leurs champs au
> rechargement. Les nouveaux champs n'existent qu'en V2.

---

## 3. Migration V1 → V2

`migrateV1toV2(v1: PersistedStateInput): AppState` — **pure** :

- Conserve **exactement** le budget : `settings`, `months`, `selectedMonth`
  (montants, taux, noms, mois, **réserve comprise**), à la seule
  normalisation des revenus près (V3.1, `normalizeMonthIncome`, voir
  `CONTRACTS.md` §2bis) : contributions **strictement identiques**.
- Dérive `household.people` de `settings.personA/personB` (id + name).
- Initialise `chores` (vide), `forest` (`emptyForest()`), `groceries` (vide).
- Pose `schemaVersion: 2`.

`migrateState(value: unknown)` — **dispatch de versions** (entrée unique du
chargement) :

| `schemaVersion` | Comportement |
|-----------------|--------------|
| `1`             | validation V1 (`validatePersistedState`) → migration pure vers V2 |
| `2`             | validation V2 (`validateAppState`) |
| autre / illisible | échec avec raison stable (`unknown-schema-version`, …) |

- Ne lève **jamais** d'exception.
- En cas d'échec, le store conserve le **contenu brut** et bascule en mode
  récupération (jamais d'écrasement silencieux).

`validateAppState(value: unknown)` — validation V2 :

- Réutilise la validation V1 (testée) pour la partie `budget` : les mois avec
  ou sans compléments (`bonusACents`/`bonusBCents`) sont acceptés et
  ressortent normalisés. `schemaVersion` reste `2`.
- Valide `household`, `chores` (tâches + complétions, unicité des ids et des
  occurrences), `forest` (plages, dates, ledger), `groceries`.
- Retourne l'état validé (normalisé) ou une raison stable.

**Fixtures de référence** : `packages/core/src/home/fixtures/v1.ts` — quatre
états V1 valides (`v1Empty`, `v1Basic`, `v1Custom`, `v1History`), au format
brut d'avant V3.1 (`PersistedStateInput`). Les tests vérifient que le budget
migré est **profondément identique** pour chacun (mois normalisés) et que
chaque contribution est inchangée.

---

## 4. Tâches (Maison) — modèle à occurrences explicites

Une tâche récurrente génère des **occurrences** identifiées par
`(taskId, scheduledLocalDate)` ; une tâche ponctuelle a une unique occurrence
identifiée par `(taskId, once)`.

### 4.1 Types

- `HouseholdTask` : `{ id, title, description?, assignee, recurrence,
  weeklyDay?, monthlyDay?, createdAt }`.
  - `assignee` : `'a' | 'b' | 'both' | 'unassigned'`.
  - `recurrence` : `'none' | 'daily' | 'weekly' | 'monthly'`.
  - `weeklyDay` : jour ISO `1 = lundi … 7 = dimanche` (requis si `weekly`).
  - `monthlyDay` : jour du mois `1..31` (requis si `monthly`).
  - `createdAt` : clé locale `YYYY-MM-DD`.
- `ChoreCompletion` (fait Maison) : `{ id, taskId, taskTitle, assignee,
  dueDate, completedAt }`. `dueDate` est la date d'échéance de l'occurrence
  (`YYYY-MM-DD`) ou `once`. `completedAt` est un horodatage ISO.

### 4.2 Récurrence sans dérive

`isDueOn(task, date)` — une occurrence est due si :

- `none` : `date === createdAt` (ponctuelle).
- `daily` : toujours.
- `weekly` : `isoWeekday(date) === weeklyDay` (ancrée sur le **jour ISO**, pas
  sur `createdAt + 7j` → sans dérive).
- `monthly` : `date.getDate() === min(monthlyDay, joursDuMois(date))` (ancrée
  sur le **jour du mois**, ajustée au dernier jour si le mois est plus court →
  **mois courts prédictibles** : une tâche au 31 tombe au 30 en avril, au
  28/29 en février).

### 4.3 Complétion idempotente + annulation cohérente

- `addCompletion(completions, task, dueDate, now, id)` : ajoute le fait Maison
  de l'occurrence. **Idempotent** : une seconde complétion du même événement
  (même `taskId` + `dueDate`) est un **no-op** (`added: false`, même référence).
- `removeCompletion(completions, taskId, dueDate)` : retire **exactement** le
  fait de cette occurrence. **Idempotent** (`removed: false` si absent).
- `hasCompletion(completions, taskId, dueDate)` : vrai si le fait existe.
- `isActionableToday(task, today, completions)` : une occurrence due aujourd'hui
  pas encore terminée, ou une ponctuelle pas encore terminée.

La **répartition factuelle** (`weeklyDistribution`) compte **tous** les faits
Maison de la semaine courante (lundi → dimanche, sur `completedAt`), par
assignee (`a`, `b`, `both`, `unassigned`). Elle est indépendante des crédits de
la forêt : annuler un fait le retire de la répartition, mais le crédit (déjà
accordé) reste au ledger.

### 4.4 Création, édition, suppression

- `createTask(input, createdAt)` : titre nettoyé (espaces de bord) et non
  vide ; `assignee` / `recurrence` connus ; `weekly` exige `weeklyDay`
  **entier** ∈ [1,7], `monthly` exige `monthlyDay` **entier** ∈ [1,31] ; un
  jour sans objet est ignoré. Sinon `RangeError`. Mêmes règles que
  `validateAppState` : une tâche acceptée se recharge toujours.
- `updateTask(tasks, id, patch)` : `patch` ⊂ `{ title, assignee, recurrence,
  weeklyDay, monthlyDay, description }`. Un jour absent du patch reprend
  l'ancien ; la tâche finale est validée comme à la création (`RangeError`,
  rien n'est modifié) ; les jours sans objet pour la récurrence finale sont
  retirés. `id` et `createdAt` ne changent jamais. Id inconnu ou patch sans
  effet → **même référence**.
- `deleteTask(tasks, id)` : retire le modèle. Les **faits Maison passés
  restent** (historique, répartition : ils portent leur copie du titre et de
  l'assignee) ; les crédits de la forêt restent au ledger. Un fait dont la
  tâche n'existe plus est un état V2 **valide**.
- Les faits Maison passés ne sont **jamais réécrits** par une édition (titre
  et assignee d'origine conservés).

### 4.5 « À venir »

`upcomingOccurrences(tasks, completions, from, days, { includeDaily? })` :
occurrences des tâches récurrentes de **demain** à `from + days` (bornes
incluses ; aujourd'hui relève de `actionableTasksToday`). Ponctuelles exclues,
occurrence déjà faite (en avance) omise, `includeDaily: false` omet les
quotidiennes. Tri : date croissante puis ordre des tâches. Chaque entrée :
`{ task, date: 'YYYY-MM-DD', daysFromNow }`. `days` borné à [0, 366].

### 4.6 Cocher / décocher aujourd'hui (action composée)

`toggleTaskToday(state, taskId, now, completionId)` (`choreActions.ts`, pur et
déterministe) réunit tâches + forêt dans l'ordre exact :

1. tâche inconnue, ou récurrente non due aujourd'hui → aucun changement
   (`completionId: null`) ;
2. `advanceDay` (idempotent) ;
3. occurrence déjà faite → retrait du fait + **tombstone** du crédit →
   `{ completed: false, completionId: <id du fait retiré> }` ;
4. sinon ajout du fait (id fourni) + `grantCredit` (pause, cap, idempotence) ;
   si crédit accordé : `updateStreak`, `evaluateRareEvents`, `evaluateUnlocks`
   → `{ completed: true, completionId }`.

Recocher après annulation recrée un fait (nouvel id) **sans** nouveau crédit.

---

## 5. Forêt — état dérivé des complétions

La forêt est **dérivée** des événements de complétion. Deux grandeurs distinctes :

- **Vitalité** (court terme, `0..100`) : fluctue doucement. Jamais exposée en
  nombre ; seule l'état qualitatif est affiché (`quiet`, `peaceful`, `lively`,
  `flourishing`).
- **Croissance** (permanente) : `lifetimeCare` (soins significatifs comptés),
  `growthStage` (stade), `unlockedCreatureIds`, `unlockedEnvironmentIds`.
  **Ne diminue jamais.**

### 5.1 Crédits significatifs (anti-spam)

Chaque crédit a une **identité stable** fondée sur l'occurrence réelle :
`(taskId, scheduledLocalDate)` ou `(taskId, once)`.

`grantCredit(forest, creditKey, completionLocalDate)` accorde un crédit si :

1. la forêt n'est **pas en pause** ;
2. le crédit n'existe **pas déjà** au ledger (actif **ou** tombstone) →
   idempotent ;
3. le **cap quotidien** n'est pas atteint : au plus `DAILY_CREDIT_CAP = 3`
   crédits significatifs par **jour local** (comptés sur `grantedOn`, actifs +
   tombstones).

Un crédit accordé accroît `lifetimeCare` (+1) et la vitalité
(+`VITALITY_PER_CREDIT`, plafonnée à `VITALITY_MAX = 100`).

**Conséquences anti-spam** :
- Créer/cocher **30 tâches** le même jour n'accorde que **3** crédits (cap) →
  `lifetimeCare` et la vitalité ne sont pas farmables.
- Les **30 faits Maison restent tous enregistrés** (la répartition factuelle
  reste exacte) ; seuls les crédits sont plafonnés.

### 5.2 Tombstones (annuler / recompléter)

`tombstoneCredit(forest, creditKey)` :

- Met le crédit en `status: 'tombstoned'` (conservé au ledger).
- `lifetimeCare`, vitalité, stade et unlocks **ne diminuent jamais**.
- Le tombstone **compte toujours** pour le cap du jour (un annulation ne libère
  pas de place → anti-farming).

`grantCredit` sur une clé déjà tombstonée est un **no-op** : **annuler puis
recompléter restaure le fait Maison mais ne redonne aucun crédit.**

### 5.3 Décroissance douce + jour manqué

`advanceDay(forest, localDate)` — **idempotent par jour** (via
`lastProcessedDay`) :

- En pause : **aucun effet** (la forêt est endormie).
- Sinon, si aucune action ce jour-là : la vitalité décroît de `DAILY_DECAY = 6`
  (plancher 0) et le streak est **cassé** (mis à 0) si un jour non ponctué passe
  sans action.

### 5.4 Streak (jours consécutifs, jours de pause exclus)

`updateStreak(forest, localDate)` — après une action significative :

- Premier jour → `1`.
- Même jour → inchangé.
- Gap **entièrement** ponctué de jours de pause → streak `+ 1` (ponté).
- Sinon (jour manqué non ponctué) → repart à `1`.

`longestStreak` (mémoire longue) ne diminue jamais.

### 5.5 Pause (« Mettre la maison en pause »)

- `pauseForest(forest, localDate)` : `paused = true`, ouvre un intervalle de
  pause `{ start: localDate, end: null }`. Pas de justification requise.
- `resumeForest(forest, localDate)` : ferme l'intervalle en cours
  (`end = localDate − 1`, le jour de reprise est le premier jour actif).
- En pause : pas de crédit, pas de décroissance, pas de pénalité de streak.
- Les **jours de pause sont exclus** du streak (pontés).

### 5.6 Événements rares (momentum)

`evaluateRareEvents(forest, previousStreak, newStreak)` :

- Le **gardien** (événement mythique rare) se déclenche quand le streak passe de
  `< GUARDIAN_STREAK (10)` à `≥ 10`, **une seule fois** par série de streak
  (pas de doublon à 11, 12, …). Un nouveau streak de 10 après une cassure
  redéclenche l'événement.
- `lastRareEvent` mémorise le dernier événement déclenché.

> Le gardien est un **esprit forestier original** (folklore animiste japonais,
> énergie de cerf ancien, forêt, étonnement calme) — **pas** une copie d'un
> personnage Ghibli/Mononoke.

### 5.7 Croissance et déblocages

- `growthStageFor(lifetimeCare)` : stade permanent (seuils
  `GROWTH_THRESHOLDS = [0, 10, 25, 50, 100, 200, 400]`).
- `evaluateUnlocks(forest)` : met à jour le stade et les ids débloqués
  (créatures `CREATURES`, environnements `ENVIRONMENTS`) — **maximums
  cumulatifs**, jamais de perte.

### 5.8 Constantes internes (jamais exposées)

| Constante | Valeur | Rôle |
|-----------|--------|------|
| `VITALITY_MAX` | 100 | plafond de vitalité |
| `VITALITY_PER_CREDIT` | 12 | vitalité gagnée par crédit |
| `DAILY_CREDIT_CAP` | 3 | crédits significatifs max / jour local |
| `DAILY_DECAY` | 6 | décroissance douce / jour sans action |
| `GUARDIAN_STREAK` | 10 | streak déclenchant le gardien |
| `INACTIVITY_GRACE_DAYS` | 2 | journées inactives offertes avant décroissance |
| `GROWTH_THRESHOLDS` | 0, 10, 25, 50, 100, 200, 400 | lifetimeCare de chaque stade |
| `VITALITY_STATE_THRESHOLDS` | 0 / 25 / 50 / 75 | calme / paisible / vivante / florissante |
| `CREATURES`, `ENVIRONMENTS` | ids par stade | déblocages |
| `WEEKLY_GOAL_TARGET`, `WEEKLY_GOAL_LEVELS` | 12 ; 0 / 5 / 12 | objectif de la semaine (§13.2) |

Toutes sont **exportées** par `@a2/core` pour le mode développeur (§13.1),
qui seul les affiche. Ces nombres sont **internes** ; ils peuvent évoluer sans impact sur les
garanties (anti-spam, croissance permanente, pas de punition).

---

## 6. Dates locales (DST-safe)

`packages/core/src/home/dates.ts` :

- `localDateKey(date)` : clé locale `YYYY-MM-DD` (composantes locales, jamais
  UTC).
- `isoWeekday(date)` : `1 = lundi … 7 = dimanche`.
- `daysInMonth(date)` : 28/29/30/31.
- `addDays(date, days)` : décale des **jours calendaires** (reconstruit à minuit
  local puis décale le jour) → **sans dérive DST**.
- `startOfWeek(date)` : lundi de la semaine (minuit local).
- `parseLocalDateKey(key)` / `isValidLocalDateKey(key)` : parse/validation
  (rejette les dates inexistantes, ex. `2026-02-30`).

---

## 7. Cas limites couverts par les tests

- **Double clic** : seconde complétion du même événement = no-op (fait et
  crédit).
- **Annuler / recompléter** : tombstone conservé, fait restauré, **aucun**
  crédit redonné, croissance inchangée.
- **30 tâches différentes le même jour** : 3 crédits max (cap), 30 faits
  enregistrés.
- **Passage au jour suivant** : le cap se renouvelle ; la décroissance s'applique.
- **Pause** : pas de crédit, pas de décroissance, streak ponté.
- **Horloge / DST** : le cap suit la date **locale** (23h30 → 00h30 = deux
  jours locaux distincts) ; `addDays` sans dérive.
- **Éligibilité gardien sans doublon** : déclenché à 10, pas à 11/12 ;
  redéclenché après une cassure.
- **Persistance (reload)** : une forêt avec crédits/tombstones survit à un cycle
  sérialisation → `migrateState`.
- **Migration** : les quatre fixtures V1 → budget profondément identique ;
  version inconnue / corrompu → échec stable.

---

## 8. Cas limites ajoutés (V2 « Yakushima »)

- Double tap sur une tâche dans le même tick : le second appel voit le
  premier (annulation du **même** fait), aucun crédit regagné.
- Édition d'une tâche cochée aujourd'hui : le fait garde son titre d'origine.
- Suppression d'une tâche : faits et crédits conservés, état rechargeable.
- Courses : JSON V2 sans les nouveaux champs → chargé à l'identique ; champ
  présent mais mal typé → raison stable (`grocery-invalid-*`,
  `grocery-history-*`).

---

## 9. Store (`apps/web/src/state/store.tsx`, hook `useApp()`)

Toutes les actions passent par le même état V2 et les mêmes écritures
sérialisées (`LocalStorageAdapter`, une chaîne de promesses) ; aucune
écriture en mode récupération ; sûres en StrictMode (ids et horloge capturés
**hors** des updaters, transitions pures rejouables). Les actions qui
renvoient un résultat le calculent **avant** `setState` sur le dernier état
connu (avancé de façon optimiste : deux appels dans le même tick se voient).

| Action | Effet | Retour |
|---|---|---|
| `createHomeTask({ title, assignee, recurrence, weeklyDay?, monthlyDay?, effort?, rotation?, flexible? })` | crée la tâche ; jour par défaut = aujourd'hui | `HouseholdTask \| null` (null : saisie invalide) |
| `updateHomeTask(id, patch)` | `updateTask` (patch V3 : `effort`, `rotation`, `flexible`) ; passer en weekly/monthly sans jour connu → aujourd'hui | `boolean` (false : inconnue / incohérente) |
| `deleteHomeTask(id)` | `deleteTask` (faits conservés) | `boolean` |
| `toggleHomeTask(task, opts?: { doneBy? })` | `toggleTaskToday` (doneBy défaut : à qui c'était le tour) | `{ completed, completionId, doneBy }` (pour `useWorld().pulse({ id: completionId })`) |
| `skipToday(task, by?)` / `unskipToday(task)` | « pas aujourd'hui » (§11.4) | `boolean` |
| `applySuggestion(s)` | rotate → `rotation: true` ; reassign → `assignee: s.to` | `boolean` |
| `saveCircle({ gratitude, burdens, intentions, weekStart? })` | cercle de la semaine (remplace la même semaine, garde son id) | `Circle \| null` |
| `addFocusSession({ minutes, who, label?, taskId?, startedAt? })` | mémorise une lanterne | `FocusSession \| null` |
| `toggleHomePause()` | pause / réveil de la forêt | — |
| `addGrocery(label, addedBy?)` | `addGroceryItem` (quantité, rayon, anti-doublon) | `{ added, item }` |
| `toggleGrocery(id)` | `toggleGroceryItem` | — |
| `removeGrocery(id)` | `removeGroceryItem` | `{ item, index } \| null` (pour annuler) |
| `restoreGrocery(removed)` | `restoreGroceryItem` (annulation) | — |
| `updateGrocery(id, patch)` | `updateGroceryItem` ; V4 : un rayon choisi est mémorisé (`categoryMemory`), `category: null` l'oublie (§14.1) | — |
| `clearDoneGroceries()` | vide le panier vers l'historique | nombre d'articles archivés |
| `renamePerson('A' \| 'B', name)` | nom nettoyé ; `household.people` suit | `boolean` (false : vide) |
| `addCalendarEvent(draft)` / `updateCalendarEvent(id, patch)` | `addEvent` / `updateEvent` (§12) | `{ ok: true, event } \| { ok: false, reason }` |
| `removeCalendarEvent(id)` / `restoreCalendarEvent(removed)` | `removeEvent` / `restoreEvent` | `{ event, index } \| null` / `boolean` |
| `selectLantern(id)` | V4 : lanterne de pierre posée dans la forêt (§14.3) | `boolean` (false : inconnue / verrouillée) |
| `setTransferPaid` / `setExpensePaid` / `recordBalanceCorrection` / `removeBalanceCorrection` | V4 budget (CONTRACTS §4) | `boolean` |

Dérivés à calculer dans l'UI avec `@a2/core` (jamais de logique maison) :
`actionableTasksToday(tasks, today, completions, chores.skips)`,
`upcomingOccurrences(tasks, completions, today, 7, { skips })`,
`weeklyDistribution`, `nextAssignee`, `weeklyBalance`,
`rebalanceSuggestions(tasks, completions, today, 3, names)`,
`gratitudeSuggestions`, `circleForWeek`, `groupGroceryItems(items)`,
`grocerySuggestions(items, 6, { history, now: today })`,
`recentGroceryPurchases(groceries, 20)`, `groceryCategoryLabel` ; V3.2 :
`eventsOn`, `eventsBetween`, `nextEvents` (§12.3), `forestProgress(forest,
today)`, `weeklyCareGoal(forest, today)` (§13) ; V4 :
`taskOccurrencesBetween(tasks, completions, chores.skips, from, to)` (§14.2),
`activeLantern(focus)`, `unlockedLanterns(focus)`, `nextLantern(focus)`
(§14.3).

Import : le résumé (`ImportSummary`) mentionne aussi `taskCount`,
`completionCount` et `groceryCount`.

---

## 10. Courses (`groceries.ts`)

Fonctions **pures** (même référence quand rien ne change ; ids et heure
injectés).

### 10.1 Types

- `GroceryItem` : `{ id, label, done }` (V2 initiale) + optionnels
  `quantity?: string` (« ×2 », « 500 g » avec espace insécable, « 2 paquets »),
  `category?: GroceryCategory`, `addedAt?: ISO`, `doneAt?: ISO | null`,
  `addedBy?: 'a' | 'b'`.
- `GroceryPurchase` (historique) : `{ id, label, quantity?, category?,
  addedBy?, boughtAt: ISO }`, plus récent en tête, borné à
  `GROCERY_HISTORY_MAX = 200`.
- `GroceryCategory` et `GROCERY_CATEGORIES` (ordre d'affichage, libellés) :
  Fruits & légumes · Boulangerie · Frais · Épicerie · Boissons · Surgelés ·
  Hygiène · Maison · Autre.

### 10.2 Saisie rapide

`parseGroceryInput(raw)` → `{ label, quantity? }` :
« 2 pommes » → ×2 · Pommes ; « lait x2 », « lait (2) », « 2x lait » → ×2 ·
Lait ; « 500 g de farine », « farine 500 g » → 500 g · Farine ;
« 2 paquets de pâtes » → 2 paquets · Pâtes ; « du café » → Café ;
« 1 baguette » → pas de quantité. Les nombres faisant partie du nom
(« 7up », « Pastis 51 », « 2026 calendrier ») ne sont pas interprétés.
Libellé : espaces réduits, 120 caractères max, initiale en capitale (sauf
casse mixte type « iPhone »).

`categorizeGrocery(label)` : mots-clés français (accents, casse et pluriels
indifférents) ; « surgelé / congelé » → surgelés ; sinon le mot-clé trouvé le
plus tôt l'emporte (« jus d'orange » → boissons), à égalité le plus long
(« lait de coco » → épicerie, « crème solaire » → hygiène) ; rien → autre.
`groceryCategoryOf(item)` = catégorie enregistrée, sinon déduite.

### 10.3 Opérations

- `addGroceryItem(items, raw, { id, now, addedBy?, category?, memory? })` →
  `{ items, item, added }`. Rayon : `category`, sinon la mémoire des rayons
  (V4, §14.1), sinon les mots-clés. Saisie vide → inchangé (`item: null`). Article identique
  (`groceryKey` : accents, casse, pluriel s/x ignorés) **non coché** déjà
  présent → pas de doublon (`added: false`, `item` = l'existant ; une
  quantité différente remplace l'ancienne). Sinon ajout en fin de liste avec
  `addedAt = now`, `doneAt = null`.
- `toggleGroceryItem(items, id, now)` : `done` s'inverse ; `doneAt` = now ou
  null.
- `removeGroceryItem(items, id)` / `restoreGroceryItem(items, item, index)`.
- `updateGroceryItem(items, id, { label?, quantity?, category? }, memory?)` : libellé
  re-normalisé (quantité incluse extraite, rayon recalculé — mémoire puis
  mots-clés — sauf rayon explicite) ; `quantity: null | ''` retire ; `category: null` = rayon
  automatique. Champs invalides ignorés, jamais d'exception.
- `clearDoneGroceries(state, now)` : articles cochés → tête de l'historique
  (`boughtAt` = `doneAt`, sinon `now`), dédoublonnés par id, bornés.
- `grocerySuggestions(items, n, { history?, now?, windowDays = 90, minCount
  = 1 })` : articles achetés (historique + panier) **absents de la liste**,
  classés par fréquence, puis récence, puis libellé.
- `recentGroceryPurchases(state, n)` : panier + historique, plus récent
  d'abord (feuille Historique).
- `groupGroceryItems(items)` → `{ toBuy: [{ category, label, items }], basket }`
  (rayons dans l'ordre d'affichage, rayons vides omis ; panier du plus
  récemment coché au plus ancien).

---

## 11. V3 « Prendre soin ensemble » (rétrocompatible)

`schemaVersion` reste **2**. Tous les champs V3 sont **optionnels** : un
JSON V2 existant se recharge à l'identique (aucun champ inventé ; `null`
pour un bloc optionnel = absent) ; un champ présent est validé strictement
(raisons stables ci-dessous, `careValidation.ts`). Principes : jamais de
punition ni de dette visible, jamais de compétition (V3_BRIEF §1).

### 11.1 Champs de tâche

| Champ | Règle | Raison d'échec |
|---|---|---|
| `effort?: 1 \| 2 \| 3` | petit geste · tâche · corvée ; absent = 1 pour l'équilibre ; **sans effet sur les crédits** | `task-invalid-effort` |
| `rotation?: boolean` | tour à tour ; `true` exige `assignee` 'a'/'b' (= qui commence) | `task-invalid-rotation`, `task-rotation-requires-person` |
| `flexible?: boolean` | hebdomadaire souple ; `true` exige `recurrence: 'weekly'` (`weeklyDay` reste requis : jour suggéré) | `task-invalid-flexible`, `task-flexible-requires-weekly` |

`createTask` / `updateTask` ne stockent `rotation` / `flexible` que s'ils
valent `true`. Dans `updateTask`, une valeur **explicite** incohérente lève
une RangeError ; une valeur **héritée** devenue sans objet (assignee passé à
« ensemble », récurrence quittant weekly) est retirée en silence.

### 11.2 Hebdomadaire souple

- `isDueOn` : vrai **chaque jour** de la semaine ISO.
- Occurrence = **lundi** de la semaine : `occurrenceDateFor(task, date)`,
  `creditKeyFor(task, n'importe quel jour)` → `taskId|lundi`.
- `isActionableToday` / `findOccurrenceCompletion` : faite si un fait de la
  tâche est daté **dans** la semaine (lun → dim), y compris un fait
  enregistré quand la tâche était à jour fixe.
- `toggleTaskToday` : coche l'occurrence de la semaine ; décocher un autre
  jour de la même semaine retire ce fait (tombstone de sa clé d'origine).
- `upcomingOccurrences` : une entrée par **semaine suivante**, datée du lundi.
- Souple → jour fixe la même semaine : `findOccurrenceCompletion` /
  `isSkipped` d'une hebdomadaire à jour fixe acceptent aussi le fait / le
  passage daté du **lundi** de la semaine (pas de second fait ni de second
  crédit) ; décocher retire ce fait (tombstone de `taskId|lundi`).
- Autres tâches non souples : comportement V2 inchangé.

### 11.3 Tour à tour et « qui l'a vraiment fait »

- `ChoreCompletion.doneBy?: 'a' | 'b' | 'both'` ; qui a fait =
  `whoDid(c) = doneBy ?? assignee`. `doneBy` n'est stocké que s'il diffère
  de `assignee`.
- `nextAssignee(task, completions)` : tour à tour → l'opposé de la personne
  qui avait le tour au plus récent fait de la tâche (par `completedAt`) :
  `doneBy ?? assignee` si c'est 'a'/'b', sinon (fait « à deux ») l'`assignee`
  enregistré — le tour tourne aussi après un fait à deux ; sans fait
  exploitable, `task.assignee` ; autres tâches → `task.assignee`.
- `addCompletion(…, id, doneBy?)` : `assignee` du fait = `nextAssignee`
  (identique à V2 hors tour à tour). `toggleTaskToday(state, id, now,
  completionId, { doneBy? })` renvoie aussi `doneBy` (absent si rien n'a
  changé, forme V2 conservée).
- `weeklyDistribution` et les lumières du monde (`worldState.ts`) comptent
  `doneBy ?? assignee`. Le crédit de la forêt ne dépend **jamais** de doneBy.

### 11.4 « Pas aujourd'hui » (`chores.skips?`)

`ChoreSkip = { id, taskId, dueDate, at (ISO), by?: 'a' | 'b' }`.
`dueDate` = `skipDateFor(task, date)` : date du jour (récurrentes),
**lundi** pour une souple (« pas cette semaine » — libellé UI conseillé),
**date du jour** pour une ponctuelle (elle revient demain).

- `skipOccurrence(skips, skip)` / `unskipOccurrence(skips, taskId, dueDate)` :
  purs, idempotents sur `(taskId, dueDate)`, même référence si rien ne
  change ; au plus `SKIPS_MAX` = 500 (les plus anciens oubliés).
- `isActionableToday(task, today, completions, skips?)` et
  `actionableTasksToday(…, skips?)` : paramètre optionnel (sans lui,
  comportement V2).
- `toggleTaskToday` : occurrence passée et non faite → aucun changement
  (passer par `unskipToday` d'abord). Une occurrence faite ne peut pas être
  passée (`skipToday` → false).
- Aucun crédit, aucune pénalité : `advanceDay` est **inchangé** (passer
  équivaut pour la forêt à ne rien faire, sans trace d'échec).
- Validation : `skips-not-array`, `skip-not-object`, `skip-invalid-id`,
  `duplicate-skip-id`, `skip-invalid-task-id`, `skip-invalid-due-date`,
  `skip-invalid-at`, `duplicate-skip-occurrence`, `skip-invalid-by`.

### 11.5 Équilibre de la semaine

`weeklyBalance(tasks, completions, now)` → `{ a, b, total, verdict }` :
somme des efforts (défaut 1 ; tâche supprimée → 1) des faits de la semaine
ISO (par `completedAt`) selon `doneBy ?? assignee` ; « ensemble » = moitié
chacun ; « non attribuée » ignorée. Verdict : `quiet` si total < 3
(`BALANCE_QUIET_BELOW`), `balanced` si `|a − b| / total ≤ 0,25`
(`BALANCE_TOLERANCE`), sinon `a-carried` / `b-carried`.

> ⚠️ **Jamais de classement.** `a`, `b`, `total` sont des intermédiaires :
> l'UI n'affiche que le verdict (phrase bienveillante, visuel qualitatif) et
> les suggestions. Pas de score comparé, pas de « gagnant ».

`rebalanceSuggestions(tasks, completions, now, max = 3, names?)` →
`[{ taskId, kind: 'rotate' | 'reassign', to?, reason }]` : vide sauf
verdict `*-carried`. Candidates : tâches **récurrentes** attribuées à la
personne qui a porté, pas déjà en tour à tour, triées par effort puis
fréquence de la semaine. Effort ≥ 2 → `rotate` ; effort 1 → `reassign`
vers l'autre. `reason` : phrase française bienveillante (espaces
insécables), personnalisée si `names = { a, b }` est fourni.

### 11.6 Cercle de la semaine (`rituals?: { circles }`)

`Circle = { id, weekStart (lundi), heldAt (ISO), gratitude: { from, to, text }[],
burdens: { who, text }[], intentions: string[] }`.

- `saveCircle(rituals, circle)` : remplace le cercle de la même semaine,
  sinon ajoute ; tri par semaine ; au plus `CIRCLES_MAX` = 260. Textes
  nettoyés (espaces réduits, ≤ 280 car.), entrées vides retirées. RangeError
  si `weekStart` n'est pas un lundi, `heldAt` pas ISO, personne inconnue.
- `circleForWeek(rituals, Date | 'YYYY-MM-DD')` → cercle de cette semaine ou
  null.
- `gratitudeSuggestions(tasks, completions, now, from, max = 5)` : phrases
  tirées des faits de la semaine de l'autre (« Merci d'avoir sorti les
  poubelles 3 fois cette semaine ») ou faits ensemble (« … avec moi »).
  Participe passé de l'infinitif initial (`pastParticiplePhrase` : -er, -ir,
  irréguliers courants) ; sinon « Merci pour « Titre » cette semaine ».
  Ordre : effort × fréquence, puis le plus récent.
- Validation : `rituals-not-object`, `rituals-circles-not-array`,
  `circle-not-object`, `circle-invalid-id`, `circle-invalid-week-start`,
  `circle-invalid-held-at`, `circle-invalid-lists`,
  `circle-invalid-gratitude`, `circle-invalid-burden`,
  `circle-invalid-intention`, `duplicate-circle-id`, `duplicate-circle-week`.

### 11.7 Lanternes (`focus?: { sessions }`)

`FocusSession = { id, startedAt (ISO), minutes (entier 1..120), who: 'a' |
'b' | 'both', label?, taskId? }`. `addFocusSession(focus, session)` :
idempotent sur `id`, libellé nettoyé (vide → omis, ≤ 80 car.), garde les
`FOCUS_SESSIONS_MAX` = 500 plus récentes ; RangeError si invalide. Une
lanterne ne coche rien et ne donne aucun crédit (l'UI propose ensuite de
cocher la tâche). Validation : `focus-not-object`,
`focus-sessions-not-array`, `focus-too-many-sessions`,
`focus-session-not-object`, `focus-invalid-id`, `duplicate-focus-id`,
`focus-invalid-started-at`, `focus-invalid-minutes`, `focus-invalid-who`,
`focus-invalid-label`, `focus-invalid-task-id` ; V4 :
`focus-invalid-selected-lantern` (§14.3). `addFocusSession` conserve
`selectedLantern`.

### 11.8 Store (`careActions.ts`, exposé par `useApp()`)

`skipToday`, `unskipToday`, `applySuggestion`, `saveCircle`,
`addFocusSession` (tableau §9) suivent la même sémantique que les autres
actions : transition pure via `transact`, ids et horloge capturés hors de
l'updater (StrictMode), résultat synchrone, écriture sérialisée. L'objet
d'actions est mémoïsé (le contexte ne se recalcule pas à chaque rendu).

---

## 12. V3.2 — Calendrier commun (`calendar?: { events }`)

Les événements partagés du couple (dîner prévu, repas chez des amis,
anniversaire…). Champ **optionnel** d'`AppState` : absent tant qu'aucun
événement n'a été créé ; `null` est toléré et omis ; présent → validation
stricte. `schemaVersion` reste `2` et un JSON sans calendrier se recharge à
l'identique.

### 12.1 Type

```
CalendarEvent = {
  id, title, date: 'YYYY-MM-DD', time?: 'HH:MM', endTime?: 'HH:MM',
  allDay: boolean,
  kind: 'repas' | 'sortie' | 'anniversaire' | 'rdv' | 'voyage' | 'maison' | 'autre',
  who: 'a' | 'b' | 'both', place?, note?, yearly?: boolean,
  yearKnown?: boolean, createdAt (ISO)
}
```

- `allDay: true` ⇒ ni `time` ni `endTime` ; `allDay: false` ⇒ `time` requis.
- `endTime` seulement avec `time`, différent de `time` ; une fin antérieure
  au début signifie « se termine après minuit » (soirée 20:00 → 01:00).
- `yearly` : se répète chaque année au même mois/jour, à partir de l'année
  d'origine (jamais avant). Un **29 février** tombe le **28 février** les
  années non bissextiles.
- `yearKnown` : l'année d'origine est réellement connue (anniversaire saisi
  avec l'année de naissance → âge affichable) ; `false` → seuls mois et jour
  comptent (aucun âge, même pour une origine passée : un 29 février sans
  année est rangé sur la dernière année bissextile pour fêter le 28 février
  dès cette année). Absent (données d'avant) : déduit, connue si l'année
  d'origine précède l'année de création. L'interface pose `yearKnown` pour
  chaque anniversaire enregistré.
- Limites : `CALENDAR_EVENTS_MAX` = 2000, titre ≤ 120 (`CALENDAR_TITLE_MAX`),
  lieu ≤ 120, note ≤ 1000 ; `CALENDAR_KINDS` liste les natures.

### 12.2 Opérations (`calendar.ts`, pures, jamais d'exception)

- `addEvent(events, draft & { id, createdAt })` → `{ ok: true, events, event }`
  ou `{ ok: false, reason }`. Normalisation douce : titre et lieu nettoyés
  (espaces), titre tronqué à 120 ; note (retours à la ligne gardés) ; vides →
  omis. Défauts : `allDay` vrai sans heure, `kind: 'autre'`, `who: 'both'`,
  `yearly` vrai pour un `anniversaire`. Refus : saisie invalide (raisons de
  §12.4), `duplicate-calendar-event-id`, `calendar-full` (2000 : on n'oublie
  jamais un anniversaire en silence).
- `updateEvent(events, id, patch)` : chaque champ présent remplace, `null`
  retire un champ facultatif (`time`, `endTime`, `place`, `note`, `yearly`,
  `yearKnown`).
  Donner une heure passe en horaire ; `time: null` ou `allDay: true` repasse
  en journée entière (heures retirées). `id`/`createdAt` immuables. Seuls les
  champs du patch sont nettoyés ; patch sans effet → même référence ; id
  inconnu → `calendar-event-not-found`.
- `removeEvent(events, id)` → `{ events, removed: { event, index } | null }` ;
  `restoreEvent(events, removed)` remet à la même position (bornée) ; id déjà
  présent, calendrier plein ou événement invalide → même référence.

### 12.3 Occurrences (`calendarOccurrences.ts`)

`CalendarOccurrence = { event, date, years? }` (`years` : annuels seulement,
années depuis la date d'origine, 0 l'année d'origine).

- `eventsOn(events, date)` : occurrences du jour, annuelles comprises.
- `eventsBetween(events, from, to)` : bornes incluses (grille mensuelle,
  agenda) ; intervalle invalide ou inversé → `[]`.
- `nextEvents(events, now, n)` : les `n` prochaines à partir de `now` (date
  et heure locales) — aujourd'hui : journée entière, début pas encore passé,
  ou pas encore terminé (fin plus tard ou après minuit) ; un annuel apparaît
  une seule fois (sa prochaine occurrence). `n` ≤ 0 ou invalide → `[]`.
- Tri (`compareOccurrences`) : date, journée entière avant les horaires,
  heure, titre (ordre français), id.

### 12.4 Validation (raisons stables)

`calendar-not-object`, `calendar-events-not-array`,
`calendar-too-many-events`, `duplicate-calendar-event-id`,
`calendar-event-not-object`, `calendar-event-invalid-id`,
`calendar-event-invalid-title`, `calendar-event-invalid-date`,
`calendar-event-invalid-all-day`, `calendar-event-invalid-kind`,
`calendar-event-invalid-who`, `calendar-event-invalid-created-at`,
`calendar-event-all-day-with-time`, `calendar-event-invalid-time`,
`calendar-event-invalid-end-time`, `calendar-event-invalid-place`,
`calendar-event-invalid-note`, `calendar-event-invalid-yearly`,
`calendar-event-invalid-year-known`. Un événement valide ressort **champ
pour champ identique** (y compris `yearly: false`, `yearKnown: false`).

### 12.5 Store (`calendarActions.ts`, exposé par `useApp()`)

| Action | Retour |
|--------|--------|
| `addCalendarEvent(draft)` | `{ ok: true, event }` ou `{ ok: false, reason }` |
| `updateCalendarEvent(id, patch)` | idem |
| `removeCalendarEvent(id)` | `RemovedCalendarEvent` (pour annuler) ou `null` |
| `restoreCalendarEvent(removed)` | `boolean` |

Même sémantique que les autres actions (transition pure via `transact`, id et
horloge capturés hors de l'updater, résultat synchrone, écriture sérialisée).
Lecture : `appState.calendar?.events ?? []`.

---

## 13. V3.2 — Progression et objectif de la semaine (`forestProgress.ts`)

Lecture seule : rien n'est modifié, rien n'est persisté.

### 13.1 `forestProgress(forest, today)` (mode développeur)

`today` : `Date` ou clé `YYYY-MM-DD`. Renvoie `{ stage, lifetimeCare,
stageFloor, nextThreshold (null au dernier stade), progressToNext (0..1, 1 au
dernier stade), creditsToday (actifs + annulés du jour, ce qui compte pour le
plafond), dailyCap, vitality, vitalityMax, vitalityState, currentStreak,
longestStreak, paused }`. Ces nombres ne s'affichent **que** dans le mode
développeur (réglage des constantes, §5.8) ; l'interface normale garde des
états qualitatifs.

### 13.2 `weeklyCareGoal(forest, now, opts?)` — jamais une sanction

L'objectif dit seulement comment la forêt a été choyée cette semaine. Le
niveau le plus bas s'appelle `resting` (« la forêt se repose ») : la forêt ne
meurt jamais, ne rougit jamais, aucune dette ne se reporte d'une semaine sur
l'autre, aucune comparaison entre les deux personnes. L'interface en tire
une phrase douce, jamais un reproche.

- `creditsThisWeek` : crédits **`active`** accordés du lundi au dimanche de la
  semaine locale de `now` (`weekStart`, `weekEnd`).
- `target` : 12 par défaut (`WEEKLY_GOAL_TARGET` = 4 jours de soins pleins),
  configurable (`opts.target`, entier ≥ 1, sinon défaut).
- `level` : `resting` < 5, `good` 5–11, `flourishing` ≥ 12
  (`WEEKLY_GOAL_LEVELS`). Avec un autre objectif, `goodFrom` suit la même
  proportion (round(target × 5/12), au moins 1) et `flourishing` = `target`.
- `progress` : `creditsThisWeek / target` borné à 0..1 (jauge douce).
- `trend` : si `opts.weekStartVitality` est fourni (l'état ne garde pas
  d'instantané de vitalité, l'appelant peut l'avoir mémorisé), compare la
  vitalité actuelle à celle-ci (`rising` / `steady` / `resting`). Sinon
  compare `creditsThisWeek` à `previousWeekSameSpan` (crédits actifs de la
  semaine précédente, du lundi au **même jour de semaine**, pour une
  comparaison juste en cours de semaine) : plus → `rising`, moins ou rien
  des deux côtés → `resting`, autant → `steady`.

---

## 14. V4 — Rayons mémorisés, tâches au calendrier, lanternes de pierre

Tous les champs sont **optionnels** (`schemaVersion` reste `2`) : absents,
ils ne sont jamais inventés ; `null` est toléré et omis ; présents, ils sont
validés strictement (sauf les cas « ignorés » indiqués) et recopiés tels
quels — un JSON se recharge à l'identique.

### 14.1 Mémoire des rayons (`groceries.categoryMemory?`)

`categoryMemory: Record<groceryKey(libellé), GroceryCategory>` : si l'on
change le rayon d'un article, les prochains ajouts du même libellé (accents,
casse, pluriels simples ignorés) vont dans ce rayon.

- `rememberGroceryCategory(memory, label, category)` : l'entrée devient la
  plus récente ; au plus `GROCERY_MEMORY_MAX` = 500 entrées (les plus
  anciennes oubliées). Identique, libellé vide ou rayon inconnu → même
  référence.
- `forgetGroceryCategory(memory, label)` : retour au rayon automatique.
- `rememberedCategory(memory, label)` : lecture (clés héritées d'`Object`
  jamais lues).
- Priorité à l'ajout : rayon explicite > mémoire > mots-clés.
- Store : `updateGrocery(id, { category })` mémorise pour le libellé
  (après renommage éventuel) ; `category: null` oublie. `addGrocery` et
  les renommages consultent la mémoire. Signatures du store inchangées.
- Validation : `grocery-memory-not-object`, `grocery-memory-invalid-key`,
  `grocery-memory-invalid-category` ; au-delà de 500 entrées, les plus
  anciennes sont oubliées (jamais illisible).

### 14.2 Tâches au calendrier (`taskCalendar.ts`)

`taskOccurrencesBetween(tasks, completions, skips, from, to)` →
`{ task, date, dueDate, done, skipped }[]`, bornes incluses
« YYYY-MM-DD », tri par date puis ordre de la liste des tâches (stable).

- Montrées : hebdomadaires **à jour fixe** (`weeklyDay`), mensuelles
  (`monthlyDay`, ajusté au dernier jour des mois courts), ponctuelles à leur
  date (`createdAt`, `dueDate = "once"`). Jamais les quotidiennes ni les
  hebdomadaires souples. Pas d'occurrence récurrente avant `createdAt`.
- `done` : fait Maison de l'occurrence (`findOccurrenceCompletion`, donc
  synchronisé avec Maison ; une hebdomadaire repassée en jour fixe garde le
  fait daté du lundi) — l'UI affiche la tâche **barrée**, jamais retirée.
  `skipped` : « pas aujourd'hui » (`isSkipped`).
- Cocher depuis le Calendrier : `toggleHomeTask(task)` (occurrence du jour,
  ou l'unique occurrence d'une ponctuelle quelle que soit sa date) ; les
  autres jours restent en lecture.
- Intervalle invalide ou inversé → `[]` ; fenêtre bornée à
  `TASK_CALENDAR_MAX_DAYS` = 400 jours ; pas de saut au changement d'heure.

### 14.3 Lanternes de pierre (`lanterns.ts`, `focus.selectedLantern?`)

Lancer un minuteur allume la lanterne de pierre (tōrō) posée dans la forêt.
Chaque session terminée (`focus.sessions.length`) rapproche d'un nouveau
modèle, collectionné dans le Carnet ; on choisit celui qui est posé.

| id | débloquée après (sessions terminées) |
|---|---|
| `kasuga-moss` (base) | 0 |
| `yukimi` | 3 |
| `oribe` | 8 |
| `kotoji` | 15 |
| `tachi-carved` | 25 |
| `ancient-shrine` | 40 |
| `spirit-light` | 60 |

- Seuils **réglables** dans `LANTERNS` sans migration : seul le choix est
  stocké, et un choix devenu verrouillé est ignoré. Un déblocage ne se perd
  jamais (les sessions ne sont jamais retirées ; au-delà de 500, le compte
  reste au maximum).
- `unlockedLanterns(focus | sessions)`, `isLanternUnlocked`, `nextLantern`
  (null quand la collection est complète), `activeLantern(focus)` (choix
  débloqué, sinon `DEFAULT_LANTERN_ID` = `kasuga-moss`),
  `selectLantern(focus, id)` → `{ focus, changed }` (inconnue, verrouillée
  ou déjà choisie → même référence).
- Validation : `selectedLantern` non chaîne → `focus-invalid-selected-lantern` ;
  inconnue ou verrouillée → **ignorée** (omise), le reste se charge.
- Jamais de score affiché : la progression se montre par les lanternes.

### 14.4 Store V4 (`budgetActions.ts`, exposé par `useApp()`)

`setTransferPaid`, `setExpensePaid`, `recordBalanceCorrection`,
`removeBalanceCorrection` (budget, `CONTRACTS.md` §4) et `selectLantern(id)`
suivent la sémantique commune : transition pure via `transact`, ids et
horloge capturés hors de l'updater, résultat synchrone (`boolean`),
écriture sérialisée, objet d'actions mémoïsé.

