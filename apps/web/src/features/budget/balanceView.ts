/**
 * Petits dérivés d'affichage du solde (aucun calcul financier : les chiffres
 * restent ceux de @a2/core).
 */
import { formatEuros, monthKeyToLabel, type AppState, type MonthRecord } from '@a2/core';
import { fr } from '../../ui';

/**
 * Source du solde avec le mois affiché : un mois virtuel (seulement
 * consulté, jamais écrit) y est ajouté pour calculer sa projection ; il ne
 * compte pas dans sa propre ouverture (seuls les mois antérieurs comptent).
 */
export function withDisplayedMonth(budget: AppState['budget'], month: MonthRecord): AppState['budget'] {
  if (budget.months.some((m) => m.monthKey === month.monthKey)) return budget;
  return { ...budget, months: [...budget.months, month] };
}

/** « Estimé depuis début octobre 2026, en partant de 0 € : recalez… » */
export function unconfirmedBalanceHint(sinceMonthKey: string | null): string {
  if (sinceMonthKey === null) return fr(`Estimé en partant de ${formatEuros(0)} : recalez quand vous regardez le vrai compte.`);
  const label = monthKeyToLabel(sinceMonthKey);
  const inline = label.charAt(0).toLowerCase() + label.slice(1);
  return fr(`Estimé depuis début ${inline}, en partant de ${formatEuros(0)} : recalez quand vous regardez le vrai compte.`);
}
