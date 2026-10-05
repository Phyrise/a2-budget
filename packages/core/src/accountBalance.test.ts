import { describe, expect, it } from 'vitest';
import {
  balanceCorrectionFor,
  currentBalanceEstimate,
  endOfMonthProjection,
  monthNetCents,
  openingBalance,
  openingFromCurrentBalance,
  recordBalanceCorrection,
  removeBalanceCorrection,
  validateBudgetBalance,
  BALANCE_NOTE_MAX,
} from './accountBalance.js';
import { setExpensePaid, setTransferPaid } from './payments.js';
import { createMonthRecord, defaultSettings } from './state.js';
import type { BudgetBalance, MonthRecord } from './types.js';

const AT = '2026-10-05T19:00:00.000Z';
const NET = 23_500; // 880 + 1200 − 1845 = 235 € par mois (réglages par défaut)

function months(...keys: string[]): MonthRecord[] {
  return keys.map((k) => createMonthRecord(k, defaultSettings()));
}

function source(list: MonthRecord[], balance?: BudgetBalance) {
  return balance === undefined ? { months: list } : { months: list, balance };
}

describe('report automatique (sans correction)', () => {
  it('net du mois = versements − dépenses', () => {
    expect(monthNetCents(months('2026-10')[0]!)).toBe(NET);
  });

  it('départ à 0 au premier mois connu, puis cumul des mois complets', () => {
    const src = source(months('2026-08', '2026-09', '2026-10'));
    expect(openingBalance(src, '2026-08')).toBe(0);
    expect(openingBalance(src, '2026-09')).toBe(NET);
    expect(openingBalance(src, '2026-10')).toBe(2 * NET);
    expect(openingBalance(src, '2026-07')).toBe(0);
    expect(openingBalance(src, '2027-01')).toBe(3 * NET);
  });

  it('ordre des mois indifférent ; un mois jamais ouvert compte pour 0', () => {
    const src = source(months('2026-10', '2026-06', '2026-09'));
    expect(openingBalance(src, '2026-10')).toBe(2 * NET);
  });

  it('un mois déficitaire fait baisser le solde (négatif permis)', () => {
    const [m] = months('2026-10');
    const deficit = { ...m!, expenses: [...m!.expenses, { id: 'x', label: 'Réparation', amountCents: 50_000 }] };
    const src = source([deficit, ...months('2026-11')]);
    expect(openingBalance(src, '2026-11')).toBe(NET - 50_000);
  });

  it('mois d’avant V3.1 (sans compléments) accepté', () => {
    const { bonusACents: _a, bonusBCents: _b, ...legacy } = months('2026-09')[0]!;
    expect(openingBalance({ months: [legacy, ...months('2026-10')] }, '2026-10')).toBe(NET);
  });

  it('clé invalide → RangeError', () => {
    expect(() => openingBalance(source([]), '2026-13')).toThrow(RangeError);
  });
});

describe('en ce moment / fin de mois', () => {
  it('rien de coché : en ce moment = ouverture ; fin de mois = ouverture + net', () => {
    const src = source(months('2026-09', '2026-10'));
    expect(currentBalanceEstimate(src, '2026-10')).toBe(NET);
    expect(endOfMonthProjection(src, '2026-10')).toBe(2 * NET);
  });

  it('virements cochés − dépenses cochées', () => {
    const [sep, oct] = months('2026-09', '2026-10');
    const checked = setExpensePaid(setTransferPaid(setTransferPaid(oct!, 'A', true), 'B', true), 'rent', true);
    const src = source([sep!, checked]);
    expect(currentBalanceEstimate(src, '2026-10')).toBe(NET + 88_000 + 120_000 - 130_000);
    expect(endOfMonthProjection(src, '2026-10')).toBe(2 * NET); // projection : tout compte
  });

  it('tout coché : en ce moment = projection de fin de mois', () => {
    let [oct] = months('2026-10');
    oct = setTransferPaid(setTransferPaid(oct!, 'A', true), 'B', true);
    for (const e of oct.expenses) oct = setExpensePaid(oct, e.id, true);
    const src = source([oct]);
    expect(currentBalanceEstimate(src, '2026-10')).toBe(endOfMonthProjection(src, '2026-10'));
  });

  it('mois inconnu → ouverture', () => {
    const src = source(months('2026-09'));
    expect(currentBalanceEstimate(src, '2026-11')).toBe(NET);
    expect(endOfMonthProjection(src, '2026-11')).toBe(NET);
  });
});

describe('« Recaler sur le compte »', () => {
  it('la correction remplace le report à partir de son mois', () => {
    const list = months('2026-08', '2026-09', '2026-10', '2026-11');
    const src = recordBalanceCorrection(source(list), '2026-10', 100_000, { id: 'c1', recordedAt: AT });
    expect(openingBalance(src, '2026-08')).toBe(0);
    expect(openingBalance(src, '2026-09')).toBe(NET); // passé jamais réécrit
    expect(openingBalance(src, '2026-10')).toBe(100_000);
    expect(openingBalance(src, '2026-11')).toBe(100_000 + NET);
    expect(src.months).toBe(list);
  });

  it('une correction par mois : la dernière remplace (id conservé)', () => {
    let src = source(months('2026-10'));
    src = recordBalanceCorrection(src, '2026-10', 100_000, { id: 'c1', recordedAt: AT, note: '  relevé   banque ' });
    expect(balanceCorrectionFor(src, '2026-10')).toEqual({ id: 'c1', monthKey: '2026-10', balanceCents: 100_000, recordedAt: AT, note: 'relevé banque' });
    src = recordBalanceCorrection(src, '2026-10', -2_500, { id: 'c2', recordedAt: AT });
    expect(src.balance!.corrections).toEqual([{ id: 'c1', monthKey: '2026-10', balanceCents: -2_500, recordedAt: AT }]);
    expect(openingBalance(src, '2026-10')).toBe(-2_500);
  });

  it('corrections triées ; la plus récente ≤ mois fait foi', () => {
    let src = source(months('2026-08', '2026-09', '2026-10'));
    src = recordBalanceCorrection(src, '2026-10', 5_000, { id: 'b', recordedAt: AT });
    src = recordBalanceCorrection(src, '2026-08', 1_000, { id: 'a', recordedAt: AT });
    expect(src.balance!.corrections.map((c) => c.monthKey)).toEqual(['2026-08', '2026-10']);
    expect(openingBalance(src, '2026-09')).toBe(1_000 + NET);
    expect(openingBalance(src, '2026-10')).toBe(5_000);
  });

  it('depuis le solde constaté maintenant', () => {
    const [oct] = months('2026-10');
    const src = source([setTransferPaid(oct!, 'A', true)]);
    const opening = openingFromCurrentBalance(src, '2026-10', 300_000);
    expect(opening).toBe(300_000 - 88_000);
    const fixed = recordBalanceCorrection(src, '2026-10', opening, { id: 'c', recordedAt: AT });
    expect(currentBalanceEstimate(fixed, '2026-10')).toBe(300_000);
  });

  it('entrées invalides → RangeError ; pur', () => {
    const src = source(months('2026-10'));
    expect(() => recordBalanceCorrection(src, '2026-1', 0, { id: 'x', recordedAt: AT })).toThrow(RangeError);
    expect(() => recordBalanceCorrection(src, '2026-10', 1.5, { id: 'x', recordedAt: AT })).toThrow(RangeError);
    expect(() => recordBalanceCorrection(src, '2026-10', 0, { id: 'x', recordedAt: 'hier' })).toThrow(RangeError);
    expect(() => recordBalanceCorrection(src, '2026-10', 0, { id: '', recordedAt: AT })).toThrow(RangeError);
    expect(src.balance).toBeUndefined();
  });

  it('note bornée, vide omise', () => {
    const long = 'x'.repeat(BALANCE_NOTE_MAX + 50);
    const src = recordBalanceCorrection(source([]), '2026-10', 0, { id: 'c', recordedAt: AT, note: long });
    expect(src.balance!.corrections[0]!.note).toHaveLength(BALANCE_NOTE_MAX);
    const blank = recordBalanceCorrection(source([]), '2026-10', 0, { id: 'c', recordedAt: AT, note: '   ' });
    expect('note' in blank.balance!.corrections[0]!).toBe(false);
  });

  it('retirer une correction (annuler)', () => {
    const src = recordBalanceCorrection(source(months('2026-10')), '2026-10', 9_900, { id: 'c', recordedAt: AT });
    const back = removeBalanceCorrection(src, '2026-10');
    expect(back.balance!.corrections).toEqual([]);
    expect(openingBalance(back, '2026-10')).toBe(0);
    expect(removeBalanceCorrection(back, '2026-10')).toBe(back);
  });
});

describe('validateBudgetBalance', () => {
  const c = { id: 'c', monthKey: '2026-10', balanceCents: -12_300, recordedAt: AT };

  it('recopie à l’identique (négatif et note compris)', () => {
    const value = { corrections: [c, { ...c, id: 'd', monthKey: '2026-11', note: 'Relevé' }] };
    expect(validateBudgetBalance(value)).toEqual({ ok: true, state: value });
  });

  it('raisons stables', () => {
    expect(validateBudgetBalance([])).toEqual({ ok: false, reason: 'balance-not-object' });
    expect(validateBudgetBalance({})).toEqual({ ok: false, reason: 'balance-corrections-not-array' });
    expect(validateBudgetBalance({ corrections: [1] })).toEqual({ ok: false, reason: 'balance-correction-not-object' });
    expect(validateBudgetBalance({ corrections: [{ ...c, id: '' }] })).toEqual({ ok: false, reason: 'balance-invalid-id' });
    expect(validateBudgetBalance({ corrections: [c, { ...c, monthKey: '2026-11' }] })).toEqual({ ok: false, reason: 'duplicate-balance-id' });
    expect(validateBudgetBalance({ corrections: [c, { ...c, id: 'd' }] })).toEqual({ ok: false, reason: 'duplicate-balance-month' });
    expect(validateBudgetBalance({ corrections: [{ ...c, monthKey: '2026-13' }] })).toEqual({ ok: false, reason: 'balance-invalid-month' });
    expect(validateBudgetBalance({ corrections: [{ ...c, balanceCents: 1.5 }] })).toEqual({ ok: false, reason: 'balance-invalid-amount' });
    expect(validateBudgetBalance({ corrections: [{ ...c, balanceCents: -1e12 }] })).toEqual({ ok: false, reason: 'balance-invalid-amount' });
    expect(validateBudgetBalance({ corrections: [{ ...c, recordedAt: 'x' }] })).toEqual({ ok: false, reason: 'balance-invalid-recorded-at' });
    expect(validateBudgetBalance({ corrections: [{ ...c, note: 3 }] })).toEqual({ ok: false, reason: 'balance-invalid-note' });
  });
});
