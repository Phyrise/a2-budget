import { describe, expect, it } from 'vitest';
import { addQuest, devQuest, helpQuest, isQuestDone, questOfDay, type AppState, type SharedQuest } from '@a2/core';
import { applyBatch } from './apply';
import { SyncEngine } from './engine';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { questUpdateRefusal } from './quests';
import { at, NOW, resetTestIds, richState, testId } from './testFixtures';

type Role = 'a' | 'b';
const DAY = '2026-10-08';

/** Un foyer : faux serveur, téléphone d'AL (qui migre) et d'AC. */
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
      act(fn: (s: AppState) => AppState, when: Date = clock) {
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

const items = (s: AppState) => s.quests?.items ?? [];
const withItems = (s: AppState, list: SharedQuest[]): AppState => ({ ...s, quests: { items: list } });
const help = (q: SharedQuest, role: Role, when: Date) => (s: AppState) => withItems(s, helpQuest(items(s), q, role, when));

describe('quêtes communes à deux téléphones', () => {
  it('AL fait apparaître (mode dév.) → AC la voit ; les deux aident → réglée des deux côtés', () => {
    const h = household();
    const q = devQuest('rocher', DAY, 'a', 'qa1');
    h.a.act((s) => withItems(s, addQuest(items(s), q)), at(8, 9));
    expect(questOfDay(items(h.b.state), DAY, { scheduled: false })?.id).toBe(q.id);

    h.a.act(help(q, 'a', at(8, 10)), at(8, 10));
    expect(h.b.state.quests!.items[0]!.helpers.a).toBeDefined();
    h.b.act(help(items(h.b.state)[0]!, 'b', at(8, 21)), at(8, 21));

    expect(h.server.rejected).toEqual([]);
    for (const p of [h.a, h.b]) {
      const [only] = items(p.state);
      expect(isQuestDone(only!)).toBe(true);
      expect(only!.doneAt).toBe(at(8, 21).toISOString());
      expect(only!.createdBy).toBe('a');
    }
    expect(h.a.state.quests).toEqual(h.b.state.quests);
  });

  it('quête du calendrier touchée par les deux hors ligne : une seule, réglée, sans doublon', () => {
    const h = household();
    const virtual: SharedQuest = { id: `${DAY}-pousse`, kind: 'pousse', day: DAY, tab: 'calendar', spot: 1, createdBy: 'a', helpers: {} };
    h.a.transport.setOnline(false);
    h.b.transport.setOnline(false);
    h.a.act(help(virtual, 'a', at(8, 9)), at(8, 9));
    h.b.act(help(virtual, 'b', at(8, 9, 30)), at(8, 9, 30));
    h.a.transport.setOnline(true);
    h.b.transport.setOnline(true);
    // La création d'AC ne fait rien (déjà là ; Firestore la refuse, seule) : son aide passe.
    expect(h.server.rejected).toEqual([]);
    for (const p of [h.a, h.b]) {
      expect(items(p.state)).toHaveLength(1);
      expect(isQuestDone(items(p.state)[0]!)).toBe(true);
      expect(items(p.state)[0]!.createdBy).toBe('a');
    }
  });

  it('règles du faux serveur : chacun sa propre aide, une fois ; doneAt avec les deux', () => {
    const doc = { id: `${DAY}-rocher`, helpers: { a: at(8, 9).toISOString() } };
    expect(questUpdateRefusal(doc, [[['helpers', 'b'], 'x']], 'b')).toBeNull();
    expect(questUpdateRefusal(doc, [[['helpers', 'b'], 'x']], 'a')).toBe('quest-not-yours');
    expect(questUpdateRefusal(doc, [[['helpers', 'a'], 'x']], 'a')).toBe('quest-not-yours');
    expect(questUpdateRefusal(doc, [[['kind'], 'pousse']], 'b')).toBe('quest-not-yours');
    expect(questUpdateRefusal({ id: 'x', helpers: {} }, [[['helpers', 'a'], 'x'], [['doneAt'], 'y']], 'a')).toBe('quest-not-done');
    expect(questUpdateRefusal(doc, [[['helpers', 'b'], 'x'], [['doneAt'], 'y']], 'b')).toBeNull();
    const r = applyBatch(new Map([[`quests/${DAY}-rocher`, doc]]), [{ kind: 'update', collection: 'quests', id: `${DAY}-rocher`, fields: [[['helpers', 'a'], 'z']] }], { rules: true, author: 'b' });
    expect(r.ok).toBe(false);
  });
});
