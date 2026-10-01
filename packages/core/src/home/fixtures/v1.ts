/**
 * Fixtures V1 pour les tests de migration V1 → V2.
 *
 * Quatre états représentatifs, tous **valides** au sens de
 * `validatePersistedState` (schéma 1) :
 * - `v1Empty`   : premier lancement (réglages par défaut, aucun mois).
 * - `v1Basic`   : un mois courant, salaires par défaut, dépenses récurrentes.
 * - `v1Custom`  : noms/taux/salaires/dépenses personnalisés + réserve.
 * - `v1History` : plusieurs mois (historique) avec des valeurs distinctes.
 *
 * Ces fixtures sont la référence de la migration : le budget doit être
 * **profondément identique** après migration (montants, taux, noms, mois,
 * réserve comprise).
 */

import type { PersistedState } from '../../types.js';

/** 1. Premier lancement : réglages par défaut, aucun mois. */
export const v1Empty: PersistedState = {
  schemaVersion: 1,
  settings: {
    personA: {
      id: 'a',
      name: 'AL',
      baseSalaryCents: 220_000,
      baseRateBps: 4000,
      variableRateBps: 2000,
    },
    personB: {
      id: 'b',
      name: 'AC',
      baseSalaryCents: 300_000,
      baseRateBps: 4000,
      variableRateBps: 2000,
    },
    recurringExpenses: [
      { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
      { id: 'electricity', label: 'Électricité', amountCents: 10_000 },
      { id: 'groceries', label: 'Courses', amountCents: 40_000 },
      { id: 'internet', label: 'Internet', amountCents: 3_000 },
      { id: 'insurance', label: 'Assurance', amountCents: 1_500 },
      { id: 'other', label: 'Autres', amountCents: 0 },
    ],
    defaultReserveTargetCents: 0,
  },
  months: [],
  selectedMonth: '2026-10',
};

/** 2. Un mois courant : salaires par défaut, dépenses récurrentes copiées. */
export const v1Basic: PersistedState = {
  schemaVersion: 1,
  settings: v1Empty.settings,
  months: [
    {
      monthKey: '2026-10',
      personA: { id: 'a', name: 'AL', baseSalaryCents: 220_000, baseRateBps: 4000, variableRateBps: 2000 },
      personB: { id: 'b', name: 'AC', baseSalaryCents: 300_000, baseRateBps: 4000, variableRateBps: 2000 },
      salaryACents: 220_000,
      salaryBCents: 300_000,
      expenses: [
        { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
        { id: 'electricity', label: 'Électricité', amountCents: 10_000 },
        { id: 'groceries', label: 'Courses', amountCents: 40_000 },
        { id: 'internet', label: 'Internet', amountCents: 3_000 },
        { id: 'insurance', label: 'Assurance', amountCents: 1_500 },
        { id: 'other', label: 'Autres', amountCents: 0 },
      ],
      reserveTargetCents: 0,
    },
  ],
  selectedMonth: '2026-10',
};

/** 3. Personnalisé : noms, taux, salaires, dépenses et réserve modifiés. */
export const v1Custom: PersistedState = {
  schemaVersion: 1,
  settings: {
    personA: {
      id: 'a',
      name: 'Arthur',
      baseSalaryCents: 250_000,
      baseRateBps: 3500,
      variableRateBps: 2500,
    },
    personB: {
      id: 'b',
      name: 'Alexia',
      baseSalaryCents: 320_000,
      baseRateBps: 4500,
      variableRateBps: 1500,
    },
    recurringExpenses: [
      { id: 'rent', label: 'Loyer', amountCents: 145_000 },
      { id: 'energy', label: 'Énergie', amountCents: 12_000 },
      { id: 'food', label: 'Alimentation', amountCents: 55_000 },
    ],
    defaultReserveTargetCents: 10_000,
  },
  months: [
    {
      monthKey: '2026-10',
      personA: { id: 'a', name: 'Arthur', baseSalaryCents: 250_000, baseRateBps: 3500, variableRateBps: 2500 },
      personB: { id: 'b', name: 'Alexia', baseSalaryCents: 320_000, baseRateBps: 4500, variableRateBps: 1500 },
      salaryACents: 260_000,
      salaryBCents: 310_000,
      expenses: [
        { id: 'rent', label: 'Loyer', amountCents: 145_000 },
        { id: 'energy', label: 'Énergie', amountCents: 12_000 },
        { id: 'food', label: 'Alimentation', amountCents: 55_000 },
        { id: 'extra', label: 'Cadeau', amountCents: 40_000 },
      ],
      reserveTargetCents: 15_000,
    },
  ],
  selectedMonth: '2026-10',
};

/** 4. Historique : plusieurs mois avec des valeurs distinctes. */
export const v1History: PersistedState = {
  schemaVersion: 1,
  settings: v1Empty.settings,
  months: [
    {
      monthKey: '2026-08',
      personA: { id: 'a', name: 'AL', baseSalaryCents: 220_000, baseRateBps: 4000, variableRateBps: 2000 },
      personB: { id: 'b', name: 'AC', baseSalaryCents: 300_000, baseRateBps: 4000, variableRateBps: 2000 },
      salaryACents: 210_000,
      salaryBCents: 290_000,
      expenses: [
        { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
        { id: 'electricity', label: 'Électricité', amountCents: 9_000 },
      ],
      reserveTargetCents: 5_000,
    },
    {
      monthKey: '2026-09',
      personA: { id: 'a', name: 'AL', baseSalaryCents: 220_000, baseRateBps: 4000, variableRateBps: 2000 },
      personB: { id: 'b', name: 'AC', baseSalaryCents: 300_000, baseRateBps: 4000, variableRateBps: 2000 },
      salaryACents: 225_000,
      salaryBCents: 305_000,
      expenses: [
        { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
        { id: 'electricity', label: 'Électricité', amountCents: 11_000 },
        { id: 'groceries', label: 'Courses', amountCents: 42_000 },
      ],
      reserveTargetCents: 0,
    },
    {
      monthKey: '2026-10',
      personA: { id: 'a', name: 'AL', baseSalaryCents: 220_000, baseRateBps: 4000, variableRateBps: 2000 },
      personB: { id: 'b', name: 'AC', baseSalaryCents: 300_000, baseRateBps: 4000, variableRateBps: 2000 },
      salaryACents: 220_000,
      salaryBCents: 300_000,
      expenses: [
        { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
        { id: 'electricity', label: 'Électricité', amountCents: 10_000 },
        { id: 'groceries', label: 'Courses', amountCents: 40_000 },
        { id: 'internet', label: 'Internet', amountCents: 3_000 },
        { id: 'insurance', label: 'Assurance', amountCents: 1_500 },
        { id: 'other', label: 'Autres', amountCents: 0 },
      ],
      reserveTargetCents: 0,
    },
  ],
  selectedMonth: '2026-09',
};

/** Les quatre fixtures, pour itérer dans les tests. */
export const V1_FIXTURES: { name: string; state: PersistedState }[] = [
  { name: 'v1Empty', state: v1Empty },
  { name: 'v1Basic', state: v1Basic },
  { name: 'v1Custom', state: v1Custom },
  { name: 'v1History', state: v1History },
];
