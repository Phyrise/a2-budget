import { describe, expect, it } from 'vitest';
import {
  alignBudgetRules,
  applySharedRates,
  computeMonthSummary,
  createMonthRecord,
  defaultSettings,
  emptyAppState,
  monthNetCents,
  openingBalance,
  validatePersistedState,
} from './index.js';
import type { MonthRecord, PersistedState, Settings } from './types.js';

const NOW = '2026-10';

/** Mois aux taux donnés (A et B identiques sauf précision). */
function month(key: string, settings: Settings, b?: { baseRateBps: number; variableRateBps: number }): MonthRecord {
  const m = createMonthRecord(key, settings);
  return b ? { ...m, personB: { ...m.personB, ...b } } : m;
}

function stateWith(settings: Settings, months: MonthRecord[]): PersistedState {
  return { schemaVersion: 1, settings, months, selectedMonth: NOW };
}

function ratesOf(m: Pick<MonthRecord, 'personA' | 'personB'>): number[] {
  return [m.personA.baseRateBps, m.personA.variableRateBps, m.personB.baseRateBps, m.personB.variableRateBps];
}

describe('applySharedRates — taux globaux', () => {
  const settings = defaultSettings();
  const base = stateWith(settings, [month('2026-08', settings), month('2026-09', settings), month(NOW, settings), month('2026-12', settings)]);

  it('met à jour les réglages, le mois courant et les suivants ; les mois passés gardent leurs taux', () => {
    const next = applySharedRates(base, 3500, 2500, NOW);
    expect(ratesOf(next.settings)).toEqual([3500, 2500, 3500, 2500]);
    const byKey = Object.fromEntries(next.months.map((m) => [m.monthKey, ratesOf(m)]));
    expect(byKey['2026-08']).toEqual([4000, 2000, 4000, 2000]);
    expect(byKey['2026-09']).toEqual([4000, 2000, 4000, 2000]);
    expect(byKey[NOW]).toEqual([3500, 2500, 3500, 2500]);
    expect(byKey['2026-12']).toEqual([3500, 2500, 3500, 2500]);
    // Les mois passés sont les mêmes objets (historique clos).
    expect(next.months[0]).toBe(base.months[0]);
    expect(next.months[1]).toBe(base.months[1]);
  });

  it('change la part à verser du mois courant, jamais le solde reporté', () => {
    const budget = { ...emptyAppState().budget, settings, months: base.months, selectedMonth: NOW };
    const before = computeMonthSummary(budget.months[2]!);
    const opening = openingBalance(budget, NOW);
    const next = applySharedRates(budget, 3000, 2000, NOW);
    const after = computeMonthSummary(next.months[2]!);
    expect(before.contributionACents).toBe(88_000);
    expect(after.contributionACents).toBe(66_000);
    expect(openingBalance(next, NOW)).toBe(opening);
    expect(monthNetCents(next.months[1]!)).toBe(monthNetCents(base.months[1]!));
  });

  it('est idempotente : rien à changer → même référence', () => {
    const next = applySharedRates(base, 3500, 2500, NOW);
    expect(applySharedRates(next, 3500, 2500, NOW)).toBe(next);
    expect(applySharedRates(base, 4000, 2000, NOW)).toBe(base);
  });

  it('ne réécrit que ce qui diffère (réglages déjà alignés, mois à aligner)', () => {
    const s = stateWith(settings, [month(NOW, settings, { baseRateBps: 3000, variableRateBps: 1500 })]);
    const next = applySharedRates(s, 4000, 2000, NOW);
    expect(next.settings).toBe(s.settings);
    expect(ratesOf(next.months[0]!)).toEqual([4000, 2000, 4000, 2000]);
  });

  it('lève sur un taux ou une clé de mois invalide', () => {
    expect(() => applySharedRates(base, 10_001, 2000, NOW)).toThrow(RangeError);
    expect(() => applySharedRates(base, 4000, 1.5, NOW)).toThrow(RangeError);
    expect(() => applySharedRates(base, 4000, 2000, '2026-13')).toThrow(RangeError);
  });

  it('ne mute jamais l’entrée', () => {
    const snapshot = JSON.stringify(base);
    applySharedRates(base, 1000, 1000, NOW);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('alignBudgetRules — migration V4.2', () => {
  it('réglages hérités A ≠ B : alignés sur A, appliqués au mois courant et aux suivants', () => {
    const settings = defaultSettings();
    const legacy: Settings = { ...settings, personB: { ...settings.personB, baseRateBps: 3000, variableRateBps: 1500 } };
    const odd = { baseRateBps: 3000, variableRateBps: 1500 };
    const s = stateWith(legacy, [month('2026-09', settings, odd), month(NOW, settings, odd), month('2026-11', settings, odd)]);
    const next = alignBudgetRules(s, NOW);
    expect(ratesOf(next.settings)).toEqual([4000, 2000, 4000, 2000]);
    expect(ratesOf(next.months[0]!)).toEqual([4000, 2000, 3000, 1500]);
    expect(ratesOf(next.months[1]!)).toEqual([4000, 2000, 4000, 2000]);
    expect(ratesOf(next.months[2]!)).toEqual([4000, 2000, 4000, 2000]);
    expect(alignBudgetRules(next, NOW)).toBe(next);
  });

  it('mois courant resté aux anciens taux (réglages changés avant V4.2) : rattrapé', () => {
    const settings = { ...defaultSettings() };
    const old = month(NOW, settings);
    const s = stateWith(applySharedRates(stateWith(settings, []), 3500, 2000, NOW).settings, [old]);
    expect(ratesOf(alignBudgetRules(s, NOW).months[0]!)).toEqual([3500, 2000, 3500, 2000]);
  });

  it('réserve neutralisée : réglages, mois courant et suivants à 0 ; mois passés intacts', () => {
    const settings = { ...defaultSettings(), defaultReserveTargetCents: 20_000 };
    const s = stateWith(settings, [month('2026-09', settings), month(NOW, settings), month('2027-01', settings)]);
    const next = alignBudgetRules(s, NOW);
    expect(next.settings.defaultReserveTargetCents).toBe(0);
    expect(next.months.map((m) => m.reserveTargetCents)).toEqual([20_000, 0, 0]);
    expect(next.months[0]).toBe(s.months[0]);
    expect(alignBudgetRules(next, NOW)).toBe(next);
    // Données toujours valides.
    expect(validatePersistedState(next).ok).toBe(true);
  });

  it('état déjà conforme : même référence', () => {
    const settings = defaultSettings();
    const s = stateWith(settings, [month(NOW, settings)]);
    expect(alignBudgetRules(s, NOW)).toBe(s);
  });
});
