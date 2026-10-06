/**
 * « À payer ce mois » : quelles lignes, et combien sont cochées (simple
 * comptage des cases de @a2/core, aucun calcul financier).
 */
import type { MonthRecord } from '@a2/core';
import { isExpensePaid, isTransferPaid } from '@a2/core';

/** Ce qui est à payer ce mois : les deux virements, puis chaque dépense non nulle (ou déjà cochée). */
export function payableExpenses(month: MonthRecord): MonthRecord['expenses'] {
  return month.expenses.filter((e) => e.amountCents > 0 || isExpensePaid(month, e.id));
}

/** Progression « n sur total payés » (présentation : simple comptage des cases). */
export function paymentProgress(month: MonthRecord): { done: number; total: number } {
  const expenses = payableExpenses(month);
  const done =
    (isTransferPaid(month, 'A') ? 1 : 0) +
    (isTransferPaid(month, 'B') ? 1 : 0) +
    expenses.filter((e) => isExpensePaid(month, e.id)).length;
  return { done, total: expenses.length + 2 };
}
