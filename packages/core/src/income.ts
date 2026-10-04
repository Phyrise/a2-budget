/**
 * Revenus du mois (V3.1) : salaire + compléments, taux communs du couple.
 *
 * Modèle : chaque mois, chaque personne a un **salaire** (entièrement au taux
 * de base) et des **compléments** facultatifs (heures sup, astreintes, gardes
 * — souvent payés le mois suivant) au taux au-delà. Le « salaire de base » des
 * réglages devient le **salaire habituel** qui préremplit un nouveau mois.
 *
 * Données d'avant V3.1 (modèle à seuil) : `normalizeMonthIncome` reconstitue
 * les compléments à partir du seuil du mois, de sorte que les contributions
 * restent **strictement identiques**.
 */

import { MAX_RATE_BPS } from './amounts.js';
import type { MonthRecord, MonthRecordInput, Settings, SharedRates } from './types.js';

/**
 * Normalise les revenus d'un mois vers le modèle salaire + compléments.
 *
 * Pour chaque personne dont les compléments sont absents (ancien modèle) :
 *   compléments = max(0, salaire − salaireDeBase des règles du mois)
 *   salaire     = min(salaire, salaireDeBase)
 * Comme chaque tranche était déjà arrondie séparément, la contribution est
 * identique au centime près. Un mois déjà normalisé est renvoyé tel quel
 * (même référence) : la fonction est idempotente. Pure.
 */
export function normalizeMonthIncome(month: MonthRecordInput): MonthRecord {
  if (typeof month.bonusACents === 'number' && typeof month.bonusBCents === 'number') {
    return month as MonthRecord;
  }
  const a = splitLegacy(month.salaryACents, month.personA.baseSalaryCents, month.bonusACents);
  const b = splitLegacy(month.salaryBCents, month.personB.baseSalaryCents, month.bonusBCents);
  return {
    ...month,
    salaryACents: a.salary,
    bonusACents: a.bonus,
    salaryBCents: b.salary,
    bonusBCents: b.bonus,
  };
}

function splitLegacy(
  salary: number,
  threshold: number,
  bonus: number | undefined,
): { salary: number; bonus: number } {
  if (typeof bonus === 'number') return { salary, bonus };
  return { salary: Math.min(salary, threshold), bonus: Math.max(0, salary - threshold) };
}

function assertRate(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_RATE_BPS) {
    throw new RangeError(`${label} must be an integer in [0, ${MAX_RATE_BPS}]`);
  }
}

/** Taux communs du couple. La personne A fait foi si les deux diffèrent. */
export function sharedRates(settings: Pick<Settings, 'personA'>): SharedRates {
  return {
    baseRateBps: settings.personA.baseRateBps,
    variableRateBps: settings.personA.variableRateBps,
  };
}

/** Vrai si les deux personnes ont déjà les mêmes taux. */
export function hasSharedRates(settings: Pick<Settings, 'personA' | 'personB'>): boolean {
  return (
    settings.personA.baseRateBps === settings.personB.baseRateBps &&
    settings.personA.variableRateBps === settings.personB.variableRateBps
  );
}

/**
 * Écrit les taux communs pour les deux personnes (les champs par personne
 * restent dans les données pour la compatibilité). Pure ; lève sur un taux
 * invalide. Fonctionne sur les réglages comme sur les règles d'un mois.
 */
export function setSharedRates<T extends Pick<Settings, 'personA' | 'personB'>>(
  target: T,
  baseRateBps: number,
  variableRateBps: number,
): T {
  assertRate(baseRateBps, 'baseRateBps');
  assertRate(variableRateBps, 'variableRateBps');
  return {
    ...target,
    personA: { ...target.personA, baseRateBps, variableRateBps },
    personB: { ...target.personB, baseRateBps, variableRateBps },
  };
}

/** Revenu total d'une personne pour un mois (salaire + compléments). */
export function monthIncomeCents(month: MonthRecordInput, person: 'A' | 'B'): number {
  const m = normalizeMonthIncome(month);
  return person === 'A' ? m.salaryACents + m.bonusACents : m.salaryBCents + m.bonusBCents;
}
