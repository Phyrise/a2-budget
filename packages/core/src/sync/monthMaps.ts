/**
 * Mois et réglages du budget en « maps » (V5) : docs/SYNC_DESIGN.md §2.3.
 *
 * Un tableau est remplacé en bloc par une écriture : si AL change le loyer
 * pendant qu'AC ajoute une dépense, l'un effacerait l'autre. Les dépenses
 * (du mois et récurrentes) deviennent donc des maps `{ [id]: { label,
 * amountCents, order } }` et les paiements une map `{ transferA, transferB,
 * expenses: { [id]: booléen } }` : chacun n'écrit que ses champs.
 *
 * Relecture tolérante : une entrée incomplète (dépense supprimée par l'un,
 * modifiée en même temps par l'autre : seul le champ modifié subsiste) est
 * ignorée — la suppression l'emporte. Une map vide vaut « absente ».
 * Montants en centimes, inchangés. Fonctions pures ; la validation finale
 * reste celle de l'état (validateAppState).
 */

import { isPlainObject } from '../home/validationHelpers.js';
import type { Expense, MonthPaid, MonthRecord, Settings } from '../types.js';
import { allocateOrders, sortByOrder } from './order.js';

/** Une dépense dans une map (l'id est la clé). */
export interface ExpenseEntry {
  label: string;
  amountCents: number;
  order: number;
}

/** Dépenses par id. */
export type ExpenseMap = Record<string, ExpenseEntry>;

/** Document d'un mois (`months/{YYYY-MM}`). */
export interface MonthDoc extends Omit<MonthRecord, 'expenses' | 'paid'> {
  expenses: ExpenseMap;
  paid?: MonthPaid;
}

/** Document des réglages du budget (`settings/budget`). */
export interface SettingsDoc extends Omit<Settings, 'recurringExpenses'> {
  recurringExpenses: ExpenseMap;
}

function knownRank(map: unknown, id: string): number | undefined {
  if (!isPlainObject(map)) return undefined;
  const entry = map[id];
  return isPlainObject(entry) && typeof entry.order === 'number' ? entry.order : undefined;
}

/**
 * Liste → map. Les rangs déjà écrits dans `known` (la map actuelle) sont
 * gardés quand l'ordre ne change pas ; les nouvelles dépenses se placent
 * entre leurs voisines. Pur.
 */
export function expensesToMap(list: readonly Expense[], known?: unknown): ExpenseMap {
  const orders = allocateOrders(list.map((e) => e.id), (id) => knownRank(known, id));
  const map: ExpenseMap = {};
  list.forEach((e, i) => {
    map[e.id] = { label: e.label, amountCents: e.amountCents, order: orders[i]! };
  });
  return map;
}

/** Map → liste triée par `(order, id)` ; les entrées incomplètes sont ignorées. Pur. */
export function expensesFromMap(map: unknown): Expense[] {
  if (!isPlainObject(map)) return [];
  const entries: { id: string; order: number; label: string; amountCents: number }[] = [];
  for (const [id, entry] of Object.entries(map)) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry.label !== 'string' || typeof entry.amountCents !== 'number' ||
      typeof entry.order !== 'number') continue;
    entries.push({ id, order: entry.order, label: entry.label, amountCents: entry.amountCents });
  }
  return sortByOrder(entries).map(({ id, label, amountCents }) => ({ id, label, amountCents }));
}

/** Copie d'une map sans les sous-objets vides (une map vide vaut « absente »). */
function compactPaid(value: unknown): MonthPaid | undefined {
  if (!isPlainObject(value)) return undefined;
  const out: MonthPaid = {};
  if (typeof value.transferA === 'boolean') out.transferA = value.transferA;
  if (typeof value.transferB === 'boolean') out.transferB = value.transferB;
  if (isPlainObject(value.expenses)) {
    const expenses: Record<string, boolean> = {};
    for (const [id, flag] of Object.entries(value.expenses)) {
      if (typeof flag === 'boolean') expenses[id] = flag;
    }
    if (Object.keys(expenses).length > 0) out.expenses = expenses;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Mois → document. `known` : le document actuel (rangs des dépenses). Pur. */
export function monthToDoc(month: MonthRecord, known?: unknown): MonthDoc {
  const { expenses, paid, ...rest } = month;
  const doc: MonthDoc = {
    ...rest,
    personA: { ...month.personA },
    personB: { ...month.personB },
    expenses: expensesToMap(expenses, isPlainObject(known) ? known.expenses : undefined),
  };
  if (paid !== undefined) {
    doc.paid = { ...paid };
    if (paid.expenses !== undefined) doc.paid.expenses = { ...paid.expenses };
  }
  return doc;
}

/**
 * Document → mois (forme d'entrée, à valider). Les cases « payée » d'une
 * dépense absente du mois sont laissées au validateur (qui les retire). Pur.
 */
export function monthFromDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const { expenses, paid, ...rest } = doc;
  const month: Record<string, unknown> = { ...rest, expenses: expensesFromMap(expenses) };
  const compact = compactPaid(paid);
  if (compact !== undefined) month.paid = compact;
  return month;
}

/** Réglages → document. `known` : le document actuel (rangs). Pur. */
export function settingsToDoc(settings: Settings, known?: unknown): SettingsDoc {
  return {
    ...settings,
    personA: { ...settings.personA },
    personB: { ...settings.personB },
    recurringExpenses: expensesToMap(
      settings.recurringExpenses,
      isPlainObject(known) ? known.recurringExpenses : undefined,
    ),
  };
}

/** Document → réglages (forme d'entrée, à valider). Pur. */
export function settingsFromDoc(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, recurringExpenses: expensesFromMap(doc.recurringExpenses) };
}
