# A² Budget — Contrats (V1, revenus V3.1, solde et euros entiers V4)

Ce document est la référence des agents. En cas de divergence avec le code,
**ce document fait foi** ; toute modification de contrat est coordonnée avec le
lead avant d'être appliquée.

## 1. Unités et invariants

- Montants : **centimes d'euro entiers** (`number`, entier, ≥ 0).
  2200 € = `220000`.
- Taux : **points de base entiers** (`number`, entier, 0 à 10000).
  40 % = `4000`, 20 % = `2000`, 33,33 % = `3333`.
- Interdits en entrée : `NaN`, `Infinity`, négatifs, non entiers, hors plage.
  Plage sûre des montants : `0 ≤ cents ≤ MAX_AMOUNT_CENTS`
  (`MAX_AMOUNT_CENTS = 100_000_000_000`, soit 1 milliard €) — garde les
  produits intermédiaires `cents × bps` sous `Number.MAX_SAFE_INTEGER`.
- Arrondi : chaque tranche de contribution est arrondie **séparément** au
  centime, demi-centime vers le haut, puis addition. Pour des entiers non
  négatifs sûrs : `roundHalfUp(n / 10000) === Math.floor((n + 5000) / 10000)`.

## 2. Types partagés

Définis dans `packages/core/src/types.ts` (fichier contrat, lead) :
`PersonSettings`, `Expense`, `MonthRecord`, `Settings`, `PersistedState`,
`ContributionBreakdown`, `MonthSummary`. Voir le fichier pour les champs et
commentaires. Points clés :

- `MonthRecord` contient une **copie** des paramètres des deux personnes, les
  revenus du mois — `salaryACents`/`salaryBCents` (salaire, prérempli avec le
  salaire habituel) et `bonusACents`/`bonusBCents` (compléments : heures
  sup, astreintes, gardes ; 0 à la création) —, les dépenses propres au mois
  et `reserveTargetCents`.
- `MonthRecordInput` / `PersistedStateInput` : même forme, compléments
  **facultatifs** (données d'avant V3.1). Les validateurs les acceptent et
  renvoient toujours des mois normalisés.
- `PersistedState = { schemaVersion: 1, settings, months, selectedMonth }`
  (forme du budget V1 ; dans l'état applicatif, `schemaVersion` reste `2`).
- `SharedRates = { baseRateBps, variableRateBps }` : taux communs du couple.
- `MonthSummary.remainingCents` (net du mois : versements − dépenses) peut
  être **négatif** (déficit, jamais masqué). V4 : il n'est plus affiché comme
  « reste » ; il alimente le report automatique du solde (§2ter). `leisureCents = max(0, remainingCents − reserveTargetCents)`.
  `reserveCovered` est vrai par convention si `reserveTargetCents = 0`.
  `reserveShortfallCents = max(0, reserveTargetCents − remainingCents)`.

## 2bis. Revenus (V3.1) : salaire + compléments, taux communs

- Chaque mois, chaque personne a un **salaire** (entièrement au taux de base)
  et des **compléments** facultatifs (heures sup, astreintes, gardes — souvent
  payés le mois suivant) au **taux au-delà**.
- `settings.personX.baseSalaryCents` est le **salaire habituel** : il
  préremplit le salaire d'un nouveau mois (compléments à 0). Il ne sert plus
  de seuil de calcul.
- **Taux communs** : le couple partage les deux taux. Les champs restent par
  personne (compatibilité) ; `setSharedRates(target, base, variable)` écrit
  les deux personnes (réglages ou règles d'un mois), `sharedRates(settings)`
  lit (la personne A fait foi si elles diffèrent), `hasSharedRates` indique
  si elles sont déjà alignées. Les données existantes (réglages et mois) ne
  sont jamais réécrites automatiquement, mais un **nouveau mois**
  (`createMonthRecord`) et « Appliquer au mois affiché »
  (`applySettingsToMonth`) prennent toujours les taux communs
  `sharedRates(settings)` : ce que l'interface affiche comme « Taux communs »
  est bien ce qui est calculé, même si d'anciens réglages divergent encore
  (les Réglages le signalent avec « Les rendre communs »).
- **Normalisation des données existantes** (`normalizeMonthIncome`, pure,
  idempotente) : pour une personne sans compléments (ancien modèle),
  `compléments = max(0, salaire − salaireDeBase du mois)` et
  `salaire = min(salaire, salaireDeBase)`. Contributions **strictement
  identiques** (chaque tranche était déjà arrondie séparément). Appliquée par
  `validatePersistedState`/`validateAppState`, donc au chargement
  (`migrateState`, V1 et V2) et à l'import ; `computeMonthSummary` normalise
  aussi à la volée un mois brut.

## 2ter. V4 — Euros entiers, paiements du mois, solde du compte commun

Rétrocompatible : `schemaVersion` reste `2`, champs **optionnels** (absents
→ jamais inventés ; `null` toléré et omis ; présents → validation stricte),
un JSON existant se recharge à l'identique.

### Euros entiers (`euros.ts`)

Plus aucun centime ni en saisie ni à l'affichage. Stockage et calculs
restent en **centimes exacts** ; les montants saisis sont des euros entiers
(stockés en multiples de 100).

- `roundToEuroCents(cents)` : arrondi à l'euro, demi-euro en s'éloignant de
  zéro (0,50 € → 1 € ; −0,50 € → −1 €) ; jamais `-0`.
- `formatEuros(cents)` : « 1 235 € » (`Intl` fr-FR, 0 décimale : fine
  insécable U+202F pour les milliers, insécable U+00A0 avant « € ») ;
  négatifs signés ; jamais « −0 € ».
- `parseEurosInput(raw)` → `{ ok: true, cents } | { ok: false, reason:
  'empty' | 'invalid' | 'not-integer' | 'out-of-range' }`. Accepte « 1234 »,
  « 1 234 » (groupes de trois, espaces normales / insécables / fines), « € »
  avant ou après, et une partie décimale **nulle** (« 1 234,00 »). Rejette
  sans tronquer : centimes non nuls (`not-integer`), signe, lettres, groupes
  mal formés (`invalid`), > 1 milliard € (`out-of-range`). « 0 » valide.
- `eurosToCents(euros)` : entier (négatif permis) → centimes ; RangeError sinon.
- `splitRounded(values)` : arrondi cohérent (plus forts restes, ordre de la
  liste en cas d'égalité) : chaque valeur à moins d'un euro de l'exacte et
  Σ arrondies = `roundToEuroCents(Σ exactes)`.
- `roundEurosConsistent(aCents, bCents)` → `{ aCents, bCents, totalCents }`
  avec A + B affichés = total affiché (ex. 10,50 € + 10,50 € → 11 € + 10 € =
  21 €). À utiliser pour la carte « À verser ».
- `parseAmountInput` / `formatCents` (décimales) restent exportées pour
  compatibilité.

### Paiements du mois (`payments.ts`, `MonthRecord.paid?`)

`paid?: { transferA?: boolean; transferB?: boolean; expenses?: Record<expenseId, boolean> }`.

- Cases à cocher remises à zéro chaque mois : `createMonthRecord` ne copie
  jamais `paid` (un nouveau mois naît sans rien de coché).
- `setTransferPaid(month, 'A' | 'B', paid)`, `setExpensePaid(month,
  expenseId, paid)` : pures ; représentation minimale (seul `true` est
  écrit ; `paid` disparaît quand rien n'est coché) ; sans changement ou
  dépense inconnue du mois → même référence.
- `isTransferPaid`, `isExpensePaid` (clés héritées jamais lues), `paidTotals(month,
  { aCents, bCents })` → `{ transfersCents, expensesCents }`.
- Nettoyage : `prunePaidExpenses(month)` retire les cases des dépenses
  disparues ; appliqué par `applySettingsToMonth` et par le store
  (`removeExpense`).
- Validation (`validateMonthRecord`) : `paid` non objet, drapeau non
  booléen, `expenses` non objet → `month-invalid-paid` (`budget-month-invalid-paid`
  dans l'état V2) ; une case de dépense inconnue est **nettoyée** (jamais
  illisible) ; les autres valeurs (y compris `false`) sont recopiées.

### Solde du compte commun (`accountBalance.ts`, `budget.balance?`)

Remplace le « reste ». `budget.balance?: { corrections: BalanceCorrection[] }`,
`BalanceCorrection = { id, monthKey, balanceCents, recordedAt (ISO), note? }`
où `balanceCents` est le solde **au début** du mois `monthKey` (négatif
permis, |v| ≤ `MAX_AMOUNT_CENTS`).

Fonctions pures ; `source` = `appState.budget` (`{ months, balance? }`) :

```
monthNetCents(m)                 = computeMonthSummary(m).remainingCents
openingBalance(src, K)           = C.balanceCents + Σ net(M), C.monthKey ≤ M < K
                                   (C = dernière correction ≤ K ; sans correction :
                                    0 au premier mois connu, Σ net(M) pour M < K)
currentBalanceEstimate(src, K)   = openingBalance + virements cochés − dépenses cochées
endOfMonthProjection(src, K)     = openingBalance + net(K)
openingFromCurrentBalance(src, K, réel) = réel − (virements cochés − dépenses cochées)
```

- Un mois absent de la liste compte pour 0 ; mois inconnu → ouverture.
- `recordBalanceCorrection(src, K, balanceCents, { id, recordedAt, note? })`
  : une correction par mois (la dernière remplace, id conservé), triées par
  mois, au plus `BALANCE_CORRECTIONS_MAX` = 600 ; note nettoyée (≤ 200, vide
  omise). **Aucun mois n'est réécrit** : le passé reste tel qu'il a été
  estimé. RangeError si mois, montant ou horodatage invalides.
- `removeBalanceCorrection(src, K)` (annuler), `balanceCorrectionFor(src, K)`.
- Validation (`validateBudgetBalance`, raisons préfixées `budget-` dans
  l'état V2) : `balance-not-object`, `balance-corrections-not-array`,
  `balance-too-many-corrections`, `balance-correction-not-object`,
  `balance-invalid-id`, `duplicate-balance-id`, `balance-invalid-month`,
  `duplicate-balance-month`, `balance-invalid-amount`,
  `balance-invalid-recorded-at`, `balance-invalid-note`.
- « Effacer l'historique » (store) pose, si des mois antérieurs sont
  effacés et qu'aucune correction n'existe pour le mois conservé, une
  correction égale à son ouverture : le solde estimé ne change pas.

## 3. API publique de `@a2/core`

Déclarée dans `packages/core/src/index.ts` (stubs de contrat dans le socle ;
l'agent CORE fournit les implémentations). Signatures :

```ts
export const MAX_AMOUNT_CENTS: number;          // 100_000_000_000
export const MAX_RATE_BPS: number;              // 10_000

export type ParseAmountResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'too-many-decimals' | 'out-of-range' };

// Calculs
export function computeContributionBreakdown(
  salaryCents: number,
  person: PersonSettings,
  bonusCents?: number,                          // compléments, 0 par défaut
): ContributionBreakdown;
export function computeMonthSummary(record: MonthRecordInput): MonthSummary; // + breakdownA/B

// Revenus (V3.1)
export function normalizeMonthIncome(month: MonthRecordInput): MonthRecord;
export function sharedRates(settings: Settings): SharedRates;
export function hasSharedRates(settings: Settings): boolean;
export function setSharedRates<T extends { personA; personB }>(
  target: T, baseRateBps: number, variableRateBps: number,
): T;                                           // Settings ou MonthRecord
export function monthIncomeCents(month: MonthRecordInput, person: 'A' | 'B'): number;

// Montants
export function parseAmountInput(raw: string): ParseAmountResult;
export function formatCents(cents: number): string;   // « 1 234,56 € » (Intl fr-FR EUR)

// V4 — euros entiers, paiements, solde du compte commun (§2ter)
export function roundToEuroCents(cents: number): number;
export function formatEuros(cents: number): string;    // « 1 235 € »
export function parseEurosInput(raw: string): ParseEurosResult;
export function eurosToCents(euros: number): number;
export function splitRounded(values: readonly number[]): number[];
export function roundEurosConsistent(a: number, b: number): { aCents; bCents; totalCents };
export function setTransferPaid<T extends MonthRecord>(m: T, p: 'A' | 'B', paid: boolean): T;
export function setExpensePaid<T extends MonthRecord>(m: T, expenseId: string, paid: boolean): T;
export function isTransferPaid(m, p: 'A' | 'B'): boolean;
export function isExpensePaid(m, expenseId: string): boolean;
export function prunePaidExpenses<T extends MonthRecord>(m: T): T;
export function paidTotals(m, { aCents, bCents }): { transfersCents; expensesCents };
export function monthNetCents(m: MonthRecordInput): number;
export function openingBalance(src: BalanceSource, monthKey: string): number;
export function currentBalanceEstimate(src: BalanceSource, monthKey: string): number;
export function endOfMonthProjection(src: BalanceSource, monthKey: string): number;
export function openingFromCurrentBalance(src: BalanceSource, monthKey: string, currentCents: number): number;
export function recordBalanceCorrection<T extends BalanceSource>(
  src: T, monthKey: string, balanceCents: number,
  meta: { id: string; recordedAt: string; note?: string },
): T;
export function removeBalanceCorrection<T extends BalanceSource>(src: T, monthKey: string): T;
export function balanceCorrectionFor(src: BalanceSource, monthKey: string): BalanceCorrection | undefined;

// Mois
export function currentMonthKey(now?: Date): string;  // « YYYY-MM », fuseau local
export function isValidMonthKey(key: string): boolean;
export function compareMonthKeys(a: string, b: string): number;
export function monthKeyToLabel(key: string): string; // « Octobre 2026 »

// État
export function defaultSettings(): Settings;
export function createMonthRecord(monthKey: string, settings: Settings): MonthRecord;
export function emptyState(): PersistedState;
export function ensureMonth(state: PersistedState, monthKey: string): PersistedState;
export function applySettingsToMonth(state: PersistedState, monthKey: string): PersistedState;
export function validatePersistedState(
  value: unknown,
): { ok: true; state: PersistedState } | { ok: false; reason: string };
```

Sémantique :

- `computeContributionBreakdown` : formule de la SPEC (salaire × taux de
  base + compléments × taux au-delà). Le détail expose `baseIncomeCents`
  (salaire), `variableIncomeCents` (compléments), `incomeCents` (total) et
  les deux tranches. Lève une erreur sur entrée invalide (négatif, non
  entier, hors plage).
- `computeMonthSummary` : expose aussi `breakdownA`/`breakdownB`.
- `parseAmountInput` : déterministe. Accepte « 1 234,56 », « 1234.56 »,
  « 1 234,56 € », espaces français au collage. Rejette (sans tronquer) : vide,
  ambigu, > 2 décimales, négatif, hors plage. « 0 » est valide.
- `formatCents` : `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
  Les tests comparent en normalisant les espaces insécables.
- `currentMonthKey` : fuseau **local** (jamais UTC).
- `ensureMonth` : pur ; crée le mois depuis les réglages si absent
  (`createMonthRecord`) et le sélectionne.
- `applySettingsToMonth` : pur ; remplace dans le mois les copies des
  personnes, les dépenses et la réserve par les réglages courants ; conserve
  les salaires et compléments saisis ; sans effet si le mois n'existe pas.
- `validatePersistedState` : ne lève jamais ; valide version, types, entiers,
  plages, clés de mois, identifiants (uniques dans chaque liste), relations ;
  compléments absents acceptés (ancien modèle), présents → montant valide
  (`month-invalid-bonus-a`/`-b`) ; renvoie des mois normalisés.
- `defaultSettings` : A = 2200 € / 4000 / 2000, B = 3000 € / 4000 / 2000,
  noms par défaut « AL » et « AC » (ids `a`/`b` inchangés ; les noms
  personnalisés déjà saisis sont préservés), dépenses récurrentes : loyer +
  charges 130000, électricité 10000, courses 40000, internet 3000, assurance
  1500, autres 0 ; réserve par défaut 0.
- `createMonthRecord` : copie des personnes (taux communs pour les deux), salaires = salaires habituels
  (prévision à ajuster), compléments = 0, copie des dépenses récurrentes
  (mêmes ids), réserve = `defaultReserveTargetCents`.

## 4. Stockage (lead)

- `apps/web/src/state/storage.ts` : `StorageAdapter`
  (`load(): Promise<LoadResult>`, `save(state): Promise<void>`,
  `clear(): Promise<void>`) + `LocalStorageAdapter`. Clé : `a2-budget:state:v1`.
  Jamais `localStorage.clear()` (seule la clé de l'app est touchée).
  Écritures sérialisées. `save` rejette en cas d'échec.
  - `LoadResult` : `{ status: 'absent' }` | `{ status: 'ok'; state }` |
    `{ status: 'error'; reason: 'parse' | 'access'; raw? }`. Le contenu brut
    illisible est **préservé** dans la clé (jamais remplacé automatiquement).
  - **Copie de sécurité d'avant V3.1** : au chargement de données dont un mois
    n'a pas encore de compléments (`bonusACents`/`bonusBCents`), le contenu
    brut est copié une seule fois dans `a2-budget:backup-pre-v31` (jamais
    effacé automatiquement), avant la première réécriture au nouveau format.
    Un build antérieur à V3.1 (retour en arrière du déploiement, onglet resté
    ouvert) ignore les compléments et les perdrait en réécrivant l'état.
    Restauration : exporter une sauvegarde JSON depuis un build V3.1 avant
    tout retour en arrière, ou recopier la valeur de la clé de sécurité dans
    `a2-budget:state:v1`.
- `apps/web/src/state/store.tsx` : `AppProvider` + `useApp()`. Charge avant de
  sauvegarder (garde-fou StrictMode). Sauvegarde à chaque modification valide.
  `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`.
  - V4 (`budgetActions.ts`) : `setTransferPaid(monthKey, 'A' | 'B', paid)`,
    `setExpensePaid(monthKey, expenseId, paid)`,
    `recordBalanceCorrection(monthKey, euros, note?, { asOf?: 'opening' | 'now' })`
    (euros entiers, négatif permis ; `'opening'` par défaut = solde au début
    du mois, `'now'` = solde constaté maintenant, converti via
    `openingFromCurrentBalance`), `removeBalanceCorrection(monthKey)` ;
    toutes renvoient `boolean` (false : rien n'a changé / saisie invalide).
    Lecture avec les fonctions pures sur `appState.budget`. Le store garde
    `budget.balance` à chaque modification du budget (`mutate`,
    `prepareApp`).
  - Revenus (V3.1) : `setSalary(monthKey, person, cents)`,
    `setBonus(monthKey, person, cents)` (compléments ; invalide ignoré),
    `setSharedRates(base, variable)` (réglages, les deux personnes ; nouveaux
    mois), `setMonthSharedRates(monthKey, base, variable)` (règles du mois
    indiqué, action explicite ; taux invalides ignorés ; le Budget propose
    « Annuler » via `restoreMonthRates(monthKey, previous)`),
    `updatePersonSettings` (nom, salaire habituel).
  - **Mode de récupération** (`recovery`) : si les données locales sont
    illisibles (JSON corrompu, version inconnue) ou le stockage inaccessible,
    l'état en mémoire reste utilisable (état neuf) mais **aucune écriture n'est
    persistée** tant qu'une action n'a pas été explicitement confirmée :
    `confirmReset()` (supprime la clé, état neuf) ou `retryLoad()` (stockage
    temporairement inaccessible). Un import réussi sort aussi du mode.
    `recovery: { kind: 'none' } | { kind: 'unreadable'; message } | { kind:
    'storage-unavailable'; message }`.
- `apps/web/src/state/exportImport.ts` : export enveloppe
  `{ app: 'a2-budget', schemaVersion, exportedAt, state }`, nom de fichier
  `a2-budget-AAAA-MM-JJ.json` ; import validé via `validatePersistedState`.
- **Les composants (agent UI) n'appellent jamais `localStorage`** : tout passe
  par `useApp()`.

## 5. Contraintes UI (agent UI)

- Consommer **exclusivement** l'API publique de `@a2/core` pour tout calcul,
  formatage et analyse de saisie. Aucune logique financière dans l'UI.
- Vues : exports nommés `CurrentMonthView`, `HistoryView`, `SettingsView`
  (sans props ; état via `useApp()`). Composants : `BottomNav`
  (`{ current: ViewId; onChange: (v: ViewId) => void }`,
  `ViewId = 'month' | 'history' | 'settings'`).
- Ne pas modifier : `main.tsx`, `App.tsx`, `state/**`, `SaveIndicator.tsx`,
  `UpdatePrompt.tsx`, `tokens.css`, `global.css`, `index.html`,
  `vite.config.ts`, manifests.
- Saisie : la chaîne en cours d'édition est locale au composant et séparée du
  montant validé ; `parseAmountInput` décide ; invalide → message local, aucun
  changement d'état ; champ vide ≠ 0 ; « 0 » valide ; préserver curseur/focus.
- Animations : CSS uniquement (opacity/transform, 140–220 ms),
  `prefers-reduced-motion` respecté, pas de changement de hauteur inattendu.
- Mobile d'abord 360–430 px, sans débordement horizontal ; zones tactiles ≥ 44 px ;
  focus visible ; labels explicites ; navigation inférieure avec
  `safe-area-inset-bottom`.

## 6. Propriété des fichiers (chemins exacts)

| Chemin | Propriétaire |
|---|---|
| `packages/core/**` | CORE |
| `apps/web/src/views/**` | UI |
| `apps/web/src/components/**` sauf `SaveIndicator.tsx`, `UpdatePrompt.tsx` | UI |
| `apps/web/src/styles/**` sauf `tokens.css`, `global.css` | UI |
| `apps/web/src/state/**`, `main.tsx`, `App.tsx`, `index.html`, `vite.config.ts`, `public/**`, manifests, lockfile, `.github/**`, `docs/**` | lead |

Un seul responsable modifie les manifests et le lockfile (lead). Les agents
demandent les nouvelles dépendances au lead.

## 7. Commandes

```
pnpm install --frozen-lockfile   # installation propre
pnpm dev                         # serveur dev (host 0.0.0.0, port 5173, base /a2-budget/)
pnpm typecheck                   # tsc --noEmit sur core et web
pnpm test                        # vitest (packages/core)
pnpm build                       # tsc + vite build (apps/web)
pnpm preview                     # serveur de preview du build (port 4173)
```

## 8. Résultats de référence (réserve nulle, dépenses 1845 €, taux 40 % / 20 %)

« Net » = versements − dépenses (`remainingCents`), ajouté au solde du compte
commun à la fin du mois (V4, §2ter).

| Salaire A | Salaire B | Compl. B | Contrib. A | Contrib. B | Total | Net |
|---|---|---|---|---|---|---|
| 2200 € | 3000 € | 0 € | 880 € | 1200 € | 2080 € | 235 € |
| 2200 € | 3000 € | 500 € | 880 € | 1300 € | 2180 € | 335 € |
| 2200 € | 3000 € | 675 € | 880 € | 1335 € | 2215 € | 370 € |
| 2200 € | 3000 € | 1000 € | 880 € | 1400 € | 2280 € | 435 € |

Cas 3 + réserve 500 € : loisirs 0 €, non couvert 130 €. A = 1800 € → 720 €.
Un salaire saisi au-delà du salaire habituel reste entièrement au taux de
base (B 3675 € de salaire sans compléments → 1470 €). Un mois d'avant V3.1
avec B = 3675 € (sans compléments) est normalisé en 3000 € + 675 € → 1335 €.
