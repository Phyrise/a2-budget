import { describe, expect, it } from 'vitest';
import { createTask, emptyAppState, type AppState } from '@a2/core';
import { taskItemsBetween } from './taskAgenda';

// Hebdomadaire du lundi, en tour à tour, AL commence. Lundi 5 octobre 2026.
function stateWith(): AppState {
  const app = emptyAppState();
  const task = createTask(
    { id: 'poubelles', title: 'Poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: 1, rotation: true },
    '2026-10-01',
  );
  return { ...app, chores: { ...app.chores, tasks: [task] } };
}

describe('tâches au Calendrier : tour à tour', () => {
  it('les occurrences à venir alternent AL, AC, AL, AC', () => {
    const items = taskItemsBetween(stateWith(), '2026-10-06', '2026-11-02', '2026-10-06');
    expect(items.map((i) => `${i.date} ${i.who}`)).toEqual([
      '2026-10-12 a',
      '2026-10-19 b',
      '2026-10-26 a',
      '2026-11-02 b',
    ]);
  });

  it('une fenêtre qui commence plus tard garde l’alternance comptée depuis aujourd’hui', () => {
    const items = taskItemsBetween(stateWith(), '2026-10-19', '2026-10-26', '2026-10-06');
    expect(items.map((i) => `${i.date} ${i.who}`)).toEqual(['2026-10-19 b', '2026-10-26 a']);
  });
});
