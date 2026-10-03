# A² Home — Contrats du domaine Maison / Forêt (V2)

Ce document est la référence du **domaine Maison / Forêt** (A² Home), séparé
du budget. En cas de divergence avec le code, **ce document fait foi** ; toute
modification de contrat est coordonnée avec le lead avant d'être appliquée.

Le budget (V1) reste décrit dans `CONTRACTS.md`. Ce domaine **ne modifie pas**
les formules du budget : il compose l'état applicatif modulaire V2 autour du
budget existant, **profondément identique** (réserve comprise).

Implémentation : `packages/core/src/home/**` (fichiers `types.ts`, `dates.ts`,
`tasks.ts`, `choreActions.ts`, `forest.ts`, `groceries.ts`, `appState.ts`,
`fixtures/v1.ts`). Tests : `*.test.ts` du même dossier. Store :
`apps/web/src/state/store.tsx` (§9).

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
└── groceries
    ├── items: GroceryItem[]        // liste commune (à acheter + panier)
    └── history?: GroceryPurchase[] // achats archivés (optionnel)
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

`migrateV1toV2(v1: PersistedState): AppState` — **pure** :

- Conserve **exactement** le budget : `settings`, `months`, `selectedMonth`
  (montants, taux, noms, mois, **réserve comprise**).
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

- Réutilise la validation V1 (testée) pour la partie `budget`.
- Valide `household`, `chores` (tâches + complétions, unicité des ids et des
  occurrences), `forest` (plages, dates, ledger), `groceries`.
- Retourne l'état validé (normalisé) ou une raison stable.

**Fixtures de référence** : `packages/core/src/home/fixtures/v1.ts` — quatre
états V1 valides (`v1Empty`, `v1Basic`, `v1Custom`, `v1History`). Les tests
vérifient que le budget migré est **profondément identique** pour chacun.

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

Ces nombres sont **internes** ; ils peuvent évoluer sans impact sur les
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
| `createHomeTask({ title, assignee, recurrence, weeklyDay?, monthlyDay? })` | crée la tâche ; jour par défaut = aujourd'hui | `HouseholdTask \| null` (null : saisie invalide) |
| `updateHomeTask(id, patch)` | `updateTask` ; passer en weekly/monthly sans jour connu → aujourd'hui | `boolean` (false : inconnue / incohérente) |
| `deleteHomeTask(id)` | `deleteTask` (faits conservés) | `boolean` |
| `toggleHomeTask(task)` | `toggleTaskToday` | `{ completed, completionId }` (pour `useWorld().pulse({ id: completionId })`) |
| `toggleHomePause()` | pause / réveil de la forêt | — |
| `addGrocery(label, addedBy?)` | `addGroceryItem` (quantité, rayon, anti-doublon) | `{ added, item }` |
| `toggleGrocery(id)` | `toggleGroceryItem` | — |
| `removeGrocery(id)` | `removeGroceryItem` | `{ item, index } \| null` (pour annuler) |
| `restoreGrocery(removed)` | `restoreGroceryItem` (annulation) | — |
| `updateGrocery(id, patch)` | `updateGroceryItem` | — |
| `clearDoneGroceries()` | vide le panier vers l'historique | nombre d'articles archivés |
| `renamePerson('A' \| 'B', name)` | nom nettoyé ; `household.people` suit | `boolean` (false : vide) |

Dérivés à calculer dans l'UI avec `@a2/core` (jamais de logique maison) :
`actionableTasksToday`, `upcomingOccurrences(tasks, completions, today, 7)`,
`weeklyDistribution`, `groupGroceryItems(items)`,
`grocerySuggestions(items, 6, { history, now: today })`,
`recentGroceryPurchases(groceries, 20)`, `groceryCategoryLabel`.

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

- `addGroceryItem(items, raw, { id, now, addedBy?, category? })` → `{ items,
  item, added }`. Saisie vide → inchangé (`item: null`). Article identique
  (`groceryKey` : accents, casse, pluriel s/x ignorés) **non coché** déjà
  présent → pas de doublon (`added: false`, `item` = l'existant ; une
  quantité différente remplace l'ancienne). Sinon ajout en fin de liste avec
  `addedAt = now`, `doneAt = null`.
- `toggleGroceryItem(items, id, now)` : `done` s'inverse ; `doneAt` = now ou
  null.
- `removeGroceryItem(items, id)` / `restoreGroceryItem(items, item, index)`.
- `updateGroceryItem(items, id, { label?, quantity?, category? })` : libellé
  re-normalisé (quantité incluse extraite, rayon recalculé sauf rayon
  explicite) ; `quantity: null | ''` retire ; `category: null` = rayon
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
