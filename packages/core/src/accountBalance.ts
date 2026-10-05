/**
 * Solde du compte commun (V4) — remplace le « reste » affiché.
 *
 * REPORT AUTOMATIQUE : chaque mois complet, (versements − dépenses) s'ajoute
 * au solde estimé. « Recaler sur le compte » pose une correction (solde réel
 * au début d'un mois) qui remplace le report à partir de ce mois ; les mois
 * passés ne sont jamais réécrits.
 *
 *   ouverture(K)  = dernière correction C (C.monthKey ≤ K), puis
 *                   + Σ net(M) pour les mois connus C.monthKey ≤ M < K.
 *                   Sans correction : 0 au premier mois connu, puis
 *                   + Σ net(M) pour les mois connus M < K.
 *   net(M)        = contributions A + B − dépenses du mois (remainingCents)
 *   en ce moment  = ouverture(K) + virements cochés − dépenses cochées
 *   fin de mois   = ouverture(K) + net(K)
 *
 * Un mois absent de la liste (jamais ouvert) compte pour 0. Toutes les
 * valeurs sont en centimes exacts (l'affichage arrondit à l'euro).
 * Fonctions pures ; `source` = `appState.budget` (mois + balance).
 */

import { MAX_AMOUNT_CENTS } from './amounts.js';
import { computeMonthSummary } from './calculations.js';
import { isValidMonthKey } from './months.js';
import { paidTotals } from './payments.js';
import { isIsoTimestamp, isPlainObject, type Fail, type Ok } from './home/validationHelpers.js';
import type { BalanceCorrection, BudgetBalance, MonthRecordInput } from './types.js';

/** Note maximale d'une correction. */
export const BALANCE_NOTE_MAX = 200;
/** Nombre maximal de corrections gardées (une par mois : 50 ans). */
export const BALANCE_CORRECTIONS_MAX = 600;

/** Ce dont le calcul du solde a besoin (forme de `AppState['budget']`). */
export interface BalanceSource {
  months: readonly MonthRecordInput[];
  balance?: BudgetBalance;
}

/** Net d'un mois : versements − dépenses (peut être négatif). */
export function monthNetCents(month: MonthRecordInput): number {
  return computeMonthSummary(month).remainingCents;
}

function latestCorrection(source: BalanceSource, monthKey: string): BalanceCorrection | undefined {
  let best: BalanceCorrection | undefined;
  for (const c of source.balance?.corrections ?? []) {
    if (c.monthKey <= monthKey && (best === undefined || c.monthKey > best.monthKey)) best = c;
  }
  return best;
}

/** Solde du compte commun au début du mois `monthKey` (centimes, peut être négatif). */
export function openingBalance(source: BalanceSource, monthKey: string): number {
  if (!isValidMonthKey(monthKey)) throw new RangeError(`invalid month key: ${String(monthKey)}`);
  const correction = latestCorrection(source, monthKey);
  let balance = correction?.balanceCents ?? 0;
  const from = correction?.monthKey ?? '';
  for (const month of source.months) {
    if (month.monthKey >= from && month.monthKey < monthKey) balance += monthNetCents(month);
  }
  return balance;
}

/**
 * Solde estimé « en ce moment » : ouverture + virements cochés − dépenses
 * cochées du mois. Mois inconnu → ouverture.
 */
export function currentBalanceEstimate(source: BalanceSource, monthKey: string): number {
  const opening = openingBalance(source, monthKey);
  const month = source.months.find((m) => m.monthKey === monthKey);
  if (month === undefined) return opening;
  const summary = computeMonthSummary(month);
  const paid = paidTotals(month, { aCents: summary.contributionACents, bCents: summary.contributionBCents });
  return opening + paid.transfersCents - paid.expensesCents;
}

/** Projection de fin de mois : ouverture + tous les versements − toutes les dépenses. */
export function endOfMonthProjection(source: BalanceSource, monthKey: string): number {
  const opening = openingBalance(source, monthKey);
  const month = source.months.find((m) => m.monthKey === monthKey);
  return month === undefined ? opening : opening + monthNetCents(month);
}

/**
 * Solde d'ouverture correspondant à un solde réel constaté **maintenant** :
 * réel − (virements cochés − dépenses cochées). Pour « Recaler sur le
 * compte » depuis le solde affiché en ce moment.
 */
export function openingFromCurrentBalance(
  source: BalanceSource,
  monthKey: string,
  currentCents: number,
): number {
  const delta = currentBalanceEstimate(source, monthKey) - openingBalance(source, monthKey);
  return currentCents - delta;
}

/** Montant de solde valide : entier, |v| ≤ MAX_AMOUNT_CENTS (négatif permis). */
export function isBalanceCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_AMOUNT_CENTS;
}

function cleanNote(note: string | undefined): string | undefined {
  if (typeof note !== 'string') return undefined;
  const clean = note.trim().replace(/\s+/g, ' ').slice(0, BALANCE_NOTE_MAX);
  return clean === '' ? undefined : clean;
}

/**
 * « Recaler sur le compte » : pose la correction du mois (solde d'ouverture
 * réel). Une seule correction par mois : la dernière remplace la précédente
 * (même id conservé). Corrections triées par mois, bornées. Aucun mois n'est
 * modifié. Lève une RangeError si mois, montant ou horodatage invalides.
 */
export function recordBalanceCorrection<T extends BalanceSource>(
  source: T,
  monthKey: string,
  balanceCents: number,
  meta: { id: string; recordedAt: string; note?: string },
): T {
  if (!isValidMonthKey(monthKey)) throw new RangeError(`invalid month key: ${String(monthKey)}`);
  if (!isBalanceCents(balanceCents)) throw new RangeError('balanceCents must be a safe integer in range');
  if (!isIsoTimestamp(meta.recordedAt)) throw new RangeError('recordedAt must be ISO');
  const list = source.balance?.corrections ?? [];
  const previous = list.find((c) => c.monthKey === monthKey);
  if (previous === undefined && (typeof meta.id !== 'string' || meta.id === '')) {
    throw new RangeError('correction id required');
  }
  const correction: BalanceCorrection = {
    id: previous?.id ?? meta.id,
    monthKey,
    balanceCents,
    recordedAt: meta.recordedAt,
  };
  const note = cleanNote(meta.note);
  if (note !== undefined) correction.note = note;
  const next = [...list.filter((c) => c.monthKey !== monthKey), correction]
    .sort((a, b) => (a.monthKey < b.monthKey ? -1 : a.monthKey > b.monthKey ? 1 : 0))
    .slice(-BALANCE_CORRECTIONS_MAX);
  return { ...source, balance: { ...source.balance, corrections: next } };
}

/** Retire la correction du mois (annuler). Absente → même référence. */
export function removeBalanceCorrection<T extends BalanceSource>(source: T, monthKey: string): T {
  const list = source.balance?.corrections ?? [];
  if (!list.some((c) => c.monthKey === monthKey)) return source;
  return { ...source, balance: { ...source.balance, corrections: list.filter((c) => c.monthKey !== monthKey) } };
}

/** Correction posée pour ce mois, s'il y en a une. */
export function balanceCorrectionFor(source: BalanceSource, monthKey: string): BalanceCorrection | undefined {
  return source.balance?.corrections.find((c) => c.monthKey === monthKey);
}

/**
 * Validation de `budget.balance` (présent → strict) : corrections en
 * tableau (≤ BALANCE_CORRECTIONS_MAX), ids non vides uniques, une
 * correction par mois, montant entier (négatif permis), horodatage ISO,
 * note chaîne. Valeurs recopiées telles quelles (rechargement à l'identique).
 */
export function validateBudgetBalance(value: unknown): Ok<BudgetBalance> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'balance-not-object' };
  if (!Array.isArray(value.corrections)) return { ok: false, reason: 'balance-corrections-not-array' };
  if (value.corrections.length > BALANCE_CORRECTIONS_MAX) {
    return { ok: false, reason: 'balance-too-many-corrections' };
  }
  const ids = new Set<string>();
  const months = new Set<string>();
  const corrections: BalanceCorrection[] = [];
  for (const c of value.corrections) {
    if (!isPlainObject(c)) return { ok: false, reason: 'balance-correction-not-object' };
    if (typeof c.id !== 'string' || c.id === '') return { ok: false, reason: 'balance-invalid-id' };
    if (ids.has(c.id)) return { ok: false, reason: 'duplicate-balance-id' };
    ids.add(c.id);
    if (typeof c.monthKey !== 'string' || !isValidMonthKey(c.monthKey)) {
      return { ok: false, reason: 'balance-invalid-month' };
    }
    if (months.has(c.monthKey)) return { ok: false, reason: 'duplicate-balance-month' };
    months.add(c.monthKey);
    if (!isBalanceCents(c.balanceCents)) return { ok: false, reason: 'balance-invalid-amount' };
    if (!isIsoTimestamp(c.recordedAt)) return { ok: false, reason: 'balance-invalid-recorded-at' };
    const out: BalanceCorrection = {
      id: c.id,
      monthKey: c.monthKey,
      balanceCents: c.balanceCents,
      recordedAt: c.recordedAt,
    };
    if (c.note !== undefined) {
      if (typeof c.note !== 'string') return { ok: false, reason: 'balance-invalid-note' };
      out.note = c.note;
    }
    corrections.push(out);
  }
  return { ok: true, state: { corrections } };
}
