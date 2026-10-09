import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from './appState.js';
import { toggleTaskToday, undoCompletion } from './choreActions.js';
import { groceriesLeft, groceryTaskOf, lastGroceryRun } from './groceryTask.js';
import { anytimeDueDate, dueDay, isAnytimeDueDate } from './occurrences.js';
import { actionableTasksToday, isActionableToday } from './tasks.js';
import { upcomingOccurrences } from './upcoming.js';
import { taskOccurrencesBetween } from './taskCalendar.js';
import { createTask, updateTask } from './taskEdit.js';
import type { GroceryItem, HouseholdTask } from './types.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // jeudi 15 octobre 2026

function courses(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  return { id: 'c', title: 'Courses', assignee: 'both', recurrence: 'weekly', weeklyDay: 4, createdAt: '2026-10-01', groceries: true, ...overrides };
}

describe('tâche courses : champ groceries', () => {
  it('createTask le pose seulement à true', () => {
    const base = { id: 'x', title: 'Courses', assignee: 'both' as const, recurrence: 'none' as const };
    expect(createTask({ ...base, groceries: true }, '2026-10-15').groceries).toBe(true);
    expect('groceries' in createTask({ ...base, groceries: false }, '2026-10-15')).toBe(false);
  });

  it('updateTask le conserve, et le retire sur demande', () => {
    const tasks = [courses()];
    const renamed = updateTask(tasks, 'c', { title: 'Le marché' });
    expect(renamed[0]!.groceries).toBe(true);
    expect(updateTask(tasks, 'c', { groceries: true })).toBe(tasks);
    const unlinked = updateTask(tasks, 'c', { groceries: false });
    expect(unlinked[0]!.groceries).toBeUndefined();
  });

  it('validateAppState : accepté, rétrocompatible, rejeté si non booléen', () => {
    const state = emptyAppState();
    const ok = validateAppState({ ...state, chores: { ...state.chores, tasks: [courses()] } });
    expect(ok.ok && ok.state.chores.tasks[0]!.groceries).toBe(true);
    const old = validateAppState({ ...state, chores: { ...state.chores, tasks: [courses({ groceries: undefined })] } });
    expect(old.ok && old.state.chores.tasks[0]!.groceries).toBeUndefined();
    const bad = validateAppState({ ...state, chores: { ...state.chores, tasks: [{ ...courses(), groceries: 'oui' }] } });
    expect(bad.ok).toBe(false);
  });
});

describe('groceryTaskOf / groceriesLeft', () => {
  it('trouve la tâche liée', () => {
    expect(groceryTaskOf([courses({ id: 'a', groceries: undefined }), courses({ id: 'b' })])?.id).toBe('b');
    expect(groceryTaskOf([])).toBeUndefined();
  });
  it('compte les articles hors panier', () => {
    const items: GroceryItem[] = [
      { id: '1', label: 'Pain', done: false },
      { id: '2', label: 'Lait', done: true },
      { id: '3', label: 'Riz', done: false },
    ];
    expect(groceriesLeft(items)).toBe(2);
  });
});

describe('V5.3 — tâche Courses permanente', () => {
  const LATER = new Date(2026, 9, 15, 18, 30, 0);
  const withTask = (task: HouseholdTask = courses()) => {
    const base = emptyAppState();
    return { ...base, chores: { ...base.chores, tasks: [task] } };
  };

  it('toujours actionnable, même un autre jour que son ancien jour fixe', () => {
    const t = courses({ weeklyDay: 6 });
    expect(isActionableToday(t, NOW, [])).toBe(true);
    expect(actionableTasksToday([t], NOW, [], [])).toHaveLength(1);
  });

  it('deux courses le même jour : deux faits distincts, deux crédits, la ligne reste', () => {
    const r1 = toggleTaskToday(withTask(), 'c', NOW, 'run-1', { doneBy: 'a' });
    const r2 = toggleTaskToday(r1.state, 'c', LATER, 'run-2', { doneBy: 'b' });
    expect(r1.completed && r2.completed).toBe(true);
    const done = r2.state.chores.completions;
    expect(done.map((c) => c.id)).toEqual(['run-1', 'run-2']);
    expect(done[0]!.dueDate).toBe('2026-10-15~run-1');
    expect(done[1]!.dueDate).toBe('2026-10-15~run-2');
    expect(new Set(done.map((c) => c.dueDate)).size).toBe(2);
    expect(r2.state.forest.lifetimeCare).toBe(2);
    expect(isActionableToday(r2.state.chores.tasks[0]!, LATER, done)).toBe(true);
    expect(lastGroceryRun(r2.state.chores.tasks[0]!, done)).toMatchObject({ completionId: 'run-2', who: 'b' });
    expect(validateAppState(r2.state).ok).toBe(true);
  });

  it('annuler la seconde laisse la première (fait et crédit)', () => {
    const r1 = toggleTaskToday(withTask(), 'c', NOW, 'run-1', { doneBy: 'a' });
    const r2 = toggleTaskToday(r1.state, 'c', LATER, 'run-2', { doneBy: 'b' });
    const u = undoCompletion(r2.state, 'run-2', LATER);
    expect(u.completionId).toBe('run-2');
    expect(u.state.chores.completions.map((c) => c.id)).toEqual(['run-1']);
    expect(u.state.forest.creditLedger['c|2026-10-15~run-1']?.status).toBe('active');
    expect(u.state.forest.creditLedger['c|2026-10-15~run-2']?.status).toBe('tombstoned');
    expect(undoCompletion(u.state, 'run-2', LATER).state).toBe(u.state);
    expect(validateAppState(u.state).ok).toBe(true);
  });

  it('jamais au Calendrier ni dans « À venir »', () => {
    const t = courses();
    expect(taskOccurrencesBetween([t], [], [], '2026-10-01', '2026-10-31')).toEqual([]);
    expect(upcomingOccurrences([t], [], NOW, 30)).toEqual([]);
  });

  it('« pas aujourd’hui » ne la cache pas', () => {
    const t = courses();
    expect(isActionableToday(t, NOW, [], [{ id: 's', taskId: 'c', dueDate: '2026-10-15', at: NOW.toISOString() }])).toBe(true);
  });

  it('migration douce : tâche V5.2 (hebdo souple, déjà faite cette semaine) → encore à faire', () => {
    const v52 = courses({ weeklyDay: 1, flexible: true });
    const old = [{ id: 'k', taskId: 'c', dueDate: '2026-10-12', taskTitle: 'Courses', completedAt: '2026-10-13T09:00:00.000Z', assignee: 'both' as const }];
    const state = { ...withTask(v52), chores: { tasks: [v52], completions: old } };
    expect(validateAppState(state).ok).toBe(true);
    expect(isActionableToday(v52, NOW, old)).toBe(true);
    expect(lastGroceryRun(v52, old)?.completionId).toBe('k');
    const r = toggleTaskToday(state, 'c', NOW, 'run-1');
    expect(r.completed).toBe(true);
    expect(r.state.chores.completions).toHaveLength(2);
    expect(r.state.chores.completions[0]).toEqual(old[0]);
  });

  it('dueDate : forme sûre, jour lisible, validation stricte', () => {
    expect(anytimeDueDate('2026-10-15', 'a|b c')).toBe('2026-10-15~abc');
    expect(isAnytimeDueDate('2026-10-15~abc')).toBe(true);
    expect(dueDay('2026-10-15~abc')).toBe('2026-10-15');
    expect(dueDay('2026-10-15')).toBe('2026-10-15');
    const base = emptyAppState();
    const bad = { ...base, chores: { ...base.chores, tasks: [courses()], completions: [{ id: 'z', taskId: 'c', dueDate: '2026-13-40~z', taskTitle: 'Courses', completedAt: NOW.toISOString(), assignee: 'both' }] } };
    expect(validateAppState(bad).ok).toBe(false);
  });
});
