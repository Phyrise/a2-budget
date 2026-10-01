# Mission — agent CORE

Tu es responsable **uniquement** de `packages/core`.

## À lire d'abord (dans cet ordre)

1. `docs/SPEC.md` — règles métier et résultats attendus.
2. `docs/CONTRACTS.md` — unités, API publique, sémantique exacte.
3. `packages/core/src/types.ts` — types partagés (ne pas modifier).
4. `packages/core/src/index.ts` — stubs de contrat à remplacer.

## Périmètre

- Implémenter **toute** l'API publique déclarée dans `packages/core/src/index.ts`
  (remplacer les stubs qui lèvent des erreurs).
- Organisation suggérée : `src/calculations.ts`, `src/amounts.ts`,
  `src/months.ts`, `src/state.ts` ; `src/index.ts` ne fait que ré-exporter
  (types + fonctions + constantes).
- Ajouter les tests Vitest dans `src/**/*.test.ts`.

## Interdictions

- Aucun React, aucune API navigateur (pas de `window`, `document`,
  `localStorage`), aucun réseau, aucune nouvelle dépendance.
- Ne pas modifier `packages/core/src/types.ts`, les manifests, ni aucun fichier
  hors de `packages/core/`.

## Exigences de calcul

- Centimes entiers et points de base entiers. Interdire `NaN`, `Infinity`,
  négatifs, non entiers, hors plage (`MAX_AMOUNT_CENTS`, `MAX_RATE_BPS`).
  Vérifier aussi la sûreté des produits intermédiaires.
- Arrondi : chaque tranche arrondie **séparément** au centime, demi-centime
  vers le haut, puis addition :
  `Math.floor((incomeCents * rateBps + 5000) / 10000)`.
- `parseAmountInput` : déterministe, fr-FR et en-US, espaces français au
  collage, rejet (pas de troncature) de vide / ambigu / > 2 décimales /
  négatif / hors plage ; « 0 » valide.
- `currentMonthKey` : fuseau **local**, jamais UTC.
- `validatePersistedState` : ne lève jamais ; valide version, types, entiers,
  plages, clés de mois, identifiants uniques par liste, relations.
- `ensureMonth` / `applySettingsToMonth` : purs, sémantique du §3 de
  CONTRACTS.md (les salaires saisis sont conservés par
  `applySettingsToMonth`).

## Tests Vitest (minimum)

- Le tableau complet du §8 de CONTRACTS.md (2200/3000, 2200/3500, 2200/3675,
  2200/4000) avec contributions, total, reste.
- Salaire inférieur à la base (A = 1800 € → 720 €).
- Revenu nul ; revenu égal à la base.
- Taux 0, 100 %, 33,33 % (3333 bps).
- Arrondi au demi-centime (ex. 1,25 € × 50 % → 63 c).
- Réserve insuffisante (cas 3 + réserve 500 € : loisirs 0, non couvert 130 €).
- Déficit (dépenses > contributions) : `remainingCents` négatif, jamais masqué.
- Entrées invalides : `parseAmountInput` (vide, ambigu, 3 décimales, négatif,
  hors plage) et `computeContributionBreakdown` (négatif, non entier, NaN).
- Changer les réglages préserve les mois existants (`applySettingsToMonth`
  explicite vs inaction silencieuse).
- `validatePersistedState` : état valide accepté ; JSON corrompu, version
  inconnue, champs invalides rejetés avec raison stable.
- `currentMonthKey` : fuseau local (tester avec des `Date` fixes).
- `monthKeyToLabel`, `compareMonthKeys`, `isValidMonthKey`.

## Critères de réussite

1. `pnpm typecheck` passe (depuis la racine).
2. `pnpm test` passe, tous les stubs remplacés.
3. Commit sur la branche `agent/core` (tu y es déjà).
4. Compte rendu bref (dans ta réponse finale) : modifications, tests exécutés,
   limites restantes.
