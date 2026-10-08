import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from './appState.js';
import { toggleTaskToday } from './choreActions.js';
import { groceriesLeft, groceryTaskOf, groceryTaskStatus } from './groceryTask.js';
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

describe('groceryTaskStatus', () => {
  it('due aujourd’hui → open ; faite → prochaine dans 7 jours', () => {
    const t = courses();
    expect(groceryTaskStatus(t, [], [], NOW)).toEqual({ kind: 'open' });
    const done = [{ id: 'k', taskId: 'c', dueDate: '2026-10-15', taskTitle: 'Courses', completedAt: NOW.toISOString(), assignee: 'both' as const }];
    expect(groceryTaskStatus(t, done, [], NOW)).toEqual({ kind: 'next', date: '2026-10-22', daysFromNow: 7 });
  });
  it('souple : ouverte toute la semaine', () => {
    expect(groceryTaskStatus(courses({ weeklyDay: 1, flexible: true }), [], [], NOW)).toEqual({ kind: 'open' });
  });
  it('un autre jour → prochaine échéance', () => {
    expect(groceryTaskStatus(courses({ weeklyDay: 6 }), [], [], NOW)).toEqual({ kind: 'next', date: '2026-10-17', daysFromNow: 2 });
  });
  it('ponctuelle faite → none', () => {
    const t = courses({ recurrence: 'none', weeklyDay: undefined });
    const done = [{ id: 'k', taskId: 'c', dueDate: 'once', taskTitle: 'Courses', completedAt: NOW.toISOString(), assignee: 'both' as const }];
    expect(groceryTaskStatus(t, done, [], NOW)).toEqual({ kind: 'none' });
  });
});

describe('complétée comme dans Maison', () => {
  it('toggleTaskToday avec « qui » → fait, forêt créditée, calendrier barré', () => {
    const base = emptyAppState();
    const state = { ...base, chores: { ...base.chores, tasks: [courses()] } };
    const r = toggleTaskToday(state, 'c', NOW, 'done-1', { doneBy: 'b' });
    expect(r.completed).toBe(true);
    expect(r.state.chores.completions[0]).toMatchObject({ taskId: 'c', doneBy: 'b' });
    expect(r.state.forest).not.toEqual(state.forest);
    const cal = taskOccurrencesBetween(r.state.chores.tasks, r.state.chores.completions, [], '2026-10-15', '2026-10-15');
    expect(cal).toHaveLength(1);
    expect(cal[0]!.done).toBe(true);
    expect(groceryTaskStatus(r.state.chores.tasks[0]!, r.state.chores.completions, [], NOW).kind).toBe('next');
  });
});
