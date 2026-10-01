import { describe, expect, it } from 'vitest';
import {
  addCompletion,
  actionableTasksToday,
  createTask,
  creditKeyFor,
  hasCompletion,
  isActionableToday,
  isDueOn,
  removeCompletion,
  splitCreditKey,
  weeklyDistribution,
} from './tasks.js';
import type { ChoreCompletion, HouseholdTask } from './types.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // 15 octobre 2026 (jeudi)

function task(overrides: Partial<HouseholdTask> = {}): HouseholdTask {
  return {
    id: 't1',
    title: 'Tâche',
    assignee: 'a',
    recurrence: 'weekly',
    weeklyDay: 1,
    createdAt: '2026-10-01',
    ...overrides,
  };
}

describe('creditKeyFor', () => {
  it('ponctuelle → (taskId, once)', () => {
    expect(creditKeyFor(task({ recurrence: 'none' }), '2026-10-15')).toBe('t1|once');
  });
  it('récurrente → (taskId, scheduledLocalDate)', () => {
    expect(creditKeyFor(task(), '2026-10-15')).toBe('t1|2026-10-15');
  });
});

describe('splitCreditKey', () => {
  it('décompose la clé', () => {
    expect(splitCreditKey('t1|2026-10-15')).toEqual(['t1', '2026-10-15']);
    expect(splitCreditKey('t1|once')).toEqual(['t1', 'once']);
  });
  it('rejette une clé invalide', () => {
    expect(() => splitCreditKey('invalid')).toThrow(RangeError);
  });
});

describe('isDueOn (récurrence sans dérive)', () => {
  it('daily : due chaque jour', () => {
    const t = task({ recurrence: 'daily', weeklyDay: undefined });
    expect(isDueOn(t, new Date(2026, 9, 1))).toBe(true);
    expect(isDueOn(t, new Date(2026, 9, 31))).toBe(true);
  });

  it('weekly : ancrée sur le jour ISO, sans dérive', () => {
    const t = task({ weeklyDay: 1 }); // lundi
    expect(isDueOn(t, new Date(2026, 9, 5))).toBe(true); // lundi 5 oct
    expect(isDueOn(t, new Date(2026, 9, 6))).toBe(false); // mardi
    expect(isDueOn(t, new Date(2026, 9, 12))).toBe(true); // lundi 12 oct
  });

  it('monthly : ancrée sur le jour du mois, sans dérive', () => {
    const t = task({ recurrence: 'monthly', weeklyDay: undefined, monthlyDay: 15 });
    expect(isDueOn(t, new Date(2026, 9, 15))).toBe(true); // 15 oct
    expect(isDueOn(t, new Date(2026, 9, 16))).toBe(false);
    expect(isDueOn(t, new Date(2026, 10, 15))).toBe(true); // 15 nov
  });

  it('monthly : mois courts prédictibles (ajusté au dernier jour)', () => {
    const t = task({ recurrence: 'monthly', weeklyDay: undefined, monthlyDay: 31 });
    // Avril (30 jours) : due le 30.
    expect(isDueOn(t, new Date(2026, 3, 30))).toBe(true);
    expect(isDueOn(t, new Date(2026, 3, 29))).toBe(false);
    // Février 2026 (28 jours) : due le 28.
    expect(isDueOn(t, new Date(2026, 1, 28))).toBe(true);
    expect(isDueOn(t, new Date(2026, 1, 27))).toBe(false);
    // Février 2028 bissextile (29 jours) : due le 29.
    expect(isDueOn(t, new Date(2028, 1, 29))).toBe(true);
    // Mois de 31 jours : due le 31.
    expect(isDueOn(t, new Date(2026, 9, 31))).toBe(true);
  });

  it('none : due uniquement le jour de création', () => {
    const t = task({ recurrence: 'none', weeklyDay: undefined, createdAt: '2026-10-15' });
    expect(isDueOn(t, new Date(2026, 9, 15))).toBe(true);
    expect(isDueOn(t, new Date(2026, 9, 16))).toBe(false);
  });
});

describe('addCompletion (idempotent)', () => {
  it('ajoute un fait Maison la première fois', () => {
    const t = task();
    const { completions, added } = addCompletion([], t, '2026-10-15', NOW, 'c1');
    expect(added).toBe(true);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      taskId: 't1',
      dueDate: '2026-10-15',
      assignee: 'a',
    });
  });

  it('double complétion du même événement = no-op', () => {
    const t = task();
    const first = addCompletion([], t, '2026-10-15', NOW, 'c1');
    const second = addCompletion(first.completions, t, '2026-10-15', NOW, 'c2');
    expect(second.added).toBe(false);
    expect(second.completions).toHaveLength(1);
    expect(second.completions).toBe(first.completions); // même référence (pas de copie)
  });

  it('deux occurrences différentes = deux faits', () => {
    const t = task();
    const a = addCompletion([], t, '2026-10-15', NOW, 'c1');
    const b = addCompletion(a.completions, t, '2026-10-22', NOW, 'c2');
    expect(b.added).toBe(true);
    expect(b.completions).toHaveLength(2);
  });
});

describe('removeCompletion (undo cohérent)', () => {
  it('retire exactement le fait de l’occurrence', () => {
    const t = task();
    const a = addCompletion([], t, '2026-10-15', NOW, 'c1');
    const b = addCompletion(a.completions, t, '2026-10-22', NOW, 'c2');
    const { completions, removed } = removeCompletion(b.completions, 't1', '2026-10-15');
    expect(removed).toBe(true);
    expect(completions).toHaveLength(1);
    expect(completions[0]!.dueDate).toBe('2026-10-22');
  });

  it('idempotent : retirer un fait absent = no-op', () => {
    const { completions, removed } = removeCompletion([], 't1', '2026-10-15');
    expect(removed).toBe(false);
    expect(completions).toHaveLength(0);
  });
});

describe('hasCompletion / isActionableToday', () => {
  it('une occurrence due et non terminée est actionnable', () => {
    const t = task({ weeklyDay: 4 }); // jeudi
    expect(isActionableToday(t, NOW, [])).toBe(true);
  });

  it('une occurrence due et terminée n’est plus actionnable', () => {
    const t = task({ weeklyDay: 4 }); // jeudi
    const { completions } = addCompletion([], t, '2026-10-15', NOW, 'c1');
    expect(isActionableToday(t, NOW, completions)).toBe(false);
  });

  it('une occurrence non due aujourd’hui n’est pas actionnable', () => {
    const t = task({ weeklyDay: 1 }); // lundi
    expect(isActionableToday(t, NOW, [])).toBe(false); // jeudi
  });

  it('une ponctuelle non terminée reste actionnable', () => {
    const t = task({ recurrence: 'none', weeklyDay: undefined, createdAt: '2026-10-01' });
    expect(isActionableToday(t, NOW, [])).toBe(true);
    const { completions } = addCompletion([], t, 'once', NOW, 'c1');
    expect(isActionableToday(t, NOW, completions)).toBe(false);
  });

  it('hasCompletion identifie par (taskId, dueDate)', () => {
    const t = task();
    const { completions } = addCompletion([], t, '2026-10-15', NOW, 'c1');
    expect(hasCompletion(completions, 't1', '2026-10-15')).toBe(true);
    expect(hasCompletion(completions, 't1', '2026-10-22')).toBe(false);
  });
});

describe('weeklyDistribution (factuelle)', () => {
  it('compte tous les faits de la semaine courante par assignee', () => {
    const completions: ChoreCompletion[] = [
      { id: 'c1', taskId: 't1', taskTitle: 'A', assignee: 'a', dueDate: '2026-10-12', completedAt: new Date(2026, 9, 12).toISOString() },
      { id: 'c2', taskId: 't2', taskTitle: 'B', assignee: 'b', dueDate: '2026-10-13', completedAt: new Date(2026, 9, 13).toISOString() },
      { id: 'c3', taskId: 't3', taskTitle: 'C', assignee: 'both', dueDate: '2026-10-14', completedAt: new Date(2026, 9, 14).toISOString() },
      { id: 'c4', taskId: 't4', taskTitle: 'D', assignee: 'a', dueDate: '2026-10-15', completedAt: new Date(2026, 9, 15).toISOString() },
    ];
    // « now » = jeudi 15 oct → semaine du 12 au 18 oct.
    expect(weeklyDistribution(completions, NOW)).toEqual({ a: 2, b: 1, both: 1, unassigned: 0 });
  });

  it('exclut les faits hors de la semaine courante', () => {
    const completions: ChoreCompletion[] = [
      { id: 'c1', taskId: 't1', taskTitle: 'A', assignee: 'a', dueDate: '2026-10-01', completedAt: new Date(2026, 9, 1).toISOString() }, // semaine précédente
      { id: 'c2', taskId: 't2', taskTitle: 'B', assignee: 'b', dueDate: '2026-10-19', completedAt: new Date(2026, 9, 19).toISOString() }, // semaine suivante
    ];
    expect(weeklyDistribution(completions, NOW)).toEqual({ a: 0, b: 0, both: 0, unassigned: 0 });
  });
});

describe('actionableTasksToday', () => {
  it('filtre les tâches actionnables', () => {
    const tasks = [
      task({ id: 't1', weeklyDay: 4 }), // jeudi → actionnable
      task({ id: 't2', weeklyDay: 1 }), // lundi → non due
      task({ id: 't3', recurrence: 'none', weeklyDay: undefined, createdAt: '2026-10-01' }), // ponctuelle → actionnable
    ];
    const actionable = actionableTasksToday(tasks, NOW, []);
    expect(actionable.map((t) => t.id)).toEqual(['t1', 't3']);
  });
});

describe('createTask (validation de cohérence)', () => {
  it('crée une tâche weekly valide', () => {
    const t = createTask({ id: 't1', title: 'Aspirateur', assignee: 'a', recurrence: 'weekly', weeklyDay: 1 }, '2026-10-01');
    expect(t.weeklyDay).toBe(1);
    expect(t.monthlyDay).toBeUndefined();
  });

  it('crée une tâche monthly valide', () => {
    const t = createTask({ id: 't1', title: 'Draps', assignee: 'both', recurrence: 'monthly', monthlyDay: 31 }, '2026-10-01');
    expect(t.monthlyDay).toBe(31);
    expect(t.weeklyDay).toBeUndefined();
  });

  it('rejette un weekly sans jour', () => {
    expect(() => createTask({ id: 't1', title: 'X', assignee: 'a', recurrence: 'weekly' }, '2026-10-01')).toThrow(RangeError);
  });

  it('rejette un monthly hors plage', () => {
    expect(() => createTask({ id: 't1', title: 'X', assignee: 'a', recurrence: 'monthly', monthlyDay: 32 }, '2026-10-01')).toThrow(RangeError);
  });

  it('rejette un titre vide', () => {
    expect(() => createTask({ id: 't1', title: '   ', assignee: 'a', recurrence: 'daily' }, '2026-10-01')).toThrow(RangeError);
  });
});
