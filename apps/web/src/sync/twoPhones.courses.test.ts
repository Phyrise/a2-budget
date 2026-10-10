/**
 * V5.3 — tâche Courses permanente, deux téléphones (serveur en mémoire) :
 * deux courses le même jour, hors ligne, restent deux faits (ni fusion ni
 * « fait ensemble »), deux crédits ; chacun n'annule que la sienne.
 */
import { describe, expect, it } from 'vitest';
import {
  clearDoneGroceries,
  clearedGroceries,
  createTask,
  liveFactsOfOccurrence,
  toggleGroceryItem,
  undoClearGroceries,
  undoCompletion,
  type AppState,
} from '@a2/core';
import { docsOf } from './docs';
import { SyncEngine } from './engine';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { NOW, addGrocery, at, resetTestIds, richState, testId, toggle } from './testFixtures';

type Role = 'a' | 'b';

function household() {
  resetTestIds();
  const server = new MemoryServer();
  let clock = NOW;
  const phone = (role: Role) => {
    const transport = new MemoryTransport(server, role);
    const engine = new SyncEngine(transport, { role, selectedMonth: '2026-10', now: () => clock, newId: () => testId('e') });
    return {
      transport,
      engine,
      get state(): AppState { return engine.state!; },
      act(fn: (s: AppState) => AppState, when: Date) {
        clock = when;
        engine.commit(fn(engine.state!));
      },
    };
  };
  const a = phone('a');
  a.transport.write(migrationOps(richState(), { now: NOW, role: 'a' }));
  const b = phone('b');
  return { server, a, b };
}

const courses = createTask({ id: 'courses', title: 'Courses', assignee: 'both', recurrence: 'daily', groceries: true }, '2026-10-08');
const addCourses = (s: AppState): AppState => ({ ...s, chores: { ...s.chores, tasks: [...s.chores.tasks, courses] } });
/** Comme SyncCore.canUndo : l'occurrence porte-t-elle un geste vivant de ce rôle ? */
function canUndo(engine: SyncEngine, role: Role, dueDate: string): boolean {
  const facts = docsOf(engine.knownDocs, 'completions').map(([id, data]) => ({ ...data, id }) as {
    id: string; taskId: string; dueDate: string; role?: unknown;
  });
  const live = liveFactsOfOccurrence(facts, 'courses', dueDate);
  return live.length === 0 || live.some((f) => f.role === role);
}
const runs = (s: AppState) => s.chores.completions.filter((c) => c.taskId === 'courses');

describe('Courses à tout moment, deux téléphones', () => {
  for (const order of [['a', 'b'], ['b', 'a']] as Role[][]) {
    it(`deux courses le même jour hors ligne → deux faits, deux crédits (retour ${order.join(' puis ')})`, () => {
      const h = household();
      h.a.act(addCourses, at(9, 8));
      h.a.transport.setOnline(false);
      h.b.transport.setOnline(false);
      h.a.act((s) => toggle(s, 'courses', at(9, 10), 'a'), at(9, 10));
      h.b.act((s) => toggle(s, 'courses', at(9, 18), 'b'), at(9, 18));
      for (const role of order) h[role].transport.setOnline(true);
      expect(h.server.rejected).toEqual([]);
      expect(h.a.state).toEqual(h.b.state);
      const done = runs(h.a.state);
      expect(done.map((c) => c.doneBy ?? c.assignee).sort()).toEqual(['a', 'b']);
      expect(new Set(done.map((c) => c.dueDate)).size).toBe(2);
      for (const c of done) expect(h.a.state.forest.creditLedger[`courses|${c.dueDate}`]?.status).toBe('active');
    });
  }

  it('AC annule sa seconde course : celle d’AL reste, les deux téléphones d’accord', () => {
    const h = household();
    h.a.act(addCourses, at(9, 8));
    h.a.act((s) => toggle(s, 'courses', at(9, 10), 'a'), at(9, 10));
    h.b.act((s) => toggle(s, 'courses', at(9, 18), 'b'), at(9, 18));
    expect(runs(h.a.state)).toHaveLength(2);
    const mine = runs(h.b.state).find((c) => c.doneBy === 'b')!;
    const theirs = runs(h.b.state).find((c) => c.doneBy !== 'b')!;
    expect(canUndo(h.b.engine, 'b', mine.dueDate)).toBe(true);
    expect(canUndo(h.b.engine, 'b', theirs.dueDate)).toBe(false);
    h.b.act((s) => undoCompletion(s, mine.id, at(9, 18, 5)).state, at(9, 18, 5));
    expect(h.server.rejected).toEqual([]);
    expect(runs(h.a.state).map((c) => c.id)).toEqual([theirs.id]);
    expect(h.a.state.forest.creditLedger[`courses|${theirs.dueDate}`]?.status).toBe('active');
    expect(h.a.state.forest.creditLedger[`courses|${mine.dueDate}`]?.status).toBe('tombstoned');
    expect(h.a.state).toEqual(h.b.state);
  });
});

describe('Annuler « Vider le panier », deux téléphones', () => {
  it('articles revenus, achats et fait Courses annulés chez les deux ; revider passe', () => {
    const h = household();
    h.a.act(addCourses, at(9, 8));
    h.a.act((s) => addGrocery(addGrocery(s, 'Pain', at(9, 9), 'a'), 'Lait', at(9, 9), 'a'), at(9, 9));
    const ids = h.a.state.groceries.items.filter((i) => i.label === 'Pain' || i.label === 'Lait').map((i) => i.id);
    h.a.act((s) => ({ ...s, groceries: { ...s.groceries, items: ids.reduce((items, id) => toggleGroceryItem(items, id, at(9, 10)), s.groceries.items) } }), at(9, 10));
    const historyBefore = h.a.state.groceries.history ?? [];
    const receipt = clearedGroceries(h.a.state.groceries);
    h.a.act((s) => ({ ...s, groceries: clearDoneGroceries(s.groceries, at(9, 11)) }), at(9, 11));
    h.a.act((s) => toggle(s, 'courses', at(9, 11), 'a'), at(9, 11));
    expect(runs(h.b.state)).toHaveLength(1);
    expect(h.b.state.groceries.items.some((i) => i.label === 'Pain')).toBe(false);
    const run = runs(h.a.state)[0]!;

    // Annuler : tout le geste.
    h.a.act((s) => undoCompletion(s, run.id, at(9, 12)).state, at(9, 12));
    h.a.act((s) => ({ ...s, groceries: undoClearGroceries(s.groceries, receipt, receipt.map((_, i) => `n${i}`)) }), at(9, 12));
    expect(h.server.rejected).toEqual([]);
    for (const phone of [h.a, h.b]) {
      expect(runs(phone.state)).toEqual([]);
      expect(phone.state.groceries.items.filter((i) => i.done).map((i) => i.label).sort()).toEqual(
        receipt.map((c) => c.item.label).sort(),
      );
      expect(phone.state.groceries.history ?? []).toEqual(historyBefore);
    }
    expect(h.a.state.forest.creditLedger[`courses|${run.dueDate}`]?.status).toBe('tombstoned');
    expect(h.a.state).toEqual(h.b.state);

    // Revider : nouveaux achats (ids neufs), aucun refus.
    h.a.act((s) => ({ ...s, groceries: clearDoneGroceries(s.groceries, at(9, 13)) }), at(9, 13));
    expect(h.server.rejected).toEqual([]);
    expect(h.b.state.groceries.history?.slice(0, receipt.length).map((p) => p.id).sort()).toEqual(receipt.map((_, i) => `n${i}`).sort());
    expect(h.a.state).toEqual(h.b.state);
  });
});
