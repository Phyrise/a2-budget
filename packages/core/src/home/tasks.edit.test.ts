import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from './appState.js';
import {
  addCompletion,
  createTask,
  deleteTask,
  upcomingOccurrences,
  updateTask,
  weeklyDistribution,
} from './tasks.js';
import type { ChoreCompletion, HouseholdTask } from './types.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // jeudi 15 octobre 2026

function task(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  return {
    id: 't1',
    title: 'Aspirateur',
    assignee: 'a',
    recurrence: 'weekly',
    weeklyDay: 1,
    createdAt: '2026-10-01',
    ...overrides,
  };
}

describe('createTask (durcissement)', () => {
  it('retire les espaces de bord du titre', () => {
    expect(createTask({ id: 't', title: '  Linge  ', assignee: 'b', recurrence: 'daily' }, '2026-10-01').title)
      .toBe('Linge');
  });

  it('rejette un jour non entier, un assignee ou une récurrence inconnus', () => {
    expect(() => createTask({ id: 't', title: 'X', assignee: 'a', recurrence: 'weekly', weeklyDay: 2.5 }, '2026-10-01'))
      .toThrow(RangeError);
    expect(() => createTask({ id: 't', title: 'X', assignee: 'a', recurrence: 'monthly', monthlyDay: 0 }, '2026-10-01'))
      .toThrow(RangeError);
    expect(() => createTask({ id: 't', title: 'X', assignee: 'c' as never, recurrence: 'daily' }, '2026-10-01'))
      .toThrow(RangeError);
    expect(() => createTask({ id: 't', title: 'X', assignee: 'a', recurrence: 'yearly' as never }, '2026-10-01'))
      .toThrow(RangeError);
  });

  it('ignore un jour sans objet pour la récurrence', () => {
    const t = createTask({ id: 't', title: 'X', assignee: 'a', recurrence: 'daily', weeklyDay: 3, monthlyDay: 4 }, '2026-10-01');
    expect(t.weeklyDay).toBeUndefined();
    expect(t.monthlyDay).toBeUndefined();
  });
});

describe('updateTask', () => {
  it('modifie titre et assignee sans toucher id ni createdAt (pur)', () => {
    const tasks = [task(), task({ id: 't2', title: 'Poubelles' })];
    const before = structuredClone(tasks);
    const next = updateTask(tasks, 't1', { title: '  Aspirateur salon ', assignee: 'both' });
    expect(next[0]).toMatchObject({ id: 't1', title: 'Aspirateur salon', assignee: 'both', createdAt: '2026-10-01' });
    expect(next[1]).toBe(tasks[1]);
    expect(tasks).toEqual(before);
  });

  it('change de récurrence : retire les jours sans objet', () => {
    const tasks = [task()];
    const monthly = updateTask(tasks, 't1', { recurrence: 'monthly', monthlyDay: 31 });
    expect(monthly[0]).toMatchObject({ recurrence: 'monthly', monthlyDay: 31, weeklyDay: undefined });
    const daily = updateTask(monthly, 't1', { recurrence: 'daily' });
    expect(daily[0]).toMatchObject({ recurrence: 'daily', weeklyDay: undefined, monthlyDay: undefined });
    const once = updateTask(daily, 't1', { recurrence: 'none' });
    expect(once[0]!.recurrence).toBe('none');
  });

  it('garde le jour existant si le patch ne le précise pas', () => {
    const next = updateTask([task({ weeklyDay: 5 })], 't1', { title: 'Sol' });
    expect(next[0]!.weeklyDay).toBe(5);
    const moved = updateTask([task({ weeklyDay: 5 })], 't1', { weeklyDay: 2 });
    expect(moved[0]!.weeklyDay).toBe(2);
  });

  it('incohérent → RangeError, rien n’est modifié', () => {
    const tasks = [task({ recurrence: 'daily', weeklyDay: undefined })];
    expect(() => updateTask(tasks, 't1', { recurrence: 'weekly' })).toThrow(RangeError);
    expect(() => updateTask(tasks, 't1', { recurrence: 'monthly', monthlyDay: 32 })).toThrow(RangeError);
    expect(() => updateTask(tasks, 't1', { title: '   ' })).toThrow(RangeError);
    expect(() => updateTask(tasks, 't1', { assignee: 'x' as never })).toThrow(RangeError);
    expect(() => updateTask([task()], 't1', { weeklyDay: 8 })).toThrow(RangeError);
    expect(tasks[0]!.recurrence).toBe('daily');
  });

  it('id inconnu ou patch sans effet → même référence', () => {
    const tasks = [task()];
    expect(updateTask(tasks, 'nope', { title: 'Y' })).toBe(tasks);
    expect(updateTask(tasks, 't1', { title: 'Aspirateur', weeklyDay: 1 })).toBe(tasks);
    expect(updateTask(tasks, 't1', {})).toBe(tasks);
  });

  it('les faits Maison passés gardent leur titre d’origine', () => {
    const tasks = [task({ recurrence: 'daily', weeklyDay: undefined })];
    const { completions } = addCompletion([], tasks[0]!, '2026-10-14', NOW, 'c1');
    const renamed = updateTask(tasks, 't1', { title: 'Nouveau', assignee: 'b' });
    expect(renamed[0]!.title).toBe('Nouveau');
    expect(completions[0]).toMatchObject({ taskTitle: 'Aspirateur', assignee: 'a' });
  });

  it('une tâche modifiée reste un état V2 valide', () => {
    const state = emptyAppState();
    state.chores.tasks = updateTask([task()], 't1', { recurrence: 'monthly', monthlyDay: 12 });
    expect(validateAppState(JSON.parse(JSON.stringify(state))).ok).toBe(true);
  });
});

describe('deleteTask', () => {
  it('retire le modèle, garde les faits Maison et leur répartition', () => {
    const tasks = [task({ recurrence: 'daily', weeklyDay: undefined }), task({ id: 't2' })];
    const { completions } = addCompletion([], tasks[0]!, '2026-10-15', NOW, 'c1');
    const next = deleteTask(tasks, 't1');
    expect(next.map((t) => t.id)).toEqual(['t2']);
    expect(tasks).toHaveLength(2); // pur
    expect(weeklyDistribution(completions, NOW).a).toBe(1);
  });

  it('id inconnu → même référence', () => {
    const tasks = [task()];
    expect(deleteTask(tasks, 'nope')).toBe(tasks);
  });

  it('un fait orphelin (tâche supprimée) reste un état V2 valide', () => {
    const state = emptyAppState();
    const t = task({ recurrence: 'daily', weeklyDay: undefined });
    state.chores.completions = addCompletion([], t, '2026-10-15', NOW, 'c1').completions;
    state.chores.tasks = deleteTask([t], 't1');
    expect(validateAppState(JSON.parse(JSON.stringify(state))).ok).toBe(true);
  });
});

describe('upcomingOccurrences (« À venir »)', () => {
  const tasks: HouseholdTask[] = [
    task({ id: 'mon', title: 'Lundi', weeklyDay: 1 }), // lundi 19
    task({ id: 'thu', title: 'Jeudi', weeklyDay: 4 }), // aujourd'hui → jeudi 22 seulement
    task({ id: 'm20', title: 'Le 20', recurrence: 'monthly', weeklyDay: undefined, monthlyDay: 20 }),
    task({ id: 'm31', title: 'Le 31', recurrence: 'monthly', weeklyDay: undefined, monthlyDay: 31 }),
    task({ id: 'day', title: 'Chaque jour', recurrence: 'daily', weeklyDay: undefined }),
    task({ id: 'once', title: 'Une fois', recurrence: 'none', weeklyDay: undefined, createdAt: '2026-10-16' }),
  ];

  it('liste les occurrences de demain à J+7, triées par date puis ordre des tâches', () => {
    const up = upcomingOccurrences(tasks, [], NOW, 7, { includeDaily: false });
    expect(up.map((o) => `${o.date}:${o.task.id}:${o.daysFromNow}`)).toEqual([
      '2026-10-19:mon:4',
      '2026-10-20:m20:5',
      '2026-10-22:thu:7',
    ]);
  });

  it('inclut les quotidiennes par défaut, exclut toujours les ponctuelles', () => {
    const up = upcomingOccurrences(tasks, [], NOW, 2);
    expect(up.map((o) => `${o.date}:${o.task.id}`)).toEqual(['2026-10-16:day', '2026-10-17:day']);
  });

  it('omet une occurrence déjà terminée (faite en avance)', () => {
    const completions: ChoreCompletion[] = [
      { id: 'c', taskId: 'mon', taskTitle: 'Lundi', assignee: 'a', dueDate: '2026-10-19', completedAt: NOW.toISOString() },
    ];
    const up = upcomingOccurrences(tasks, completions, NOW, 7, { includeDaily: false });
    expect(up.map((o) => o.task.id)).toEqual(['m20', 'thu']);
  });

  it('mois courts : le 31 tombe le 30 novembre', () => {
    const up = upcomingOccurrences([tasks[3]!], [], new Date(2026, 10, 25, 9), 7);
    expect(up.map((o) => o.date)).toEqual(['2026-11-30']);
  });

  it('borne days (0 → rien, négatif → rien)', () => {
    expect(upcomingOccurrences(tasks, [], NOW, 0)).toEqual([]);
    expect(upcomingOccurrences(tasks, [], NOW, -3)).toEqual([]);
  });
});
