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
  selectLantern as coreSelectLantern,
  setExpensePaid as coreSetExpensePaid,
  setTransferPaid as coreSetTransferPaid,
  type AppState,
  type MonthRecord,
} from '@a2/core';
import type { Transact } from './careActions';
import { newId } from './ids';

export interface BudgetActions {
  /** Coche / décoche « virement d'AL (A) / d'AC (B) fait » pour ce mois. false si rien n'a changé. */
  setTransferPaid: (monthKey: string, person: 'A' | 'B', paid: boolean) => boolean;
  /** Coche / décoche « dépense payée » pour ce mois. false si dépense inconnue ou rien n'a changé. */
  setExpensePaid: (monthKey: string, expenseId: string, paid: boolean) => boolean;
  /**
   * « Recaler sur le compte » : solde réel en **euros entiers** (négatif
   * permis). Par défaut (`asOf: 'opening'`) c'est le solde au début du mois ;
   * avec `asOf: 'now'`, c'est le solde constaté maintenant (les virements et
   * dépenses déjà cochés sont retirés pour retrouver l'ouverture). Une
   * correction par mois, la dernière remplace. false si saisie invalide.
   */
  recordBalanceCorrection: (
    monthKey: string,
    euros: number,
    note?: string,
    opts?: { asOf?: 'opening' | 'now' },
  ) => boolean;
  /** Retire la correction du mois (annuler un recalage). false si absente. */
  removeBalanceCorrection: (monthKey: string) => boolean;
  /** Choisit la lanterne de pierre posée dans la forêt. false si inconnue ou pas encore débloquée. */
  selectLantern: (id: string) => boolean;
}

function mapBudgetMonth(
  s: AppState,
  monthKey: string,
  fn: (m: MonthRecord) => MonthRecord,
): AppState {
  const index = s.budget.months.findIndex((m) => m.monthKey === monthKey);
  if (index === -1) return s;
  const current = s.budget.months[index]!;
  const next = fn(current);
  if (next === current) return s;
  const months = s.budget.months.slice();
  months[index] = next;
  return { ...s, budget: { ...s.budget, months } };
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
    () => ({ setTransferPaid, setExpensePaid, recordBalanceCorrection, removeBalanceCorrection, selectLantern }),
    [setTransferPaid, setExpensePaid, recordBalanceCorrection, removeBalanceCorrection, selectLantern],
  );
}
