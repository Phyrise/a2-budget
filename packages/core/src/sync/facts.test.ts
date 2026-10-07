import { describe, expect, it } from 'vitest';
import { createTask } from '../home/tasks.js';
import type { ChoreCompletion } from '../home/types.js';
import {
  completionFact,
  dedupeFacts,
  isLive,
  liveCompletions,
  liveFacts,
  liveFactsOfOccurrence,
  liveSkips,
  mergeFact,
  undoFact,
  type CompletionFact,
  type FocusFact,
  type SkipFact,
} from './facts.js';

const AT = new Date(2026, 9, 8, 10, 0);
const iso = (h: number, m = 0) => new Date(2026, 9, 8, h, m).toISOString();

function completion(id: string, over: Partial<ChoreCompletion> = {}): ChoreCompletion {
  return { id, taskId: 't1', taskTitle: 'Plantes', assignee: 'a', dueDate: '2026-10-08', completedAt: iso(10), ...over };
}

function fact(id: string, over: Partial<ChoreCompletion> = {}): CompletionFact {
  return completionFact(completion(id, over), undefined);
}

const undo = { at: iso(12), day: '2026-10-08', by: 'b' as const };

describe('faits annulables', () => {
  it('annuler marque le fait sans rien retirer ; une seconde annulation ne change rien', () => {
    const f = fact('c1');
    const u = undoFact(f, undo);
    expect(isLive(f)).toBe(true);
    expect(isLive(u)).toBe(false);
    expect(u).toMatchObject({ id: 'c1', undoneAt: iso(12), undoneDay: '2026-10-08', undoneBy: 'b' });
    expect(u.devOverride).toBeUndefined();
    expect(undoFact(u, { ...undo, at: iso(13) })).toBe(u);
    expect(undoFact(f, { ...undo, devOverride: true }).devOverride).toBe(true);
  });

  it('fusion de deux versions : l’annulée gagne, la plus ancienne annulation sinon (commutatif)', () => {
    const f = fact('c1');
    const late = undoFact(f, { ...undo, at: iso(14) });
    const early = undoFact(f, { ...undo, at: iso(12), by: 'a' });
    expect(mergeFact(f, late)).toBe(late);
    expect(mergeFact(late, f)).toBe(late);
    expect(mergeFact(late, early)).toBe(early);
    expect(mergeFact(early, late)).toBe(early);
    expect(dedupeFacts([f, late, early, f]).map((x) => x.undoneAt)).toEqual([iso(12)]);
  });

  it('fait de complétion : jour local de l’auteur et clé de crédit de la tâche', () => {
    const weekly = createTask({ id: 'w', title: 'Draps', assignee: 'b', recurrence: 'weekly', weeklyDay: 4, flexible: true }, '2026-10-01');
    const f = completionFact(completion('c1', { taskId: 'w', dueDate: '2026-10-05', completedAt: AT.toISOString() }), weekly);
    expect(f.localDay).toBe('2026-10-08');
    expect(f.creditKey).toBe('w|2026-10-05');
    const once = createTask({ id: 'o', title: 'Rideaux', assignee: 'a', recurrence: 'none' }, '2026-10-08');
    expect(completionFact(completion('c2', { taskId: 'o', dueDate: 'once' }), once).creditKey).toBe('o|once');
    expect(fact('c3').creditKey).toBe('t1|2026-10-08');
  });
});

describe('projection des faits vivants', () => {
  it('complétions : faits annulés absents, champs de fait retirés, ordre conservé', () => {
    const facts = [fact('c1'), undoFact(fact('c2', { taskId: 't2' }), undo), { ...fact('c3', { taskId: 't3' }), imported: true as const }];
    expect(liveCompletions(facts)).toEqual([completion('c1'), completion('c3', { taskId: 't3' })]);
  });

  it('deux complétions de la même occurrence : la première gardée, « fait ensemble » si l’un et l’autre', () => {
    const byA = fact('zz', { completedAt: iso(9) });
    const byB = fact('aa', { completedAt: iso(11), doneBy: 'b' });
    for (const facts of [[byA, byB], [byB, byA]]) {
      expect(liveCompletions(facts)).toEqual([{ ...completion('zz', { completedAt: iso(9) }), doneBy: 'both' }]);
    }
    // Même heure : l’id départage ; même personne : rien ne change.
    const twin = fact('ab', { completedAt: iso(9) });
    expect(liveCompletions([byA, twin])).toEqual([completion('ab', { completedAt: iso(9) })]);
    // Tâche « à deux » : pas de doneBy redondant.
    const both = [fact('x', { assignee: 'both', doneBy: 'a' }), fact('y', { assignee: 'both', doneBy: 'b', completedAt: iso(11) })];
    expect(liveCompletions(both)).toEqual([completion('x', { assignee: 'both' })]);
  });

  it('« pas aujourd’hui » : un par occurrence (le premier), les annulés retirés', () => {
    const s = (id: string, at: string, over: Partial<SkipFact> = {}): SkipFact =>
      ({ id, taskId: 't1', dueDate: '2026-10-08', at, ...over });
    const facts = [s('k2', iso(11), { by: 'b' }), s('k1', iso(10), { by: 'a' }), undoFact(s('k3', iso(9), { taskId: 't2' }), undo)];
    expect(liveSkips(facts)).toEqual([{ id: 'k1', taskId: 't1', dueDate: '2026-10-08', at: iso(10), by: 'a' }]);
  });

  it('faits vivants d’une occurrence (pour tout annuler d’un geste) et autres faits', () => {
    const facts = [fact('c1'), fact('c2', { completedAt: iso(11) }), undoFact(fact('c3'), undo), fact('c4', { taskId: 't2' })];
    expect(liveFactsOfOccurrence(facts, 't1', '2026-10-08').map((f) => f.id)).toEqual(['c1', 'c2']);
    const sessions: FocusFact[] = [{ id: 'f1', startedAt: iso(8), minutes: 10, who: 'a' }];
    sessions.push(undoFact<FocusFact>({ id: 'f2', startedAt: iso(9), minutes: 5, who: 'b' }, undo));
    expect(liveFacts(sessions)).toEqual([sessions[0]]);
  });
});
