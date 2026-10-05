/**
 * Paiements du mois (V4) : cases à cocher « virement d'AL fait »,
 * « virement d'AC fait », « loyer payé »… Remises à zéro chaque mois (un
 * nouveau mois naît sans rien de coché : `createMonthRecord` ne copie jamais
 * `paid`). Fonctions pures.
 *
 * Représentation minimale : seule une case cochée est écrite (`true`) ;
 * décocher retire la clé, et `paid` disparaît quand plus rien n'est coché.
 * Un JSON existant (même avec des `false`) est rechargé à l'identique.
 */

import type { MonthPaid, MonthRecord } from './types.js';

function compact(paid: MonthPaid): MonthPaid | undefined {
  const out: MonthPaid = {};
  if (paid.transferA === true) out.transferA = true;
  if (paid.transferB === true) out.transferB = true;
  const expenses: Record<string, boolean> = {};
  let any = false;
  for (const [id, value] of Object.entries(paid.expenses ?? {})) {
    if (value === true) {
      expenses[id] = true;
      any = true;
    }
  }
  if (any) out.expenses = expenses;
  return out.transferA || out.transferB || out.expenses ? out : undefined;
}

function withPaid<T extends MonthRecord>(month: T, paid: MonthPaid): T {
  const next = compact(paid);
  const { paid: _previous, ...rest } = month;
  return (next === undefined ? rest : { ...rest, paid: next }) as T;
}

/** Vrai si le virement de la personne est coché pour ce mois. */
export function isTransferPaid(month: Pick<MonthRecord, 'paid'>, person: 'A' | 'B'): boolean {
  return (person === 'A' ? month.paid?.transferA : month.paid?.transferB) === true;
}

/** Vrai si la dépense est cochée « payée » pour ce mois. */
export function isExpensePaid(month: Pick<MonthRecord, 'paid'>, expenseId: string): boolean {
  const expenses = month.paid?.expenses;
  return expenses !== undefined && Object.hasOwn(expenses, expenseId) && expenses[expenseId] === true;
}

/**
 * Coche / décoche le virement de A ou B. Sans changement → même référence.
 */
export function setTransferPaid<T extends MonthRecord>(month: T, person: 'A' | 'B', paid: boolean): T {
  if (isTransferPaid(month, person) === paid) return month;
  const key = person === 'A' ? 'transferA' : 'transferB';
  return withPaid(month, { ...month.paid, [key]: paid });
}

/**
 * Coche / décoche une dépense du mois. Dépense inconnue du mois ou sans
 * changement → même référence.
 */
export function setExpensePaid<T extends MonthRecord>(month: T, expenseId: string, paid: boolean): T {
  if (!month.expenses.some((e) => e.id === expenseId)) return month;
  if (isExpensePaid(month, expenseId) === paid) return month;
  return withPaid(month, {
    ...month.paid,
    expenses: { ...month.paid?.expenses, [expenseId]: paid },
  });
}

/**
 * Nettoyage : retire des cases cochées les dépenses qui n'existent plus dans
 * le mois (dépense retirée, « Appliquer au mois affiché »). Rien à retirer →
 * même référence.
 */
export function prunePaidExpenses<T extends MonthRecord>(month: T): T {
  const expenses = month.paid?.expenses;
  if (expenses === undefined) return month;
  const ids = new Set(month.expenses.map((e) => e.id));
  const stale = Object.keys(expenses).filter((id) => !ids.has(id));
  if (stale.length === 0) return month;
  const kept: Record<string, boolean> = {};
  for (const [id, value] of Object.entries(expenses)) if (ids.has(id)) kept[id] = value;
  return withPaid(month, { ...month.paid, expenses: kept });
}

/**
 * Montants cochés du mois, en centimes : virements faits (contributions des
 * personnes cochées) et dépenses payées.
 */
export function paidTotals(
  month: Pick<MonthRecord, 'paid' | 'expenses'>,
  contributions: { aCents: number; bCents: number },
): { transfersCents: number; expensesCents: number } {
  let transfersCents = 0;
  if (isTransferPaid(month, 'A')) transfersCents += contributions.aCents;
  if (isTransferPaid(month, 'B')) transfersCents += contributions.bCents;
  let expensesCents = 0;
  for (const e of month.expenses) if (isExpensePaid(month, e.id)) expensesCents += e.amountCents;
  return { transfersCents, expensesCents };
}
