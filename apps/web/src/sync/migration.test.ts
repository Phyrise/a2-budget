import { describe, expect, it } from 'vitest';
import { createTask, toggleTaskToday, type AppState } from '@a2/core';
import { MemoryServer } from './memoryTransport';
import { householdContent, migrationBatches, parseMigrationMark } from './migration';
import { projectState } from './project';
import { NOW, richState } from './testFixtures';
import { BATCH_LIMIT } from './writePlan';

let tokens = 0;
const newId = () => `tok-${(tokens += 1)}`;

/** Un foyer chargé : plus de 450 documents (plusieurs lots). */
function bigState(): AppState {
  let s = richState();
  const tasks = Array.from({ length: 300 }, (_, i) =>
    createTask({ id: `t${i}`, title: `Tâche ${i}`, assignee: 'a', recurrence: 'daily' }, '2026-10-01'));
  s = { ...s, chores: { ...s.chores, tasks: [...s.chores.tasks, ...tasks] } };
  for (let i = 0; i < 300; i += 1) s = toggleTaskToday(s, `t${i}`, NOW, `done-${i}`).state;
  return s;
}

function send(server: MemoryServer, batches: ReturnType<typeof migrationBatches>, count = batches.length): void {
  for (const batch of batches.slice(0, count)) expect(server.commit(batch, 'a')).toBe(true);
}

describe('première connexion : contenu du foyer et envoi initial', () => {
  it('vide → ce téléphone l’initialise ; envoi de son rôle en cours → reprise ; sinon données communes', () => {
    const at = NOW.toISOString();
    expect(householdContent(null, 'a')).toBe('empty');
    expect(householdContent({ status: 'running', role: 'a', at }, 'a')).toBe('resume');
    expect(householdContent({ status: 'running', role: 'a', at }, 'b')).toBe('shared');
    expect(householdContent({ status: 'done', role: 'b', at }, 'b')).toBe('shared');
    expect(parseMigrationMark({ status: 'done', role: 'a', at, updatedBy: 'uid' })).toEqual({ status: 'done', role: 'a', at });
    expect(parseMigrationMark({ status: 'fini', role: 'a', at })).toBeNull();
    expect(parseMigrationMark({ status: 'done', role: 'a', at: 'hier' })).toBeNull();
  });

  it('par lots de 450 au plus ; le foyer projeté est exactement l’état du téléphone', () => {
    const state = bigState();
    const batches = migrationBatches(state, { now: NOW, role: 'a', existing: new Set(), newId });
    expect(batches.length).toBeGreaterThan(1);
    expect(Math.max(...batches.map((b) => b.length))).toBeLessThanOrEqual(BATCH_LIMIT);
    const server = new MemoryServer();
    send(server, batches);
    const projected = projectState(server.snapshot, { selectedMonth: state.budget.selectedMonth, today: NOW });
    expect(projected.ok && projected.state).toEqual(state);
  });

  it('coupure en route : la reprise saute ce qui est déjà là et finit le travail (aucun refus)', () => {
    const state = bigState();
    const server = new MemoryServer();
    send(server, migrationBatches(state, { now: NOW, role: 'a', existing: new Set(), newId }), 1);
    const existing = new Set(server.snapshot.keys());
    const rest = migrationBatches(state, { now: NOW, role: 'a', existing, newId });
    expect(rest.flat().some((op) => existing.has(`${op.collection}/${op.id}`))).toBe(false);
    send(server, rest);
    expect(server.rejected).toEqual([]);
    const projected = projectState(server.snapshot, { selectedMonth: state.budget.selectedMonth, today: NOW });
    expect(projected.ok && projected.state).toEqual(state);
  });
});
