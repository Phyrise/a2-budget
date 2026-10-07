/**
 * Actions V4 du store : paiements du mois (cases à cocher), solde du compte
 * commun (« Recaler sur le compte ») et lanterne de pierre posée dans la
 * forêt. Même sémantique que les autres actions : transition PURE via
 * `transact` (ids et horloge capturés avant, sûr en StrictMode), résultat
 * synchrone, écriture sérialisée par le store.
 *
 * Lecture (pures, `@a2/core`) : `openingBalance(appState.budget, mois)`,
 * `currentBalanceEstimate(…)`, `endOfMonthProjection(…)`,
 * `isTransferPaid(mois, 'A')`, `isExpensePaid(mois, id)`,
 * `activeLantern(appState.focus)`, `unlockedLanterns(appState.focus)`.
 */
import { useCallback, useMemo } from 'react';
import {
  eurosToCents,
  openingFromCurrentBalance,
  recordBalanceCorrection as coreRecordBalanceCorrection,
  removeBalanceCorrection as coreRemoveBalanceCorrection,
  restoreBalanceCorrection as coreRestoreBalanceCorrection,
  type BalanceCorrection,
  type Expense,
  selectLantern as coreSelectLantern,
  setExpensePaid as coreSetExpensePaid,
  setTransferPaid as coreSetTransferPaid,
  type AppState,
  type MonthRecord,
} from '@a2/core';
import type { Transact } from './careActions';
import { newId } from './ids';
import { mapMonthOrCreate } from './budgetMonths';

export interface BudgetActions {
  /** Coche / décoche « virement d'AL (A) / d'AC (B) fait » pour ce mois. false si rien n'a changé. */
  setTransferPaid: (monthKey: string, person: 'A' | 'B', paid: boolean) => boolean;
  /** Coche / décoche « dépense payée » pour ce mois. false si dépense inconnue ou rien n'a changé. */
  setExpensePaid: (monthKey: string, expenseId: string, paid: boolean) => boolean;
  /**
   * « Recaler sur le compte » : solde réel en **euros entiers** (négatif
   * permis). Par défaut (`asOf: 'opening'`) c'est le solde au début du mois ;
   * avec `asOf: 'now'`, c'est le solde constaté maintenant (les virements et
   * dépenses déjà cochés sont retirés pour retrouver l'ouverture ; le solde
   * saisi est gardé dans `observedCents`). Une correction par mois, la
   * dernière remplace. false si saisie invalide.
   */
  recordBalanceCorrection: (
    monthKey: string,
    euros: number,
    note?: string,
    opts?: { asOf?: 'opening' | 'now' },
  ) => boolean;
  /** Retire la correction du mois (annuler un recalage). false si absente. */
  removeBalanceCorrection: (monthKey: string) => boolean;
  /** Annuler : remet une correction telle qu'elle était (id, montant exact, date, note). */
  restoreBalanceCorrection: (correction: BalanceCorrection) => boolean;
  /**
   * Annuler la suppression d'une dépense : la remet à l'identique (même id,
   * même place, cochée si elle l'était). false si l'id est déjà présent.
   */
  restoreExpense: (monthKey: string, expense: Expense, index: number, paid: boolean) => boolean;
  /** Choisit la lanterne de pierre posée dans la forêt. false si inconnue ou pas encore débloquée. */
  selectLantern: (id: string) => boolean;
}

function mapBudgetMonth(
  s: AppState,
  monthKey: string,
  fn: (m: MonthRecord) => MonthRecord,
): AppState {
  // Un mois seulement consulté (virtuel) est créé à cette première modification.
  const budget = mapMonthOrCreate(s.budget, monthKey, fn);
  return budget === s.budget ? s : { ...s, budget };
}

export function useBudgetActions(transact: Transact): BudgetActions {
  const setTransferPaid = useCallback(
    (monthKey: string, person: 'A' | 'B', paid: boolean): boolean =>
      transact((s) => {
        const next = mapBudgetMonth(s, monthKey, (m) => coreSetTransferPaid(m, person, paid));
        return { state: next, result: next !== s };
      }, false),
    [transact],
  );

  const setExpensePaid = useCallback(
    (monthKey: string, expenseId: string, paid: boolean): boolean =>
      transact((s) => {
        const next = mapBudgetMonth(s, monthKey, (m) => coreSetExpensePaid(m, expenseId, paid));
        return { state: next, result: next !== s };
      }, false),
    [transact],
  );

  const recordBalanceCorrection = useCallback(
    (monthKey: string, euros: number, note?: string, opts?: { asOf?: 'opening' | 'now' }): boolean => {
      const id = newId();
      const recordedAt = new Date().toISOString();
      return transact((s) => {
        try {
          const cents = eurosToCents(euros);
          const opening = opts?.asOf === 'now' ? openingFromCurrentBalance(s.budget, monthKey, cents) : cents;
          const budget = coreRecordBalanceCorrection(s.budget, monthKey, opening, {
            id,
            recordedAt,
            ...(note !== undefined ? { note } : {}),
            ...(opts?.asOf === 'now' ? { observedCents: cents } : {}),
          });
          return { state: { ...s, budget }, result: true };
        } catch {
          return { state: s, result: false };
        }
      }, false);
    },
    [transact],
  );

  const removeBalanceCorrection = useCallback(
    (monthKey: string): boolean =>
      transact((s) => {
        const budget = coreRemoveBalanceCorrection(s.budget, monthKey);
        return budget === s.budget ? { state: s, result: false } : { state: { ...s, budget }, result: true };
      }, false),
    [transact],
  );

  const restoreBalanceCorrection = useCallback(
    (correction: BalanceCorrection): boolean =>
      transact((s) => {
        try {
          const budget = coreRestoreBalanceCorrection(s.budget, correction);
          return { state: { ...s, budget }, result: true };
        } catch {
          return { state: s, result: false };
        }
      }, false),
    [transact],
  );

  const restoreExpense = useCallback(
    (monthKey: string, expense: Expense, index: number, paid: boolean): boolean =>
      transact((s) => {
        const next = mapBudgetMonth(s, monthKey, (m) => {
          if (m.expenses.some((e) => e.id === expense.id)) return m;
          const expenses = m.expenses.slice();
          expenses.splice(Math.max(0, Math.min(index, expenses.length)), 0, { ...expense });
          const restored = { ...m, expenses };
          return paid ? coreSetExpensePaid(restored, expense.id, true) : restored;
        });
        return { state: next, result: next !== s };
      }, false),
    [transact],
  );

  const selectLantern = useCallback(
    (id: string): boolean =>
      transact((s) => {
        const r = coreSelectLantern(s.focus, id);
        return r.changed && r.focus !== undefined
          ? { state: { ...s, focus: r.focus }, result: true }
          : { state: s, result: false };
      }, false),
    [transact],
  );

  return useMemo(
    () => ({
      setTransferPaid,
      setExpensePaid,
      recordBalanceCorrection,
      removeBalanceCorrection,
      restoreBalanceCorrection,
      restoreExpense,
      selectLantern,
    }),
    [setTransferPaid, setExpensePaid, recordBalanceCorrection, removeBalanceCorrection, restoreBalanceCorrection, restoreExpense, selectLantern],
  );
}
