import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from './appState.js';
import { toggleTaskToday } from './choreActions.js';
import { pauseForest } from './forest.js';
import { createTask } from './tasks.js';
import type { AppState } from './types.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // jeudi 15 octobre 2026
const LATER = new Date(2026, 9, 15, 11, 0, 0);

function stateWith(...tasks: Parameters<typeof createTask>[0][]): AppState {
  const state = emptyAppState();
  state.chores.tasks = tasks.map((t) => createTask(t, '2026-10-01'));
  return state;
}

const daily = { id: 'daily', title: 'Vaisselle', assignee: 'a', recurrence: 'daily' } as const;
const monday = { id: 'mon', title: 'Poubelles', assignee: 'b', recurrence: 'weekly', weeklyDay: 1 } as const;
const once = { id: 'once', title: 'Rideaux', assignee: 'both', recurrence: 'none' } as const;

describe('toggleTaskToday', () => {
  it('cocher : fait Maison avec l’id fourni, crédit accordé, état V2 valide', () => {
    const state = stateWith(daily);
    const before = structuredClone(state);
    const r = toggleTaskToday(state, 'daily', NOW, 'c1');
    expect(r.completed).toBe(true);
    expect(r.completionId).toBe('c1');
    expect(r.state.chores.completions).toEqual([
      { id: 'c1', taskId: 'daily', taskTitle: 'Vaisselle', assignee: 'a', dueDate: '2026-10-15', completedAt: NOW.toISOString() },
    ]);
    expect(r.state.forest.lifetimeCare).toBe(1);
    expect(r.state.forest.creditLedger['daily|2026-10-15']?.status).toBe('active');
    expect(r.state.budget).toBe(state.budget); // autres modules intacts
    expect(state).toEqual(before); // pur
    expect(validateAppState(JSON.parse(JSON.stringify(r.state))).ok).toBe(true);
  });

  it('décocher : retire le fait (id renvoyé), crédit en tombstone, croissance conservée', () => {
    const first = toggleTaskToday(stateWith(daily), 'daily', NOW, 'c1');
    const undo = toggleTaskToday(first.state, 'daily', LATER, 'c2');
    expect(undo.completed).toBe(false);
    expect(undo.completionId).toBe('c1');
    expect(undo.state.chores.completions).toEqual([]);
    expect(undo.state.forest.creditLedger['daily|2026-10-15']?.status).toBe('tombstoned');
    expect(undo.state.forest.lifetimeCare).toBe(1);
    expect(validateAppState(JSON.parse(JSON.stringify(undo.state))).ok).toBe(true);
  });

  it('recocher : fait restauré avec un nouvel id, aucun crédit redonné', () => {
    const first = toggleTaskToday(stateWith(daily), 'daily', NOW, 'c1');
    const undo = toggleTaskToday(first.state, 'daily', LATER, 'c2');
    const redo = toggleTaskToday(undo.state, 'daily', LATER, 'c3');
    expect(redo).toMatchObject({ completed: true, completionId: 'c3' });
    expect(redo.state.chores.completions.map((c) => c.id)).toEqual(['c3']);
    expect(redo.state.forest.lifetimeCare).toBe(1);
    expect(redo.state.forest.creditLedger['daily|2026-10-15']?.status).toBe('tombstoned');
  });

  it('tâche inconnue ou non due aujourd’hui → même référence, completionId null', () => {
    const state = stateWith(monday);
    expect(toggleTaskToday(state, 'mon', NOW, 'c1')).toEqual({ state, completed: false, completionId: null });
    expect(toggleTaskToday(state, 'nope', NOW, 'c1').state).toBe(state);
  });

  it('ponctuelle : occurrence « once », cochable quel que soit le jour', () => {
    const r = toggleTaskToday(stateWith(once), 'once', NOW, 'c1');
    expect(r.completed).toBe(true);
    expect(r.state.chores.completions[0]!.dueDate).toBe('once');
    expect(r.state.forest.creditLedger['once|once']?.status).toBe('active');
  });

  it('en pause : le fait est enregistré, sans crédit', () => {
    const state = stateWith(daily);
    state.forest = pauseForest(state.forest, '2026-10-14');
    const r = toggleTaskToday(state, 'daily', NOW, 'c1');
    expect(r.completed).toBe(true);
    expect(r.state.chores.completions).toHaveLength(1);
    expect(r.state.forest.lifetimeCare).toBe(0);
    expect(validateAppState(JSON.parse(JSON.stringify(r.state))).ok).toBe(true);
  });

  it('déterministe (StrictMode rejoue les updaters) : mêmes entrées → même résultat', () => {
    const state = stateWith(daily);
    expect(toggleTaskToday(state, 'daily', NOW, 'c1')).toEqual(toggleTaskToday(state, 'daily', NOW, 'c1'));
  });
});
