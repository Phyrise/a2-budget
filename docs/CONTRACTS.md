# A² Budget — Contrats (V1, revenus V3.1)

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
- `MonthSummary.remainingCents` peut être **négatif** (déficit affiché, jamais
  masqué). `leisureCents = max(0, remainingCents − reserveTargetCents)`.
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
  si elles sont déjà alignées. Les données existantes ne sont jamais
  alignées automatiquement.
- **Normalisation des données existantes** (`normalizeMonthIncome`, pure,
  idempotente) : pour une personne sans compléments (ancien modèle),
  `compléments = max(0, salaire − salaireDeBase du mois)` et
  `salaire = min(salaire, salaireDeBase)`. Contributions **strictement
  identiques** (chaque tranche était déjà arrondie séparément). Appliquée par
  `validatePersistedState`/`validateAppState`, donc au chargement
  (`migrateState`, V1 et V2) et à l'import ; `computeMonthSummary` normalise
  aussi à la volée un mois brut.

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
- `createMonthRecord` : copie des personnes, salaires = salaires habituels
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
- `apps/web/src/state/store.tsx` : `AppProvider` + `useApp()`. Charge avant de
  sauvegarder (garde-fou StrictMode). Sauvegarde à chaque modification valide.
  `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`.
  - Revenus (V3.1) : `setSalary(monthKey, person, cents)`,
    `setBonus(monthKey, person, cents)` (compléments ; invalide ignoré),
    `setSharedRates(base, variable)` (réglages, les deux personnes ; nouveaux
    mois), `setMonthSharedRates(monthKey, base, variable)` (règles du mois
    indiqué, action explicite ; taux invalides ignorés),
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

| Salaire A | Salaire B | Compl. B | Contrib. A | Contrib. B | Total | Reste |
|---|---|---|---|---|---|---|
| 2200 € | 3000 € | 0 € | 880 € | 1200 € | 2080 € | 235 € |
| 2200 € | 3000 € | 500 € | 880 € | 1300 € | 2180 € | 335 € |
| 2200 € | 3000 € | 675 € | 880 € | 1335 € | 2215 € | 370 € |
| 2200 € | 3000 € | 1000 € | 880 € | 1400 € | 2280 € | 435 € |

Cas 3 + réserve 500 € : loisirs 0 €, non couvert 130 €. A = 1800 € → 720 €.
Un salaire saisi au-delà du salaire habituel reste entièrement au taux de
base (B 3675 € de salaire sans compléments → 1470 €). Un mois d'avant V3.1
avec B = 3675 € (sans compléments) est normalisé en 3000 € + 675 € → 1335 €.
