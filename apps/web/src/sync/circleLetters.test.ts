/**
 * Cercle de la semaine écrit des deux téléphones (V5.2) : chaque part a son
 * document, rien ne s'écrase, l'ancien cercle à deux reste.
 */
import { describe, expect, it } from 'vitest';
import { circleForWeek, saveCirclePart, unreadLetter, type AppState } from '@a2/core';
import { SyncEngine } from './engine';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { NOW, at, resetTestIds, richState, testId } from './testFixtures';

type Role = 'a' | 'b';
const W = '2026-10-05';

function household() {
  resetTestIds();
  const server = new MemoryServer();
  const phone = (role: Role) => {
    const transport = new MemoryTransport(server, role);
    const engine = new SyncEngine(transport, { role, selectedMonth: '2026-10', now: () => NOW, newId: () => testId('e') });
    return {
      transport,
      get state(): AppState { return engine.state!; },
      act(fn: (s: AppState) => AppState) { engine.commit(fn(engine.state!)); },
    };
  };
  const a = phone('a');
  a.transport.write(migrationOps(richState(), { now: NOW, role: 'a' }));
  return { server, a, b: phone('b'), a2: phone('a') };
}

const write = (author: Role, when: Date, text: string) => (s: AppState): AppState => ({
  ...s,
  rituals: saveCirclePart(s.rituals, {
    author,
    weekStart: W,
    heldAt: when.toISOString(),
    gratitude: [{ from: author, to: author === 'a' ? 'b' : 'a', text }],
    burdens: [],
    intentions: [],
  }),
});

describe('cercle à deux téléphones', () => {
  it('hors ligne, AL et AC écrivent la même semaine : les deux parts et l’ancien cercle restent', () => {
    const h = household();
    for (const p of [h.a, h.b, h.a2]) p.transport.setOnline(false);
    h.a.act(write('a', at(9, 10), 'merci AC'));
    h.b.act(write('b', at(9, 10, 1), 'merci AL'));
    for (const p of [h.b, h.a, h.a2]) p.transport.setOnline(true);
    expect(h.server.rejected).toEqual([]);
    expect(h.a.state.rituals).toEqual(h.b.state.rituals);
    expect(h.a2.state.rituals).toEqual(h.b.state.rituals);
    const records = h.b.state.rituals!.circles.filter((c) => c.weekStart === W);
    expect(records.map((c) => c.author ?? 'deux')).toEqual(['deux', 'a', 'b']);
    const merged = circleForWeek(h.b.state.rituals, W)!;
    expect(merged.gratitude.map((g) => g.text)).toEqual(['merci AC', 'merci AL']);
    // La part d'AC remplace, pour AC seulement, ses mots de l'ancien cercle (gardé tel quel).
    expect(merged.burdens).toEqual([]);
    expect(records[0]!.burdens.map((b) => b.text)).toEqual(['Le linge']);
    expect(merged.intentions).toEqual(['Plier ensemble']);
  });

  it('deux appareils du même rôle : le dernier écrit gagne, sans refus des règles', () => {
    const h = household();
    h.a.act(write('a', at(9, 10), 'premier'));
    h.a.transport.setOnline(false);
    h.a2.transport.setOnline(false);
    h.a.act(write('a', at(9, 11), 'téléphone'));
    h.a2.act(write('a', at(9, 12), 'tablette'));
    h.a.transport.setOnline(true);
    h.a2.transport.setOnline(true);
    expect(h.server.rejected).toEqual([]);
    expect(h.a.state.rituals).toEqual(h.a2.state.rituals);
    expect(h.b.state.rituals).toEqual(h.a.state.rituals);
    const mine = h.b.state.rituals!.circles.filter((c) => c.author === 'a');
    expect(mine).toHaveLength(1);
    expect(unreadLetter(h.b.state.rituals, 'b', null, at(9, 20))?.author).toBe('a');
  });
});
