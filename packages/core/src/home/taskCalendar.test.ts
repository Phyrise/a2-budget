import { describe, expect, it } from 'vitest';
import { taskOccurrencesBetween, TASK_CALENDAR_MAX_DAYS } from './taskCalendar.js';
import { createTask } from './tasks.js';
import type { ChoreCompletion, ChoreSkip, HouseholdTask } from './types.js';

// Octobre 2026 : le 1er est un jeudi.
const tasks: HouseholdTask[] = [
  createTask({ id: 'poubelles', title: 'Poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: 1 }, '2026-10-01'),
  createTask({ id: 'loyer', title: 'Relever les compteurs', assignee: 'b', recurrence: 'monthly', monthlyDay: 31 }, '2026-09-01'),
  createTask({ id: 'vaisselle', title: 'Vaisselle', assignee: 'both', recurrence: 'daily' }, '2026-09-01'),
  createTask({ id: 'lessive', title: 'Lessive', assignee: 'a', recurrence: 'weekly', weeklyDay: 6, flexible: true }, '2026-09-01'),
  createTask({ id: 'rdv', title: 'Appeler le plombier', assignee: 'b', recurrence: 'none' }, '2026-10-14'),
];

function done(taskId: string, dueDate: string, id = `${taskId}-${dueDate}`): ChoreCompletion {
  return { id, taskId, taskTitle: taskId, assignee: 'a', dueDate, completedAt: '2026-10-05T08:00:00.000Z' };
}

describe('taskOccurrencesBetween', () => {
  it('hebdomadaires à jour fixe, mensuelles et ponctuelles ; jamais quotidiennes ni souples', () => {
    const out = taskOccurrencesBetween(tasks, [], undefined, '2026-10-01', '2026-10-31');
    expect(out.map((o) => `${o.date} ${o.task.id}`)).toEqual([
      '2026-10-05 poubelles',
      '2026-10-12 poubelles',
      '2026-10-14 rdv',
      '2026-10-19 poubelles',
      '2026-10-26 poubelles',
      '2026-10-31 loyer',
    ]);
    expect(out.every((o) => !o.done && !o.skipped)).toBe(true);
  });

  it('mensuelle ajustée au dernier jour des mois courts', () => {
    const out = taskOccurrencesBetween(tasks, [], undefined, '2026-11-01', '2026-11-30');
    expect(out.filter((o) => o.task.id === 'loyer').map((o) => o.date)).toEqual(['2026-11-30']);
  });

  it('pas d’occurrence inventée avant la création de la tâche', () => {
    const out = taskOccurrencesBetween(tasks, [], undefined, '2026-09-01', '2026-09-30');
    expect(out.map((o) => `${o.date} ${o.task.id}`)).toEqual(['2026-09-30 loyer']);
  });

  it('faite → done (barrée), synchronisée avec Maison ; ponctuelle identifiée « once »', () => {
    const completions = [done('poubelles', '2026-10-12'), done('rdv', 'once')];
    const out = taskOccurrencesBetween(tasks, completions, undefined, '2026-10-12', '2026-10-14');
    expect(out).toEqual([
      expect.objectContaining({ date: '2026-10-12', dueDate: '2026-10-12', done: true, skipped: false }),
      expect.objectContaining({ date: '2026-10-14', dueDate: 'once', done: true, skipped: false }),
    ]);
  });

  it('hebdomadaire repassée en jour fixe : le fait de la semaine (lundi) compte', () => {
    const t = [createTask({ id: 'w', title: 'Draps', assignee: 'a', recurrence: 'weekly', weeklyDay: 4 }, '2026-10-01')];
    const out = taskOccurrencesBetween(t, [done('w', '2026-10-12')], undefined, '2026-10-15', '2026-10-15');
    expect(out[0]!.done).toBe(true);
  });

  it('« pas aujourd’hui » → skipped', () => {
    const skips: ChoreSkip[] = [
      { id: 's1', taskId: 'poubelles', dueDate: '2026-10-19', at: '2026-10-19T08:00:00.000Z' },
      { id: 's2', taskId: 'rdv', dueDate: '2026-10-14', at: '2026-10-14T08:00:00.000Z' },
    ];
    const out = taskOccurrencesBetween(tasks, [], skips, '2026-10-14', '2026-10-19');
    expect(out.map((o) => [o.task.id, o.skipped])).toEqual([['rdv', true], ['poubelles', true]]);
  });

  it('tri stable : même date → ordre de la liste des tâches', () => {
    const t = [
      createTask({ id: 'z', title: 'Z', assignee: 'a', recurrence: 'monthly', monthlyDay: 5 }, '2026-10-01'),
      createTask({ id: 'a', title: 'A', assignee: 'a', recurrence: 'weekly', weeklyDay: 1 }, '2026-10-01'),
    ];
    const out = taskOccurrencesBetween(t, [], undefined, '2026-10-05', '2026-10-05');
    expect(out.map((o) => o.task.id)).toEqual(['z', 'a']);
  });

  it('intervalle invalide ou inversé → [] ; fenêtre bornée', () => {
    expect(taskOccurrencesBetween(tasks, [], undefined, '2026-10-31', '2026-10-01')).toEqual([]);
    expect(taskOccurrencesBetween(tasks, [], undefined, '2026-10-32', '2026-11-01')).toEqual([]);
    expect(taskOccurrencesBetween([], [], undefined, '2026-10-01', '2026-10-31')).toEqual([]);
    const far = taskOccurrencesBetween(tasks, [], undefined, '2026-10-01', '2030-01-01');
    const last = far.at(-1)!.date;
    expect(last < '2027-11-06').toBe(true);
    expect(TASK_CALENDAR_MAX_DAYS).toBe(400);
  });

  it('traverse le changement d’heure sans sauter de jour', () => {
    const t = [createTask({ id: 'd', title: 'D', assignee: 'a', recurrence: 'weekly', weeklyDay: 7 }, '2026-10-01')];
    const out = taskOccurrencesBetween(t, [], undefined, '2026-10-24', '2026-11-02');
    expect(out.map((o) => o.date)).toEqual(['2026-10-25', '2026-11-01']);
  });
});
