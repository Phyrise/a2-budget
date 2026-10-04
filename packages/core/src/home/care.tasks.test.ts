import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from './appState.js';
import { toggleTaskToday } from './choreActions.js';
import { advanceDay } from './forest.js';
import { skipOccurrence, unskipOccurrence, SKIPS_MAX } from './skips.js';
import {
  actionableTasksToday,
  addCompletion,
  createTask,
  creditKeyFor,
  isActionableToday,
  isDueOn,
  nextAssignee,
  occurrenceDateFor,
  skipDateFor,
  updateTask,
  upcomingOccurrences,
  weeklyDistribution,
} from './tasks.js';
import type { AppState, ChoreCompletion, ChoreSkip, HouseholdTask } from './types.js';

// Semaine du lundi 12 au dimanche 18 octobre 2026.
const MON = new Date(2026, 9, 12, 9, 0, 0);
const THU = new Date(2026, 9, 15, 10, 0, 0);
const SAT = new Date(2026, 9, 17, 18, 0, 0);
const NEXT_MON = new Date(2026, 9, 19, 9, 0, 0);

function task(input: Parameters<typeof createTask>[0]): HouseholdTask {
  return createTask(input, '2026-10-01');
}
function stateWith(...tasks: HouseholdTask[]): AppState {
  const s = emptyAppState();
  s.chores.tasks = tasks;
  return s;
}
function valid(state: AppState): boolean {
  return validateAppState(JSON.parse(JSON.stringify(state))).ok;
}

const flex = task({ id: 'flex', title: 'Lessive', assignee: 'a', recurrence: 'weekly', weeklyDay: 6, flexible: true });
const fixed = task({ id: 'fixed', title: 'Poubelles', assignee: 'b', recurrence: 'weekly', weeklyDay: 4 });
const turn = task({ id: 'turn', title: 'Vaisselle', assignee: 'a', recurrence: 'daily', rotation: true, effort: 2 });

describe('création / édition V3', () => {
  it('champs optionnels stockés seulement s’ils sont significatifs', () => {
    expect(turn).toMatchObject({ effort: 2, rotation: true });
    expect('flexible' in turn).toBe(false);
    const plain = task({ id: 'p', title: 'X', assignee: 'a', recurrence: 'daily', rotation: false, flexible: false });
    expect(Object.keys(plain)).not.toContain('rotation');
    expect(Object.keys(plain)).not.toContain('flexible');
    expect(Object.keys(plain)).not.toContain('effort');
  });

  it('incohérences rejetées', () => {
    expect(() => task({ id: 'x', title: 'X', assignee: 'both', recurrence: 'daily', rotation: true })).toThrow(RangeError);
    expect(() => task({ id: 'x', title: 'X', assignee: 'a', recurrence: 'daily', flexible: true })).toThrow(RangeError);
    expect(() => task({ id: 'x', title: 'X', assignee: 'a', recurrence: 'daily', effort: 4 as 1 })).toThrow(RangeError);
  });

  it('updateTask : explicite incohérent → erreur ; hérité sans objet → retiré', () => {
    expect(() => updateTask([turn], 'turn', { assignee: 'both', rotation: true })).toThrow(RangeError);
    const [both] = updateTask([turn], 'turn', { assignee: 'both' });
    expect(both!.rotation).toBeUndefined();
    const [daily] = updateTask([flex], 'flex', { recurrence: 'daily' });
    expect(daily!.flexible).toBeUndefined();
    const [effort] = updateTask([fixed], 'fixed', { effort: 3, rotation: true, flexible: true });
    expect(effort).toMatchObject({ effort: 3, rotation: true, flexible: true });
    const off = updateTask([turn], 'turn', { rotation: false });
    expect(off[0]!.rotation).toBeUndefined();
    const same = [turn];
    expect(updateTask(same, 'turn', { effort: 2 })).toBe(same);
  });
});

describe('hebdomadaire souple', () => {
  it('due chaque jour, occurrence = lundi, clé de crédit normalisée', () => {
    expect(isDueOn(flex, MON) && isDueOn(flex, THU) && isDueOn(flex, SAT)).toBe(true);
    expect(occurrenceDateFor(flex, THU)).toBe('2026-10-12');
    expect(creditKeyFor(flex, '2026-10-15')).toBe('flex|2026-10-12');
    expect(creditKeyFor(fixed, '2026-10-15')).toBe('fixed|2026-10-15');
    expect(skipDateFor(flex, THU)).toBe('2026-10-12');
  });

  it('faite un jour de la semaine → plus actionnable jusqu’au lundi suivant', () => {
    const r = toggleTaskToday(stateWith(flex), 'flex', THU, 'c1');
    expect(r.completed).toBe(true);
    expect(r.state.chores.completions[0]!.dueDate).toBe('2026-10-12');
    expect(r.state.forest.creditLedger['flex|2026-10-12']?.status).toBe('active');
    const cs = r.state.chores.completions;
    expect(isActionableToday(flex, SAT, cs)).toBe(false);
    expect(isActionableToday(flex, NEXT_MON, cs)).toBe(true);
    expect(valid(r.state)).toBe(true);
    // Décocher plus tard dans la semaine retire le même fait.
    const undo = toggleTaskToday(r.state, 'flex', SAT, 'c2');
    expect(undo.completed).toBe(false);
    expect(undo.completionId).toBe('c1');
    expect(undo.state.forest.creditLedger['flex|2026-10-12']?.status).toBe('tombstoned');
  });

  it('un fait daté d’un autre jour de la semaine (ancien jour fixe) compte', () => {
    const legacy: ChoreCompletion = {
      id: 'old', taskId: 'flex', taskTitle: 'Lessive', assignee: 'a', dueDate: '2026-10-14', completedAt: new Date(2026, 9, 14).toISOString(),
    };
    expect(isActionableToday(flex, THU, [legacy])).toBe(false);
  });

  it('les tâches à jour fixe ne changent pas', () => {
    expect(isDueOn(fixed, THU)).toBe(true);
    expect(isDueOn(fixed, SAT)).toBe(false);
  });

  it('« À venir » : une entrée par semaine suivante, datée du lundi', () => {
    const up = upcomingOccurrences([flex, fixed], [], THU, 14);
    const flexDates = up.filter((o) => o.task.id === 'flex').map((o) => o.date);
    expect(flexDates).toEqual(['2026-10-19', '2026-10-26']);
    expect(up.filter((o) => o.task.id === 'fixed').map((o) => o.date)).toEqual(['2026-10-22', '2026-10-29']);
  });
});

describe('tour à tour + doneBy', () => {
  it('nextAssignee alterne selon qui a fait la dernière occurrence', () => {
    expect(nextAssignee(turn, [])).toBe('a');
    let cs = addCompletion([], turn, '2026-10-12', MON, 'c1').completions;
    expect(cs[0]!.assignee).toBe('a');
    expect(nextAssignee(turn, cs)).toBe('b');
    cs = addCompletion(cs, turn, '2026-10-13', new Date(2026, 9, 13), 'c2').completions;
    expect(cs[1]!.assignee).toBe('b');
    expect(nextAssignee(turn, cs)).toBe('a');
    // « Je m'en occupe » : B le fait à la place de A → c'est à A ensuite.
    cs = addCompletion(cs, turn, '2026-10-14', new Date(2026, 9, 14), 'c3', 'b').completions;
    expect(cs[2]).toMatchObject({ assignee: 'a', doneBy: 'b' });
    expect(nextAssignee(turn, cs)).toBe('a');
    // Ensemble : ignoré pour l'alternance.
    cs = addCompletion(cs, turn, '2026-10-15', THU, 'c4', 'both').completions;
    expect(nextAssignee(turn, cs)).toBe('a');
  });

  it('doneBy égal à l’assignee n’est pas stocké ; tâche fixe : nextAssignee = assignee', () => {
    const cs = addCompletion([], fixed, '2026-10-15', THU, 'c1', 'b').completions;
    expect('doneBy' in cs[0]!).toBe(false);
    expect(nextAssignee(fixed, cs)).toBe('b');
  });

  it('toggleTaskToday : doneBy renvoyé, répartition et crédit', () => {
    const s = stateWith(fixed);
    const r = toggleTaskToday(s, 'fixed', THU, 'c1', { doneBy: 'a' });
    expect(r.doneBy).toBe('a');
    expect(weeklyDistribution(r.state.chores.completions, THU)).toEqual({ a: 1, b: 0, both: 0, unassigned: 0 });
    const plain = toggleTaskToday(s, 'fixed', THU, 'c1');
    expect(plain.doneBy).toBe('b');
    expect(plain.state.forest.creditLedger).toEqual(r.state.forest.creditLedger);
    expect(valid(r.state)).toBe(true);
    const undo = toggleTaskToday(r.state, 'fixed', THU, 'c2');
    expect(undo.doneBy).toBe('a');
  });
});

describe('« pas aujourd’hui »', () => {
  const skip = (taskId: string, dueDate: string, id = `s-${taskId}`): ChoreSkip => ({
    id, taskId, dueDate, at: THU.toISOString(), by: 'a',
  });

  it('skip / unskip purs et idempotents', () => {
    const one = skipOccurrence(undefined, skip('fixed', '2026-10-15'));
    expect(one.added).toBe(true);
    const again = skipOccurrence(one.skips, skip('fixed', '2026-10-15', 'other'));
    expect(again.added).toBe(false);
    expect(again.skips).toBe(one.skips);
    const back = unskipOccurrence(one.skips, 'fixed', '2026-10-15');
    expect(back).toEqual({ skips: [], removed: true });
    expect(unskipOccurrence(back.skips, 'fixed', '2026-10-15').removed).toBe(false);
  });

  it('borné à SKIPS_MAX', () => {
    let skips: ChoreSkip[] = [];
    for (let i = 0; i <= SKIPS_MAX; i += 1) skips = skipOccurrence(skips, skip(`t${i}`, '2026-10-15', `s${i}`)).skips;
    expect(skips.length).toBe(SKIPS_MAX);
    expect(skips[0]!.id).toBe('s1');
  });

  it('occurrence passée : non actionnable, aucun crédit, vitalité inchangée', () => {
    const s = stateWith(fixed);
    s.chores.skips = skipOccurrence(undefined, skip('fixed', '2026-10-15')).skips;
    expect(isActionableToday(fixed, THU, [], s.chores.skips)).toBe(false);
    expect(isActionableToday(fixed, THU, [])).toBe(true); // rétrocompatible sans skips
    expect(actionableTasksToday([fixed], THU, [], s.chores.skips)).toEqual([]);
    const r = toggleTaskToday(s, 'fixed', THU, 'c1');
    expect(r.state).toBe(s);
    expect(r.completed).toBe(false);
    expect(valid(s)).toBe(true);
    // advanceDay ignore les passages : même forêt avec ou sans.
    const without = stateWith(fixed);
    expect(advanceDay(s.forest, '2026-10-20')).toEqual(advanceDay(without.forest, '2026-10-20'));
  });

  it('ponctuelle passée : revient le lendemain ; souple : passée pour la semaine', () => {
    const once = task({ id: 'once', title: 'Rideaux', assignee: 'both', recurrence: 'none' });
    const skips = [skip('once', skipDateFor(once, THU)), skip('flex', skipDateFor(flex, THU))];
    expect(isActionableToday(once, THU, [], skips)).toBe(false);
    expect(isActionableToday(once, SAT, [], skips)).toBe(true);
    expect(isActionableToday(flex, SAT, [], skips)).toBe(false);
    expect(isActionableToday(flex, NEXT_MON, [], skips)).toBe(true);
  });
});
