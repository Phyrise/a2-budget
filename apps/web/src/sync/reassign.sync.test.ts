/**
 * V5.10 — « C'était AC » à deux téléphones : corriger l'auteur d'un fait ne
 * l'annule pas (même id, soin gardé), passe les règles (factReassign) et
 * arrive chez l'autre ; le fait de l'autre ne se corrige pas.
 */
import { describe, expect, it } from 'vitest';
import { createTask, reassignCompletion, weeklyCareGoal, type AppState } from '@a2/core';
import { SyncEngine } from './engine';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { NOW, resetTestIds, richState, testId, toggle } from './testFixtures';

type Role = 'a' | 'b';

function household() {
  resetTestIds();
  const server = new MemoryServer();
  const now = () => NOW;
  const phone = (role: Role) => {
    const transport = new MemoryTransport(server, role);
    const engine = new SyncEngine(transport, { role, selectedMonth: '2026-10', now, newId: () => testId('e') });
    return {
      engine,
      get state(): AppState { return engine.state!; },
      act(fn: (s: AppState) => AppState) { engine.commit(fn(engine.state!)); },
    };
  };
  const a = phone('a');
  const initial = richState();
  initial.chores.tasks = [...initial.chores.tasks, createTask({ id: 'v', title: 'Vaisselle', assignee: 'a', recurrence: 'daily' }, '2026-10-01')];
  new MemoryTransport(server, 'a').write(migrationOps(initial, { now: NOW, role: 'a' }));
  const b = phone('b');
  return { server, a, b };
}

const doneOf = (s: AppState, taskId: string) => s.chores.completions.filter((c) => c.taskId === taskId).at(-1)!;

describe('corriger qui l’a fait (synchronisé)', () => {
  it('AL coche, corrige « C’était AC » : même fait, doneBy chez les deux, soin gardé', () => {
    const h = household();
    h.a.act((s) => toggle(s, 'v', NOW, 'a'));
    const fact = doneOf(h.a.state, 'v');
    const goal = weeklyCareGoal(h.a.state.forest, NOW);
    h.a.act((s) => reassignCompletion(s, fact.id, 'b').state);
    expect(h.server.rejected).toEqual([]);
    for (const phone of [h.a, h.b]) {
      const c = doneOf(phone.state, 'v');
      expect(c.id).toBe(fact.id);
      expect(c.doneBy).toBe('b');
      expect(weeklyCareGoal(phone.state.forest, NOW)).toEqual(goal);
    }
    // Retour à l'assignee : doneBy retiré partout.
    h.a.act((s) => reassignCompletion(s, fact.id, 'a').state);
    expect(h.server.rejected).toEqual([]);
    expect(doneOf(h.b.state, 'v').doneBy).toBeUndefined();
  });

  it('le fait de l’autre ne se corrige pas (rien n’est écrit)', () => {
    const h = household();
    h.a.act((s) => toggle(s, 'v', NOW, 'a'));
    const fact = doneOf(h.b.state, 'v');
    h.b.act((s) => reassignCompletion(s, fact.id, 'b').state);
    expect(h.server.rejected).toEqual([]);
    expect(doneOf(h.a.state, 'v').doneBy).toBeUndefined();
  });
});
