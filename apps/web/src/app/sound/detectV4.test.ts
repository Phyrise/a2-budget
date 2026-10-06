import {
  LANTERNS,
  addFocusSession,
  createMonthRecord,
  emptyAppState,
  recordBalanceCorrection,
  setExpensePaid,
  setTransferPaid,
  type AppState,
  type MonthRecord,
} from '@a2/core';
import { describe, expect, it } from 'vitest';
import { detectV4SoundEvents, lanternLitNow } from './detectV4';

const KEY = '2026-10';

function withMonth(): AppState {
  const s = emptyAppState();
  const month: MonthRecord = {
    ...createMonthRecord(KEY, s.budget.settings),
    expenses: [
      { id: 'loyer', label: 'Loyer', amountCents: 90_000 },
      { id: 'elec', label: 'Électricité', amountCents: 6_000 },
    ],
  };
  return { ...s, budget: { ...s.budget, months: [month], selectedMonth: KEY } };
}

function editMonth(s: AppState, f: (m: MonthRecord) => MonthRecord): AppState {
  return { ...s, budget: { ...s.budget, months: s.budget.months.map((m) => (m.monthKey === KEY ? f(m) : m)) } };
}

function addSessions(s: AppState, n: number, from = 0): AppState {
  let focus = s.focus;
  for (let i = 0; i < n; i++) {
    focus = addFocusSession(focus, { id: `f${from + i}`, startedAt: '2026-10-05T09:00:00.000Z', minutes: 10, who: 'a' }).focus;
  }
  return { ...s, focus };
}

const cues = (prev: AppState | null, next: AppState | null) => detectV4SoundEvents(prev, next).map((e) => e.cue);

describe('sons V4 : paiements du mois', () => {
  it('virement coché → « nom » ; décoché → rien', () => {
    const a = withMonth();
    const b = editMonth(a, (m) => setTransferPaid(m, 'A', true));
    expect(cues(a, b)).toEqual(['nom']);
    expect(cues(b, editMonth(b, (m) => setTransferPaid(m, 'A', false)))).toEqual([]);
  });

  it('dépense payée → « nom » ; jamais au premier rendu', () => {
    const a = withMonth();
    const b = editMonth(a, (m) => setExpensePaid(m, 'loyer', true));
    expect(cues(a, b)).toEqual(['nom']);
    expect(cues(null, b)).toEqual([]);
    expect(cues(b, b)).toEqual([]);
  });

  it('un nouveau mois (rien de coché) ne sonne pas', () => {
    const a = withMonth();
    const other = createMonthRecord('2026-11', a.budget.settings);
    const b = { ...a, budget: { ...a.budget, months: [...a.budget.months, other] } };
    expect(cues(a, b)).toEqual([]);
  });

  it('un état remplacé d’un bloc (import) ne sonne pas', () => {
    const a = withMonth();
    const b = editMonth(a, (m) => setTransferPaid(m, 'B', true));
    const imported = { ...b, chores: { ...b.chores }, groceries: { ...b.groceries } };
    expect(cues(a, imported)).toEqual([]);
  });
});

describe('sons V4 : solde recalé', () => {
  it('une correction ajoutée → cloche ; retirée → rien', () => {
    const a = withMonth();
    const budget = recordBalanceCorrection(a.budget, KEY, 120_000, { id: 'c1', recordedAt: '2026-10-05T10:00:00.000Z' });
    const b = { ...a, budget };
    expect(cues(a, b)).toEqual(['balanceBell']);
    expect(cues(b, a)).toEqual([]);
  });

  it('pas de cloche quand les mois changent en même temps (effacer l’historique)', () => {
    const a = withMonth();
    const budget = recordBalanceCorrection(a.budget, KEY, 120_000, { id: 'c1', recordedAt: '2026-10-05T10:00:00.000Z' });
    const b = { ...a, budget: { ...budget, months: [...budget.months] } };
    expect(cues(a, b)).toEqual([]);
  });
});

describe('sons V4 : lanternes', () => {
  const second = LANTERNS[1]!.unlockAt;

  it('le seuil d’une nouvelle lanterne franchi → carillon, une seule fois', () => {
    const before = addSessions(withMonth(), second - 1);
    const after = addSessions(before, 1, second - 1);
    expect(cues(before, after)).toEqual(['lanternNew']);
    expect(cues(after, addSessions(after, 1, second))).toEqual([]);
  });

  it('allumée : une nouvelle session en cours, pas une reprise après pause', () => {
    expect(lanternLitNow(null, { phase: 'running', sessionId: 's1' })).toBe(false);
    expect(lanternLitNow({ phase: 'idle', sessionId: null }, { phase: 'running', sessionId: 's1' })).toBe(true);
    expect(lanternLitNow({ phase: 'paused', sessionId: 's1' }, { phase: 'running', sessionId: 's1' })).toBe(false);
    expect(lanternLitNow({ phase: 'running', sessionId: 's1' }, { phase: 'running', sessionId: 's1' })).toBe(false);
    expect(lanternLitNow({ phase: 'done', sessionId: 's1' }, { phase: 'running', sessionId: 's2' })).toBe(true);
    expect(lanternLitNow({ phase: 'running', sessionId: 's1' }, { phase: 'done', sessionId: 's1' })).toBe(false);
  });
});
