/**
 * V5.10 — « Qui l'a fait ? » par toast : la personne prévue d'un geste coché
 * d'un toucher, et la correction de l'auteur d'un fait sans l'annuler (la
 * forêt garde son soin, l'objectif de la semaine ne bouge pas).
 */
import { describe, expect, it } from 'vitest';
import { emptyAppState } from './appState.js';
import { expectedDoer, reassignCompletion, toggleTaskToday, undoCompletion } from './choreActions.js';
import { weeklyCareGoal } from './forestProgress.js';
import { createTask, weeklyDistribution } from './tasks.js';
import type { AppState } from './types.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0);

function stateWith(...tasks: Parameters<typeof createTask>[0][]): AppState {
  const state = emptyAppState();
  state.chores.tasks = tasks.map((t) => createTask(t, '2026-10-01'));
  return state;
}

describe('expectedDoer — la personne prévue', () => {
  it('l’assigné(e), ou « ensemble » pour une tâche à deux', () => {
    expect(expectedDoer('a', 'b')).toBe('a');
    expect(expectedDoer('b', 'a')).toBe('b');
    expect(expectedDoer('both', 'a')).toBe('both');
  });

  it('tâche libre : soi ; A en invité', () => {
    expect(expectedDoer('unassigned', 'b')).toBe('b');
    expect(expectedDoer(undefined, 'a')).toBe('a');
    expect(expectedDoer('unassigned', null)).toBe('a');
  });
});

describe('reassignCompletion — corriger l’auteur sans annuler', () => {
  const daily = { id: 'd', title: 'Vaisselle', assignee: 'a', recurrence: 'daily' } as const;

  it('même fait (id, heure), autre auteur ; la forêt ne bouge pas', () => {
    const done = toggleTaskToday(stateWith(daily), 'd', NOW, 'c1').state;
    const r = reassignCompletion(done, 'c1', 'b');
    expect(r.changed).toBe(true);
    const c = r.state.chores.completions[0]!;
    expect(c).toMatchObject({ id: 'c1', assignee: 'a', doneBy: 'b', completedAt: done.chores.completions[0]!.completedAt });
    expect(r.state.forest).toBe(done.forest);
    expect(weeklyCareGoal(r.state.forest, NOW)).toEqual(weeklyCareGoal(done.forest, NOW));
  });

  it('revenir à l’assigné(e) retire doneBy (forme d’addCompletion)', () => {
    const done = toggleTaskToday(stateWith(daily), 'd', NOW, 'c1', { doneBy: 'both' }).state;
    expect(done.chores.completions[0]!.doneBy).toBe('both');
    const back = reassignCompletion(done, 'c1', 'a').state.chores.completions[0]!;
    expect(back.doneBy).toBeUndefined();
    expect('doneBy' in back).toBe(false);
  });

  it('auteur inchangé ou fait inconnu : même état', () => {
    const done = toggleTaskToday(stateWith(daily), 'd', NOW, 'c1').state;
    expect(reassignCompletion(done, 'c1', 'a')).toEqual({ state: done, changed: false });
    expect(reassignCompletion(done, 'nope', 'b').state).toBe(done);
  });

  it('l’équilibre suit la correction', () => {
    const done = toggleTaskToday(stateWith(daily), 'd', NOW, 'c1').state;
    const fixed = reassignCompletion(done, 'c1', 'b').state;
    expect(weeklyDistribution(done.chores.completions, NOW)).toMatchObject({ a: 1, b: 0 });
    expect(weeklyDistribution(fixed.chores.completions, NOW)).toMatchObject({ a: 0, b: 1 });
  });

  it('contrairement à annuler puis recocher, le soin reste actif', () => {
    const done = toggleTaskToday(stateWith(daily), 'd', NOW, 'c1').state;
    const goal = weeklyCareGoal(done.forest, NOW).creditsThisWeek;
    const fixed = reassignCompletion(done, 'c1', 'b').state;
    expect(weeklyCareGoal(fixed.forest, NOW).creditsThisWeek).toBe(goal);
    const redone = toggleTaskToday(undoCompletion(done, 'c1', NOW).state, 'd', NOW, 'c2', { doneBy: 'b' }).state;
    expect(weeklyCareGoal(redone.forest, NOW).creditsThisWeek).toBe(goal - 1);
  });
});
