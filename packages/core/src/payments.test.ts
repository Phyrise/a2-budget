import { describe, expect, it } from 'vitest';
import {
  isExpensePaid,
  isTransferPaid,
  paidTotals,
  prunePaidExpenses,
  setExpensePaid,
  setTransferPaid,
} from './payments.js';
import { applySettingsToMonth, createMonthRecord, defaultSettings, ensureMonth, emptyState, validatePersistedState } from './state.js';
import type { MonthRecord } from './types.js';

const month = (): MonthRecord => createMonthRecord('2026-10', defaultSettings());

describe('paiements du mois — cases à cocher', () => {
  it('un nouveau mois commence sans rien de coché', () => {
    const m = month();
    expect(m.paid).toBeUndefined();
    expect(isTransferPaid(m, 'A')).toBe(false);
    expect(isExpensePaid(m, 'rent')).toBe(false);
  });

  it('un mois créé après un mois coché repart à zéro', () => {
    let s = ensureMonth(emptyState(), '2026-10');
    s = { ...s, months: s.months.map((m) => setTransferPaid(setExpensePaid(m, 'rent', true), 'A', true)) };
    s = ensureMonth(s, '2026-11');
    expect(s.months.find((m) => m.monthKey === '2026-11')!.paid).toBeUndefined();
    expect(s.months.find((m) => m.monthKey === '2026-10')!.paid).toEqual({ transferA: true, expenses: { rent: true } });
  });

  it('coche et décoche les virements (représentation minimale)', () => {
    const m = month();
    const a = setTransferPaid(m, 'A', true);
    expect(a.paid).toEqual({ transferA: true });
    expect(isTransferPaid(a, 'A')).toBe(true);
    expect(isTransferPaid(a, 'B')).toBe(false);
    const ab = setTransferPaid(a, 'B', true);
    expect(ab.paid).toEqual({ transferA: true, transferB: true });
    const b = setTransferPaid(ab, 'A', false);
    expect(b.paid).toEqual({ transferB: true });
    const none = setTransferPaid(b, 'B', false);
    expect('paid' in none).toBe(false);
    expect(m.paid).toBeUndefined(); // entrée jamais mutée
  });

  it('sans changement → même référence', () => {
    const m = month();
    expect(setTransferPaid(m, 'A', false)).toBe(m);
    const a = setTransferPaid(m, 'A', true);
    expect(setTransferPaid(a, 'A', true)).toBe(a);
    expect(setExpensePaid(m, 'inconnue', true)).toBe(m);
    expect(setExpensePaid(m, 'rent', false)).toBe(m);
  });

  it('coche les dépenses payées', () => {
    const m = setExpensePaid(setExpensePaid(month(), 'rent', true), 'electricity', true);
    expect(m.paid).toEqual({ expenses: { rent: true, electricity: true } });
    const back = setExpensePaid(m, 'rent', false);
    expect(back.paid).toEqual({ expenses: { electricity: true } });
    expect('paid' in setExpensePaid(back, 'electricity', false)).toBe(false);
  });

  it('nettoyage quand une dépense est retirée', () => {
    const m = setTransferPaid(setExpensePaid(setExpensePaid(month(), 'rent', true), 'internet', true), 'B', true);
    const removed = prunePaidExpenses({ ...m, expenses: m.expenses.filter((e) => e.id !== 'rent') });
    expect(removed.paid).toEqual({ transferB: true, expenses: { internet: true } });
    expect(prunePaidExpenses(removed)).toBe(removed);
    const onlyRent = setExpensePaid(month(), 'rent', true);
    expect('paid' in prunePaidExpenses({ ...onlyRent, expenses: [] })).toBe(false);
  });

  it('« Appliquer au mois affiché » garde les cases des dépenses encore présentes', () => {
    let s = ensureMonth(emptyState(), '2026-10');
    s = { ...s, months: s.months.map((m) => setTransferPaid(setExpensePaid(setExpensePaid(m, 'rent', true), 'other', true), 'A', true)) };
    s = { ...s, settings: { ...s.settings, recurringExpenses: s.settings.recurringExpenses.filter((e) => e.id !== 'other') } };
    const out = applySettingsToMonth(s, '2026-10');
    expect(out.months[0]!.paid).toEqual({ transferA: true, expenses: { rent: true } });
  });

  it('paidTotals : virements cochés et dépenses payées', () => {
    const m = setExpensePaid(setTransferPaid(month(), 'B', true), 'rent', true);
    expect(paidTotals(m, { aCents: 88_000, bCents: 120_000 })).toEqual({ transfersCents: 120_000, expensesCents: 130_000 });
    expect(paidTotals(month(), { aCents: 1, bCents: 2 })).toEqual({ transfersCents: 0, expensesCents: 0 });
  });

  it('une clé « __proto__ » ou héritée n’est jamais lue comme cochée', () => {
    expect(isExpensePaid(month(), 'toString')).toBe(false);
    expect(isExpensePaid({ paid: { expenses: {} } }, 'constructor')).toBe(false);
  });
});

describe('validation des paiements (validatePersistedState)', () => {
  const base = () => ensureMonth(emptyState(), '2026-10');
  const reload = (months: unknown[]) =>
    validatePersistedState(JSON.parse(JSON.stringify({ ...base(), months })));

  it('absent → omis ; présent → recopié à l’identique (false compris)', () => {
    const m = month();
    const r1 = reload([m]);
    expect(r1.ok && 'paid' in r1.state.months[0]!).toBe(false);
    const paid = { transferA: true, transferB: false, expenses: { rent: true, internet: false } };
    const r2 = reload([{ ...m, paid }]);
    expect(r2.ok && r2.state.months[0]!.paid).toEqual(paid);
    expect(r2.ok && JSON.stringify(r2.state.months[0])).toBe(JSON.stringify({ ...m, paid }));
  });

  it('types stricts', () => {
    const m = month();
    expect(reload([{ ...m, paid: 'oui' }])).toEqual({ ok: false, reason: 'month-invalid-paid' });
    expect(reload([{ ...m, paid: { transferA: 1 } }])).toEqual({ ok: false, reason: 'month-invalid-paid' });
    expect(reload([{ ...m, paid: { expenses: [] } }])).toEqual({ ok: false, reason: 'month-invalid-paid' });
    expect(reload([{ ...m, paid: { expenses: { rent: 'yes' } } }])).toEqual({ ok: false, reason: 'month-invalid-paid' });
  });

  it('une case de dépense inconnue est nettoyée (jamais illisible)', () => {
    const r = reload([{ ...month(), paid: { expenses: { rent: true, disparue: true } } }]);
    expect(r.ok && r.state.months[0]!.paid).toEqual({ expenses: { rent: true } });
  });

  it('null est traité comme absent', () => {
    const r = reload([{ ...month(), paid: null }]);
    expect(r.ok && 'paid' in r.state.months[0]!).toBe(false);
  });
});
