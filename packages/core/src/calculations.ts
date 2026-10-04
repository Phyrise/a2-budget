/**
 * Calculs du budget : contribution individuelle et agrégats mensuels.
 *
 * Formules : docs/SPEC.md (« Règles métier ») et docs/CONTRACTS.md §1.
 */

import { MAX_AMOUNT_CENTS, MAX_RATE_BPS } from './amounts.js';
import { normalizeMonthIncome } from './income.js';
import type {
  ContributionBreakdown,
  MonthRecordInput,
  MonthSummary,
  PersonSettings,
} from './types.js';

/** Vérifie un montant en centimes : entier, 0 ≤ v ≤ MAX_AMOUNT_CENTS. */
export function assertAmountCents(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_AMOUNT_CENTS) {
    throw new RangeError(`${label} must be an integer in [0, ${MAX_AMOUNT_CENTS}]`);
  }
}

/** Vérifie un taux en points de base : entier, 0 ≤ v ≤ MAX_RATE_BPS. */
export function assertRateBps(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_RATE_BPS) {
    throw new RangeError(`${label} must be an integer in [0, ${MAX_RATE_BPS}]`);
  }
}

/**
 * roundHalfUp(incomeCents × rateBps / 10000) pour entiers non négatifs sûrs :
 * floor((n + 5000) / 10000). Le produit reste ≤ 10^15 < Number.MAX_SAFE_INTEGER.
 */
function roundHalfUpCents(incomeCents: number, rateBps: number): number {
  return Math.floor((incomeCents * rateBps + 5000) / 10000);
}

/**
 * Contribution d'une personne pour un mois (modèle V3.1 salaire + compléments).
 *
 *   baseIncomeCents           = salaryCents          (entièrement au taux de base)
 *   variableIncomeCents       = bonusCents           (compléments, au taux au-delà)
 *   baseContributionCents     = roundHalfUp(salaryCents × person.baseRateBps / 10000)
 *   variableContributionCents = roundHalfUp(bonusCents × person.variableRateBps / 10000)
 *   contributionCents         = baseContributionCents + variableContributionCents
 *
 * `person.baseSalaryCents` (salaire habituel) ne sert plus de seuil. Chaque
 * tranche est arrondie séparément au centime (demi-centime vers le haut)
 * avant l'addition. Lève une erreur sur entrée invalide (négatif, non
 * entier, hors plage).
 */
export function computeContributionBreakdown(
  salaryCents: number,
  person: PersonSettings,
  bonusCents = 0,
): ContributionBreakdown {
  assertAmountCents(salaryCents, 'salaryCents');
  assertAmountCents(bonusCents, 'bonusCents');
  assertAmountCents(person.baseSalaryCents, 'person.baseSalaryCents');
  assertRateBps(person.baseRateBps, 'person.baseRateBps');
  assertRateBps(person.variableRateBps, 'person.variableRateBps');

  const baseContributionCents = roundHalfUpCents(salaryCents, person.baseRateBps);
  const variableContributionCents = roundHalfUpCents(bonusCents, person.variableRateBps);

  return {
    baseIncomeCents: salaryCents,
    variableIncomeCents: bonusCents,
    incomeCents: salaryCents + bonusCents,
    baseContributionCents,
    variableContributionCents,
    contributionCents: baseContributionCents + variableContributionCents,
  };
}

/**
 * Chiffres agrégés d'un mois : contributions A/B, total commun, total des
 * dépenses, reste (peut être négatif), détail par personne, loisirs après réserve, couverture de
 * la réserve.
 *
 *   remainingCents           = householdContributionCents − expensesTotalCents
 *   leisureCents             = max(0, remainingCents − reserveTargetCents)
 *   reserveCovered           = true si réserve = 0 (convention), sinon remaining ≥ réserve
 *   reserveShortfallCents    = max(0, reserveTargetCents − remainingCents)
 */
export function computeMonthSummary(input: MonthRecordInput): MonthSummary {
  // Un mois d'avant V3.1 (sans compléments) est normalisé à la volée :
  // contributions strictement identiques à l'ancien modèle à seuil.
  const record = normalizeMonthIncome(input);
  const a = computeContributionBreakdown(record.salaryACents, record.personA, record.bonusACents);
  const b = computeContributionBreakdown(record.salaryBCents, record.personB, record.bonusBCents);
  assertAmountCents(record.reserveTargetCents, 'record.reserveTargetCents');

  const householdContributionCents = a.contributionCents + b.contributionCents;
  let expensesTotalCents = 0;
  for (const expense of record.expenses) {
    assertAmountCents(expense.amountCents, 'expense.amountCents');
    expensesTotalCents += expense.amountCents;
  }

  const remainingCents = householdContributionCents - expensesTotalCents;
  const leisureCents = Math.max(0, remainingCents - record.reserveTargetCents);
  const reserveCovered =
    record.reserveTargetCents === 0 || remainingCents >= record.reserveTargetCents;
  const reserveShortfallCents = Math.max(0, record.reserveTargetCents - remainingCents);

  return {
    contributionACents: a.contributionCents,
    contributionBCents: b.contributionCents,
    breakdownA: a,
    breakdownB: b,
    householdContributionCents,
    expensesTotalCents,
    remainingCents,
    leisureCents,
    reserveCovered,
    reserveShortfallCents,
  };
}
