/**
 * Calculs du budget : contribution individuelle et agrégats mensuels.
 *
 * Formules : docs/SPEC.md (« Règles métier ») et docs/CONTRACTS.md §1.
 */

import { MAX_AMOUNT_CENTS, MAX_RATE_BPS } from './amounts.js';
import type {
  ContributionBreakdown,
  MonthRecord,
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
 * Contribution d'une personne pour un revenu donné.
 *
 *   baseIncomeCents           = min(salaryCents, person.baseSalaryCents)
 *   variableIncomeCents       = max(0, salaryCents − person.baseSalaryCents)
 *   baseContributionCents     = roundHalfUp(baseIncomeCents × person.baseRateBps / 10000)
 *   variableContributionCents = roundHalfUp(variableIncomeCents × person.variableRateBps / 10000)
 *   contributionCents         = baseContributionCents + variableContributionCents
 *
 * Chaque tranche est arrondie séparément au centime (demi-centime vers le
 * haut) avant l'addition. Lève une erreur sur entrée invalide (négatif,
 * non entier, hors plage).
 */
export function computeContributionBreakdown(
  salaryCents: number,
  person: PersonSettings,
): ContributionBreakdown {
  assertAmountCents(salaryCents, 'salaryCents');
  assertAmountCents(person.baseSalaryCents, 'person.baseSalaryCents');
  assertRateBps(person.baseRateBps, 'person.baseRateBps');
  assertRateBps(person.variableRateBps, 'person.variableRateBps');

  const baseIncomeCents = Math.min(salaryCents, person.baseSalaryCents);
  const variableIncomeCents = Math.max(0, salaryCents - person.baseSalaryCents);
  const baseContributionCents = roundHalfUpCents(baseIncomeCents, person.baseRateBps);
  const variableContributionCents = roundHalfUpCents(variableIncomeCents, person.variableRateBps);

  return {
    baseIncomeCents,
    variableIncomeCents,
    baseContributionCents,
    variableContributionCents,
    contributionCents: baseContributionCents + variableContributionCents,
  };
}

/**
 * Chiffres agrégés d'un mois : contributions A/B, total commun, total des
 * dépenses, reste (peut être négatif), loisirs après réserve, couverture de
 * la réserve.
 *
 *   remainingCents           = householdContributionCents − expensesTotalCents
 *   leisureCents             = max(0, remainingCents − reserveTargetCents)
 *   reserveCovered           = true si réserve = 0 (convention), sinon remaining ≥ réserve
 *   reserveShortfallCents    = max(0, reserveTargetCents − remainingCents)
 */
export function computeMonthSummary(record: MonthRecord): MonthSummary {
  const a = computeContributionBreakdown(record.salaryACents, record.personA);
  const b = computeContributionBreakdown(record.salaryBCents, record.personB);
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
    householdContributionCents,
    expensesTotalCents,
    remainingCents,
    leisureCents,
    reserveCovered,
    reserveShortfallCents,
  };
}
