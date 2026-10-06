import { computeMonthSummary, createMonthRecord, emptyAppState, setExpensePaid, setTransferPaid } from '@a2/core';
import { describe, expect, it } from 'vitest';
import { balanceFill, noFaceMood } from './chihiro/mood';
import { payableExpenses, paymentProgress } from './paymentItems';
import { parseSignedEuros } from './signedEuros';

const month = () => {
  const s = emptyAppState();
  return { ...createMonthRecord('2026-10', s.budget.settings), salaryACents: 220_000, salaryBCents: 300_000, bonusBCents: 67_500 };
};

describe('saisie du solde réel (recaler)', () => {
  it('euros entiers, signe permis, centimes refusés', () => {
    expect(parseSignedEuros('1500')).toEqual({ ok: true, euros: 1500 });
    expect(parseSignedEuros(' 1 234 € ')).toEqual({ ok: true, euros: 1234 });
    expect(parseSignedEuros('-120')).toEqual({ ok: true, euros: -120 });
    expect(parseSignedEuros('−1 200')).toEqual({ ok: true, euros: -1200 });
    expect(parseSignedEuros('-0')).toEqual({ ok: true, euros: 0 });
    expect(parseSignedEuros('12,50')).toEqual({ ok: false, reason: 'not-integer' });
    expect(parseSignedEuros('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseSignedEuros('abc')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('paiements du mois', () => {
  it('deux virements + chaque dépense non nulle ; la case cochée compte', () => {
    let m = month();
    expect(payableExpenses(m).map((e) => e.id)).not.toContain('other');
    expect(paymentProgress(m)).toEqual({ done: 0, total: 7 });
    m = setExpensePaid(setTransferPaid(m, 'B', true), 'rent', true);
    expect(paymentProgress(m)).toEqual({ done: 2, total: 7 });
  });
});

describe('Sans-Visage et rigole d’or (V4)', () => {
  it('la rigole suit le solde, rapporté à un mois de flux, bornée', () => {
    const s = computeMonthSummary(month());
    const reference = Math.max(s.householdContributionCents, s.expensesTotalCents);
    expect(balanceFill(0, s)).toBe(0);
    expect(balanceFill(-5_000, s)).toBe(0);
    expect(balanceFill(reference / 2, s)).toBeCloseTo(0.5);
    expect(balanceFill(reference * 3, s)).toBe(1);
  });

  it('timide seulement si la fin du mois passe sous zéro, jamais effrayant', () => {
    const s = computeMonthSummary(month());
    expect(noFaceMood(s, 0, -1)).toBe('shy');
    expect(noFaceMood(s, 0, 37_000)).not.toBe('shy');
  });
});
