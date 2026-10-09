/**
 * V5.3 — tâche Courses permanente en synchronisé : deux courses le même jour
 * (deux téléphones, hors ligne) restent deux faits, deux crédits ; annuler
 * l'une laisse l'autre.
 */
import { describe, expect, it } from 'vitest';
import { anytimeDueDate } from '../home/occurrences.js';
import type { ChoreCompletion, HouseholdTask } from '../home/types.js';
import { completionFact, liveCompletions, liveFactsOfOccurrence, undoFact } from './facts.js';
import { replayForest } from './replay.js';

const TASK: HouseholdTask = { id: 'c', title: 'Courses', assignee: 'both', recurrence: 'daily', createdAt: '2026-10-01', groceries: true };
const iso = (h: number) => new Date(2026, 9, 8, h).toISOString();

function run(id: string, h: number, doneBy: 'a' | 'b'): ChoreCompletion {
  return { id, taskId: 'c', taskTitle: 'Courses', assignee: 'both', doneBy, dueDate: anytimeDueDate('2026-10-08', id), completedAt: iso(h) };
}

describe('Courses à tout moment, synchronisé', () => {
  const a = completionFact(run('ra', 10, 'a'), TASK);
  const b = completionFact(run('rb', 18, 'b'), TASK);

  it('deux faits du même jour ne fusionnent pas (ni « ensemble »)', () => {
    const live = liveCompletions([b, a]);
    expect(live.map((c) => c.id).sort()).toEqual(['ra', 'rb']);
    expect(live.find((c) => c.id === 'ra')?.doneBy).toBe('a');
    expect(a.creditKey).not.toBe(b.creditKey);
  });

  it('deux crédits ; annuler le second garde le premier', () => {
    expect(replayForest(null, { completions: [a, b] }, '2026-10-08').lifetimeCare).toBe(2);
    const undone = undoFact(b, { at: iso(19), day: '2026-10-08', by: 'b' });
    const forest = replayForest(null, { completions: [a, undone] }, '2026-10-08');
    expect(forest.creditLedger[a.creditKey]?.status).toBe('active');
    expect(forest.creditLedger[b.creditKey]?.status).toBe('tombstoned');
    expect(liveCompletions([a, undone]).map((c) => c.id)).toEqual(['ra']);
    expect(liveFactsOfOccurrence([a, undone], 'c', a.dueDate).map((f) => f.id)).toEqual(['ra']);
  });
});
