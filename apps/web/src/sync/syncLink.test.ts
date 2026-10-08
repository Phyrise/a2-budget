import { describe, expect, it } from 'vitest';
import { updateTask, type AppState } from '@a2/core';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { SyncCore } from './syncCore';
import { SyncLink } from './syncLink';
import { NOW, addGrocery, at, resetTestIds, richState, testId, toggle } from './testFixtures';

function household() {
  resetTestIds();
  const initial = richState();
  const server = new MemoryServer();
  const core = (role: 'a' | 'b') =>
    new SyncCore(new MemoryTransport(server, role), { role, selectedMonth: '2026-10', now: () => NOW, newId: () => testId('e') });
  new MemoryTransport(server, 'a').write(migrationOps(initial, { now: NOW, role: 'a' }));
  return { server, initial, core };
}

const rename = (title: string) => (s: AppState): AppState =>
  ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'plantes', { title }) } });

describe('lien store ↔ synchronisation', () => {
  it('les gestes faits avant que la synchro soit prête partent en une fois au branchement', () => {
    resetTestIds();
    const initial = richState();
    const server = new MemoryServer();
    const transport = new MemoryTransport(server, 'a');
    transport.write(migrationOps(initial, { now: NOW, role: 'a' }));
    const commits = server.commits;

    const link = new SyncLink('a', initial);
    const seen: AppState[] = [];
    link.listen((s) => seen.push(s));
    const s1 = rename('Plantes')(initial);
    link.commit(initial, s1);
    const s2 = addGrocery(s1, 'Riz', NOW, 'a');
    link.commit(s1, s2);
    expect(server.commits).toBe(commits); // rien n'est parti

    const core = new SyncCore(transport, { role: 'a', selectedMonth: '2026-10', now: () => NOW, newId: () => testId('e') });
    link.attach(core);
    expect(server.commits).toBe(commits + 1); // une seule transition : initial → s2
    expect(seen.at(-1)?.chores.tasks.find((t) => t.id === 'plantes')?.title).toBe('Plantes');
    expect(seen.at(-1)?.groceries.items.some((g) => g.label === 'Riz')).toBe(true);
  });

  it('les gestes de l’autre arrivent au store ; un store qui écoute après coup reçoit le dernier état', () => {
    const h = household();
    const al = h.core('a');
    const ac = h.core('b');
    const link = new SyncLink('a', al.state!);
    link.attach(al);
    ac.commit(ac.state!, rename('Arroser le ficus')(ac.state!));
    const seen: AppState[] = [];
    link.listen((s) => seen.push(s));
    expect(seen.at(-1)?.chores.tasks.find((t) => t.id === 'plantes')?.title).toBe('Arroser le ficus');
  });

  it('décocher : seulement ses propres gestes', () => {
    const h = household();
    const al = h.core('a');
    const ac = h.core('b');
    ac.commit(ac.state!, toggle(ac.state!, 'vaisselle', at(9, 9), 'b'));
    const link = new SyncLink('a', al.state!);
    expect(link.canUndo('completions', 'vaisselle', '2026-10-09')).toBe(true); // pas encore branché : rien ne bloque
    link.attach(al);
    expect(link.canUndo('completions', 'vaisselle', '2026-10-09')).toBe(false); // fait par AC
    expect(new SyncLink('b', ac.state!).canUndo('completions', 'vaisselle', '2026-10-09')).toBe(true);
    expect(link.canUndo('completions', 'plantes', '2026-10-09')).toBe(true); // rien de fait
    expect(link.canUndo('completions', 'vaisselle', '2026-10-08')).toBe(true); // fait par AL (migration)
  });
});
