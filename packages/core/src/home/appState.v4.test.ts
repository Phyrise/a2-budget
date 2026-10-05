import { describe, expect, it } from 'vitest';
import { emptyAppState, migrateState, validateAppState } from './appState.js';
import { addFocusSession } from './focus.js';
import { addGroceryItem } from './groceries.js';
import { rememberGroceryCategory } from './groceryMemory.js';
import { selectLantern } from './lanterns.js';
import { recordBalanceCorrection, openingBalance } from '../accountBalance.js';
import { setExpensePaid, setTransferPaid } from '../payments.js';
import { createMonthRecord, ensureMonth } from '../state.js';
import type { AppState } from './types.js';

const NOW = new Date(2026, 9, 5, 18, 0, 0);
const roundTrip = (s: unknown) => validateAppState(JSON.parse(JSON.stringify(s)));

/** État V4 complet, construit via l'API du domaine. */
function v4State(): AppState {
  const s = emptyAppState();
  const budget0 = ensureMonth({ schemaVersion: 1, ...s.budget }, '2026-09');
  const sep = budget0.months[0]!;
  const oct = setExpensePaid(setTransferPaid(createMonthRecord('2026-10', budget0.settings), 'A', true), 'rent', true);
  let budget: AppState['budget'] = { settings: budget0.settings, months: [sep, oct], selectedMonth: '2026-10' };
  budget = recordBalanceCorrection(budget, '2026-09', -4_200, { id: 'b1', recordedAt: NOW.toISOString(), note: 'Relevé' });
  let focus = s.focus;
  for (let i = 0; i < 3; i++) {
    focus = addFocusSession(focus, { id: `f${i}`, startedAt: NOW.toISOString(), minutes: 10, who: 'both' }).focus;
  }
  focus = selectLantern(focus, 'yukimi').focus;
  const memory = rememberGroceryCategory(undefined, 'tomates', 'epicerie')!;
  const items = addGroceryItem([], 'tomates', { id: 'g1', now: NOW, memory }).items;
  return { ...s, budget, focus, groceries: { items, categoryMemory: memory } };
}

describe('validateAppState — champs V4', () => {
  it('un état V4 complet se recharge à l’identique', () => {
    const s = v4State();
    const r = roundTrip(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.state)).toBe(JSON.stringify(s));
    expect(openingBalance(r.state.budget, '2026-10')).toBe(-4_200 + 23_500);
    expect(r.state.groceries.items[0]!.category).toBe('epicerie');
  });

  it('un état sans champs V4 se recharge sans rien inventer', () => {
    const s = emptyAppState();
    const r = roundTrip(s);
    expect(r.ok && JSON.stringify(r.state)).toBe(JSON.stringify(s));
    if (!r.ok) return;
    expect('balance' in r.state.budget).toBe(false);
    expect('categoryMemory' in r.state.groceries).toBe(false);
  });

  it('migrateState (V2) conserve les champs V4', () => {
    const s = v4State();
    const r = migrateState(JSON.parse(JSON.stringify(s)));
    expect(r.ok && JSON.stringify(r.state)).toBe(JSON.stringify(s));
  });

  it('solde invalide → raison préfixée « budget- »', () => {
    const s = v4State();
    const bad = { ...s, budget: { ...s.budget, balance: { corrections: [{ id: 'x' }] } } };
    expect(roundTrip(bad)).toEqual({ ok: false, reason: 'budget-balance-invalid-month' });
    const nul = roundTrip({ ...s, budget: { ...s.budget, balance: null } });
    expect(nul.ok && 'balance' in nul.state.budget).toBe(false);
  });

  it('paiements invalides → raison du budget', () => {
    const s = v4State();
    const months = s.budget.months.map((m) => ({ ...m, paid: { transferA: 'oui' } }));
    expect(roundTrip({ ...s, budget: { ...s.budget, months } })).toEqual({ ok: false, reason: 'budget-month-invalid-paid' });
  });

  it('mémoire des rayons invalide → raison stable', () => {
    const s = v4State();
    const bad = { ...s, groceries: { ...s.groceries, categoryMemory: { tomate: 'rayon-x' } } };
    expect(roundTrip(bad)).toEqual({ ok: false, reason: 'grocery-memory-invalid-category' });
  });

  it('lanterne choisie verrouillée → ignorée, le reste est chargé', () => {
    const s = v4State();
    const r = roundTrip({ ...s, focus: { ...s.focus!, selectedLantern: 'spirit-light' } });
    expect(r.ok).toBe(true);
    expect(r.ok && 'selectedLantern' in r.state.focus!).toBe(false);
  });
});
