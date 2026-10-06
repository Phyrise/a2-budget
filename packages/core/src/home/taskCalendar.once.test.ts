import { describe, expect, it } from 'vitest';
import { parseLocalDateKey } from './dates.js';
import { taskOccurrencesBetween } from './taskCalendar.js';
import { createTask, isActionableToday } from './tasks.js';
import type { ChoreCompletion, ChoreSkip } from './types.js';

// Ponctuelle créée le mercredi 30 septembre, pas encore faite.
const once = createTask({ id: 'plombier', title: 'Appeler le plombier', assignee: 'b', recurrence: 'none' }, '2026-09-30');
const TODAY = '2026-10-06';

function skip(dueDate: string): ChoreSkip {
  return { id: `s-${dueDate}`, taskId: 'plombier', dueDate, at: `${dueDate}T08:00:00.000Z` };
}

describe('ponctuelles au Calendrier, comme dans Maison', () => {
  it('non faite : reportée au jour courant (absente de sa date de création passée)', () => {
    const out = taskOccurrencesBetween([once], [], undefined, '2026-09-28', '2026-10-31', TODAY);
    expect(out.map((o) => o.date)).toEqual([TODAY]);
    expect(out[0]).toEqual(expect.objectContaining({ dueDate: 'once', done: false, skipped: false }));
  });

  it('cohérence : actionnable aujourd’hui dans Maison ⇒ occurrence non faite aujourd’hui au Calendrier', () => {
    expect(isActionableToday(once, parseLocalDateKey(TODAY), [])).toBe(true);
    const today = taskOccurrencesBetween([once], [], undefined, TODAY, TODAY, TODAY);
    expect(today).toEqual([expect.objectContaining({ date: TODAY, done: false, skipped: false })]);
  });

  it('« pas aujourd’hui » le jour de sa création ne la fige pas : elle revient', () => {
    const skips: ChoreSkip[] = [skip('2026-09-30')];
    const out = taskOccurrencesBetween([once], [], skips, '2026-09-28', '2026-10-31', TODAY);
    expect(out).toEqual([expect.objectContaining({ date: TODAY, skipped: false })]);
    expect(isActionableToday(once, parseLocalDateKey(TODAY), [], skips)).toBe(true);
  });

  it('passée aujourd’hui : affichée aujourd’hui, en « pas cette fois »', () => {
    const skips: ChoreSkip[] = [skip(TODAY)];
    const out = taskOccurrencesBetween([once], [], skips, TODAY, TODAY, TODAY);
    expect(out).toEqual([expect.objectContaining({ date: TODAY, skipped: true })]);
    expect(isActionableToday(once, parseLocalDateKey(TODAY), [], skips)).toBe(false);
  });

  it('faite : reste barrée au jour où elle l’a été', () => {
    const made: ChoreCompletion = {
      id: 'c',
      taskId: 'plombier',
      taskTitle: 'Appeler le plombier',
      assignee: 'b',
      dueDate: 'once',
      completedAt: new Date(2026, 9, 2, 18, 0).toISOString(),
    };
    const out = taskOccurrencesBetween([once], [made], undefined, '2026-09-28', '2026-10-31', TODAY);
    expect(out).toEqual([expect.objectContaining({ date: '2026-10-02', done: true })]);
  });

  it('sans jour courant : à sa date de création (compatibilité)', () => {
    const out = taskOccurrencesBetween([once], [], undefined, '2026-09-28', '2026-10-31');
    expect(out.map((o) => o.date)).toEqual(['2026-09-30']);
  });
});
