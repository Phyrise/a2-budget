# A² Budget — Contrats (V1)

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
  revenus du mois (`salaryACents`, `salaryBCents` — prévisionnels, préremplis
  avec les salaires de base), les dépenses propres au mois et
  `reserveTargetCents`.
- `PersistedState = { schemaVersion: 1, settings, months, selectedMonth }`.
- `MonthSummary.remainingCents` peut être **négatif** (déficit affiché, jamais
  masqué). `leisureCents = max(0, remainingCents − reserveTargetCents)`.
  `reserveCovered` est vrai par convention si `reserveTargetCents = 0`.
  `reserveShortfallCents = max(0, reserveTargetCents − remainingCents)`.

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
): ContributionBreakdown;
export function computeMonthSummary(record: MonthRecord): MonthSummary;

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

- `computeContributionBreakdown` : formule de la SPEC. Lève une erreur sur
  entrée invalide (négatif, non entier, hors plage).
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
  les salaires saisis ; sans effet si le mois n'existe pas.
- `validatePersistedState` : ne lève jamais ; valide version, types, entiers,
  plages, clés de mois, identifiants (uniques dans chaque liste), relations.
- `defaultSettings` : A = 2200 € / 4000 / 2000, B = 3000 € / 4000 / 2000,
  noms « A » et « B », dépenses récurrentes : loyer + charges 130000,
  électricité 10000, courses 40000, internet 3000, assurance 1500, autres 0 ;
  réserve par défaut 0.
- `createMonthRecord` : copie des personnes, salaires = salaires de base
  (prévision à ajuster), copie des dépenses récurrentes (mêmes ids), réserve =
  `defaultReserveTargetCents`.

## 4. Stockage (lead)

- `apps/web/src/state/storage.ts` : `StorageAdapter`
  (`load(): Promise<PersistedState | null>`, `save(state): Promise<void>`) +
  `LocalStorageAdapter`. Clé : `a2-budget:state:v1`. Jamais
  `localStorage.clear()`. Écritures sérialisées. `save` rejette en cas
  d'échec.
- `apps/web/src/state/store.tsx` : `AppProvider` + `useApp()`. Charge avant de
  sauvegarder (garde-fou StrictMode). Sauvegarde à chaque modification valide.
  `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`.
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

## 8. Résultats de référence (réserve nulle, dépenses 1845 €)

| Salaire A | Salaire B | Contrib. A | Contrib. B | Total | Reste |
|---|---|---|---|---|---|
| 2200 € | 3000 € | 880 € | 1200 € | 2080 € | 235 € |
| 2200 € | 3500 € | 880 € | 1300 € | 2180 € | 335 € |
| 2200 € | 3675 € | 880 € | 1335 € | 2215 € | 370 € |
| 2200 € | 4000 € | 880 € | 1400 € | 2280 € | 435 € |

Cas 3 + réserve 500 € : loisirs 0 €, non couvert 130 €. A = 1800 € → 720 €.
