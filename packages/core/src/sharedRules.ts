/**
 * Règles communes globales (V4.2) : taux du couple et réserve.
 *
 * Les taux sont **globaux** : les changer met à jour les réglages ET tous
 * les mois dont la clé est ≥ au mois courant réel (`fromMonthKey`). Les mois
 * passés gardent leurs taux : l'historique est clos, le solde reporté du
 * compte commun ne bouge jamais rétroactivement.
 *
 * La réserve a quitté l'interface : `alignBudgetRules` la neutralise (0)
 * dans les réglages et pour le mois courant et les suivants. Les mois passés
 * gardent leur valeur (sans effet sur le solde, qui ne la lit pas).
 *
 * Fonctions pures et idempotentes : la même référence est renvoyée quand
 * rien ne change.
 */

import { assertRateBps } from './calculations.js';
import { setSharedRates, sharedRates } from './income.js';
import { compareMonthKeys, isValidMonthKey } from './months.js';
import type { MonthRecord, PersistedState, PersonSettings } from './types.js';

/** Ce que touchent les règles communes : réglages et mois (PersistedState ou budget V2). */
type BudgetRules = Pick<PersistedState, 'settings' | 'months'>;

function hasRates(p: PersonSettings, baseRateBps: number, variableRateBps: number): boolean {
  return p.baseRateBps === baseRateBps && p.variableRateBps === variableRateBps;
}

function assertMonthKey(key: string): void {
  if (!isValidMonthKey(key)) throw new RangeError(`invalid month key: ${String(key)}`);
}

/** Vrai si le mois est le mois courant ou un mois à venir. */
function isOpen(month: MonthRecord, fromMonthKey: string): boolean {
  return compareMonthKeys(month.monthKey, fromMonthKey) >= 0;
}

/**
 * Écrit les taux communs dans les réglages (pour les deux personnes) et dans
 * chaque mois de clé ≥ `fromMonthKey` ; les mois antérieurs sont intacts.
 * Lève sur un taux ou une clé invalide.
 */
export function applySharedRates<S extends BudgetRules>(
  state: S,
  baseRateBps: number,
  variableRateBps: number,
  fromMonthKey: string,
): S {
  assertRateBps(baseRateBps, 'baseRateBps');
  assertRateBps(variableRateBps, 'variableRateBps');
  assertMonthKey(fromMonthKey);
  const aligned = (t: Pick<MonthRecord, 'personA' | 'personB'>) =>
    hasRates(t.personA, baseRateBps, variableRateBps) && hasRates(t.personB, baseRateBps, variableRateBps);

  const settings = aligned(state.settings) ? state.settings : setSharedRates(state.settings, baseRateBps, variableRateBps);
  let monthsChanged = false;
  const months = state.months.map((m) => {
    if (!isOpen(m, fromMonthKey) || aligned(m)) return m;
    monthsChanged = true;
    return setSharedRates(m, baseRateBps, variableRateBps);
  });
  if (settings === state.settings && !monthsChanged) return state;
  return { ...state, settings, months: monthsChanged ? months : state.months };
}

/**
 * Migration idempotente (chargement, import) : réglages alignés sur les taux
 * communs (A fait foi si A ≠ B), appliqués au mois courant et aux suivants ;
 * réserve neutralisée (réglages, mois courant et suivants).
 */
export function alignBudgetRules<S extends BudgetRules>(state: S, fromMonthKey: string): S {
  const rates = sharedRates(state.settings);
  const next = applySharedRates(state, rates.baseRateBps, rates.variableRateBps, fromMonthKey);
  const reserved = (m: MonthRecord) => isOpen(m, fromMonthKey) && m.reserveTargetCents !== 0;
  if (next.settings.defaultReserveTargetCents === 0 && !next.months.some(reserved)) return next;
  return {
    ...next,
    settings: { ...next.settings, defaultReserveTargetCents: 0 },
    months: next.months.map((m) => (reserved(m) ? { ...m, reserveTargetCents: 0 } : m)),
  };
}
