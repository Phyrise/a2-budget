import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from '../home/appState.js';
import { toggleTaskToday } from '../home/choreActions.js';
import { localDateKey } from '../home/dates.js';
import { advanceDay, DAILY_CREDIT_CAP, emptyForest, pauseForest, resumeForest } from '../home/forest.js';
import { createTask } from '../home/tasks.js';
import type { AppState, ForestState } from '../home/types.js';
import { completionFact, undoFact, type CompletionFact, type ForestEventFact, type Role } from './facts.js';
import {
  buildCheckpoint,
  checkpointDayFor,
  checkpointsToKeep,
  latestCheckpoint,
  replayForest,
  type ForestCheckpoint,
} from './replay.js';

/** Toutes les permutations (petites listes). */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const dayKey = (day: number) => localDateKey(at(day, 12));

function done(id: string, taskId: string, when: Date, opts: { by?: Role; imported?: boolean } = {}): CompletionFact {
  const fact = completionFact({
    id,
    taskId,
    taskTitle: taskId,
    assignee: opts.by ?? 'a',
    dueDate: localDateKey(when),
    completedAt: when.toISOString(),
  }, undefined);
  return opts.imported === true ? { ...fact, imported: true } : fact;
}

function undone(fact: CompletionFact, when: Date, by: Role = 'a'): CompletionFact {
  return undoFact(fact, { at: when.toISOString(), day: localDateKey(when), by });
}

function event(id: string, kind: 'pause' | 'resume', when: Date): ForestEventFact {
  return { id, kind, localDay: localDateKey(when), at: when.toISOString() };
}

/**
 * Téléphone local d'aujourd'hui (V4) : bascules réelles (`toggleTaskToday`,
 * pause du store), et les faits qu'elles produisent en mode synchronisé.
 */
function localPhone(taskIds: string[]) {
  let state: AppState = emptyAppState();
  state.chores.tasks = taskIds.map((id) => createTask({ id, title: id, assignee: 'a', recurrence: 'daily' }, '2026-10-01'));
  const completions: CompletionFact[] = [];
  const forestEvents: ForestEventFact[] = [];
  let seq = 0;
  return {
    toggle(taskId: string, when: Date) {
      const id = `c${(seq += 1)}`;
      const r = toggleTaskToday(state, taskId, when, id);
      if (r.completionId === null) return;
      if (r.completed) {
        const created = r.state.chores.completions.find((c) => c.id === id)!;
        completions.push(completionFact(created, state.chores.tasks.find((t) => t.id === taskId)));
      } else {
        const i = completions.findIndex((c) => c.id === r.completionId);
        completions[i] = undone(completions[i]!, when);
      }
      state = r.state;
    },
    pause(when: Date) {
      const day = localDateKey(when);
      const forest = state.forest.paused ? resumeForest(state.forest, day) : pauseForest(advanceDay(state.forest, day), day);
      if (forest === state.forest) return;
      forestEvents.push(event(`e${(seq += 1)}`, state.forest.paused ? 'resume' : 'pause', when));
      state = { ...state, forest };
    },
    open(when: Date) {
      state = { ...state, forest: advanceDay(state.forest, localDateKey(when)) };
    },
    get forest(): ForestState { return state.forest; },
    facts: { completions, forestEvents },
  };
}

describe('replayForest — même résultat que les bascules locales', () => {
  it('cocher, décocher, recocher, plafond, pause et reprise sur plusieurs jours', () => {
    const phone = localPhone(['t1', 't2', 't3', 't4', 't5']);
    phone.toggle('t1', at(1, 9));
    phone.toggle('t2', at(1, 10));
    phone.toggle('t2', at(1, 10, 5)); // décoche
    phone.toggle('t2', at(1, 10, 6)); // recoche : aucun crédit
    phone.toggle('t3', at(1, 11));
    phone.toggle('t4', at(1, 12)); // plafond atteint
    phone.open(at(2, 8));
    phone.toggle('t1', at(2, 9));
    phone.pause(at(3, 8));
    phone.toggle('t5', at(4, 9)); // en pause : sans crédit
    phone.pause(at(6, 8)); // reprise
    phone.toggle('t1', at(6, 9));
    phone.open(at(12, 8)); // longue absence : la vitalité décroît doucement
    phone.toggle('t3', at(12, 9));
    const today = dayKey(13);
    phone.open(at(13, 8));
    expect(replayForest(null, phone.facts, today)).toEqual(phone.forest);
    expect(phone.forest.lifetimeCare).toBe(6);
    expect(phone.forest.pauses).toEqual([{ start: '2026-10-03', end: '2026-10-05' }]);
    expect(phone.forest.creditLedger['t4|2026-10-01']?.status).toBe('uncredited');
  });

  it('une série de dix jours fait venir le gardien, comme en local', () => {
    const phone = localPhone(['t1']);
    for (let d = 1; d <= 11; d += 1) phone.toggle('t1', at(d, 9));
    phone.open(at(11, 20));
    const replayed = replayForest(null, phone.facts, dayKey(11));
    expect(replayed).toEqual(phone.forest);
    expect(replayed.lastRareEvent).toBe('guardian');
  });
});

describe('replayForest — ordre d’arrivée', () => {
  it('toutes les permutations des faits donnent la même forêt', () => {
    const c1 = done('c1', 't1', at(1, 9));
    const c2 = undone(done('c2', 't2', at(1, 10), { by: 'b' }), at(1, 18), 'b');
    const c3 = done('c3', 't2', at(1, 19), { by: 'b' }); // recomplétion
    const c4 = done('c4', 't3', at(2, 9));
    const p = event('e1', 'pause', at(2, 12));
    const r = event('e2', 'resume', at(4, 8));
    const today = dayKey(5);
    const items = [c1, c2, c3, c4, p, r];
    const reference = replayForest(null, { completions: [c1, c2, c3, c4], forestEvents: [p, r] }, today);
    for (const order of permutations(items)) {
      const completions = order.filter((x): x is CompletionFact => 'creditKey' in x);
      const forestEvents = order.filter((x): x is ForestEventFact => 'kind' in x);
      expect(replayForest(null, { completions, forestEvents }, today)).toEqual(reference);
    }
    expect(reference.creditLedger['t2|2026-10-01']?.status).toBe('tombstoned');
    expect(reference.lifetimeCare).toBe(3);
  });

  it('un fait reçu deux fois (vivant puis annulé) : l’annulation l’emporte, dans les deux ordres', () => {
    const live = done('c1', 't1', at(1, 9));
    const dead = undone(live, at(1, 10));
    const a = replayForest(null, { completions: [live, dead] }, dayKey(1));
    const b = replayForest(null, { completions: [dead, live] }, dayKey(1));
    expect(a).toEqual(b);
    expect(a.creditLedger['t1|2026-10-01']?.status).toBe('tombstoned');
  });

  it('plafond : AL et AC cochent chacun deux tâches hors ligne → 3 crédits, par heure de complétion', () => {
    const facts = [
      done('a1', 'ta1', at(1, 10)),
      done('a2', 'ta2', at(1, 10, 5)),
      done('b1', 'tb1', at(1, 9), { by: 'b' }),
      done('b2', 'tb2', at(1, 11), { by: 'b' }),
    ];
    for (const order of permutations(facts)) {
      const forest = replayForest(null, { completions: order }, dayKey(1));
      expect(forest.lifetimeCare).toBe(DAILY_CREDIT_CAP);
      expect(forest.creditLedger['tb2|2026-10-01']?.status).toBe('uncredited');
      expect(forest.creditLedger['tb1|2026-10-01']?.status).toBe('active');
    }
  });

  it('une annulation datée avant sa complétion (horloge en retard) passe quand même après elle', () => {
    const fact = done('c1', 't1', at(1, 10));
    const early = undoFact(fact, { at: at(1, 9).toISOString(), day: dayKey(1), by: 'b' });
    const forest = replayForest(null, { completions: [early] }, dayKey(1));
    expect(forest.creditLedger['t1|2026-10-01']?.status).toBe('tombstoned');
  });

  it('deux complétions de la même occurrence : un seul crédit', () => {
    const forest = replayForest(null, {
      completions: [done('a', 't1', at(1, 9)), done('b', 't1', at(1, 9, 30), { by: 'b' })],
    }, dayKey(1));
    expect(forest.lifetimeCare).toBe(1);
  });

  it('pause posée par l’un pendant que l’autre coche hors ligne : sans crédit, état valide', () => {
    const forest = replayForest(null, {
      completions: [done('c1', 't1', at(1, 9)), done('c2', 't2', at(2, 10), { by: 'b' })],
      forestEvents: [event('p', 'pause', at(2, 8))],
    }, dayKey(2));
    expect(forest.paused).toBe(true);
    expect(forest.creditLedger['t2|2026-10-02']?.status).toBe('uncredited');
    const state = { ...emptyAppState(), forest };
    expect(validateAppState(JSON.parse(JSON.stringify(state))).ok).toBe(true);
  });

  it('deux pauses concurrentes : la seconde est sans effet ; faits invalides ignorés', () => {
    const forest = replayForest(null, {
      completions: [{ ...done('x', 't1', at(1, 9)), localDay: 'n’importe' }],
      forestEvents: [event('p1', 'pause', at(1, 8)), event('p2', 'pause', at(1, 8, 30)),
        undoFact(event('p3', 'resume', at(1, 9)), { at: at(1, 9).toISOString(), day: dayKey(1), by: 'a' })],
    }, dayKey(1));
    expect(forest.paused).toBe(true);
    expect(forest.pauses).toEqual([{ start: '2026-10-01', end: null }]);
    expect(forest.lifetimeCare).toBe(0);
  });

  it('un fait daté loin dans le futur (horloge fausse) attend son jour, sans bloquer aujourd’hui', () => {
    const wrong = done('w', 't9', new Date(2027, 0, 1, 9), { by: 'b' });
    const today = done('c1', 't1', at(2, 9));
    const forest = replayForest(null, { completions: [wrong, today] }, dayKey(2));
    expect(forest.creditLedger['t1|2026-10-02']?.status).toBe('active');
    expect(forest.creditLedger['t9|2027-01-01']).toBeUndefined();
    // Un jour d’avance (autre fuseau) est accepté.
    const tomorrow = done('c2', 't2', at(3, 1), { by: 'b' });
    expect(replayForest(null, { completions: [tomorrow] }, dayKey(2)).lifetimeCare).toBe(1);
  });

  it('sans aucun fait : forêt neuve avancée au jour', () => {
    expect(replayForest(null, { completions: [] }, dayKey(3))).toEqual(advanceDay(emptyForest(), dayKey(3)));
  });
});

describe('points de reprise', () => {
  const facts = {
    completions: [
      done('c1', 't1', at(1, 9)),
      undone(done('c2', 't2', at(2, 9)), at(9, 9)), // annulée bien plus tard
      done('c3', 't1', at(3, 9)),
      done('c4', 't3', at(8, 9), { by: 'b' }),
    ],
    forestEvents: [event('p', 'pause', at(4, 9)), event('r', 'resume', at(6, 9))],
  };

  it('reprendre d’un point au jour J donne la même forêt que tout rejouer', () => {
    const today = dayKey(10);
    const full = replayForest(null, facts, today);
    for (const j of [1, 2, 4, 5, 8, 9]) {
      const cp = buildCheckpoint(null, facts, dayKey(j));
      expect(cp.day).toBe(dayKey(j));
      expect(replayForest(cp, facts, today)).toEqual(full);
    }
  });

  it('genèse (migration) : les faits importés sont déjà comptés, les suivants rejoués', () => {
    const phone = localPhone(['t1', 't2']);
    phone.toggle('t1', at(1, 9));
    phone.toggle('t2', at(1, 10));
    const genesis: ForestCheckpoint = { day: dayKey(1), forest: phone.forest, genesis: true };
    const imported = phone.facts.completions.map((c) => ({ ...c, imported: true as const }));
    phone.toggle('t2', at(1, 15)); // décoché après la migration, le même jour
    phone.toggle('t1', at(2, 9));
    phone.open(at(2, 20));
    const after = phone.facts.completions.slice(2);
    const undoneImport = { ...phone.facts.completions[1]!, imported: true as const };
    const replayed = replayForest(genesis, { completions: [imported[0]!, undoneImport, ...after] }, dayKey(2));
    expect(replayed).toEqual(phone.forest);
  });

  it('un fait arrivé après coup avant le point de reprise n’affecte plus la forêt', () => {
    const cp = buildCheckpoint(null, facts, dayKey(9));
    const late = done('late', 't9', at(5, 9), { by: 'b' });
    const withLate = { ...facts, completions: [...facts.completions, late] };
    expect(replayForest(cp, withLate, dayKey(10))).toEqual(replayForest(cp, facts, dayKey(10)));
  });

  it('jour du point de reprise : dernier jour du mois d’il y a deux mois', () => {
    expect(checkpointDayFor('2026-10-08')).toBe('2026-08-31');
    expect(checkpointDayFor('2026-03-01')).toBe('2026-01-31');
    expect(checkpointDayFor('2026-01-15')).toBe('2025-11-30');
  });

  it('le plus récent point gagne (l’ordinaire avant la genèse) ; on garde la genèse + 3', () => {
    const forest = emptyForest();
    const g: ForestCheckpoint = { day: '2026-01-10', forest, genesis: true };
    const list: ForestCheckpoint[] = ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']
      .map((day) => ({ day, forest }));
    expect(latestCheckpoint([g, ...list])?.day).toBe('2026-04-30');
    const sameDay: ForestCheckpoint = { day: '2026-01-10', forest };
    expect(latestCheckpoint([g, sameDay])).toBe(sameDay);
    expect(latestCheckpoint([])).toBeNull();
    expect(checkpointsToKeep([g, ...list]).map((cp) => cp.day))
      .toEqual(['2026-01-10', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
});
