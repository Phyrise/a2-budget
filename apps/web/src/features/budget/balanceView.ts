/**
 * Petits dérivés d'affichage du solde (aucun calcul financier : les chiffres
 * restent ceux de @a2/core).
 */
import type { AppState, MonthRecord } from '@a2/core';

/** Réserve retirée (V4.2) : l'humeur du Sans-Visage ne la lit plus. */
export const NO_RESERVE = 0;

/**
 * Source du solde avec le mois affiché : un mois virtuel (seulement
 * consulté, jamais écrit) y est ajouté pour calculer sa projection ; il ne
 * compte pas dans sa propre ouverture (seuls les mois antérieurs comptent).
 */
export function withDisplayedMonth(budget: AppState['budget'], month: MonthRecord): AppState['budget'] {
  if (budget.months.some((m) => m.monthKey === month.monthKey)) return budget;
  return { ...budget, months: [...budget.months, month] };
}
