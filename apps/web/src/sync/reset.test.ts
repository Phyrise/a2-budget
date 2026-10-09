import { describe, expect, it } from 'vitest';
import type { AppState } from '@a2/core';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { RESET_BATCH, aboveFloor, chunks, freshCacheAfterReset, resetInfoOf, resetPending, resetSignal, RESET_WAIT_MS } from './reset';
import { parseSyncCache, serializeSyncCache } from './syncCache';
import { SyncCore } from './syncCore';
import { SyncLink } from './syncLink';
import { NOW, addGrocery, resetTestIds, richState, testId } from './testFixtures';

describe('signal de remise à zéro', () => {
  it('un compteur qui bouge est le signal ; sans compteur connu, on adopte', () => {
    expect(resetSignal(null, { reset: 3, letters: 1 })).toBeNull();
    expect(resetSignal({}, { reset: 3, letters: 1 })).toBeNull();
    expect(resetSignal({ reset: 3, letters: 1 }, { reset: 3, letters: 1 })).toBeNull();
    expect(resetSignal({ reset: 3, letters: 1 }, { reset: 4, letters: 1 })).toEqual({ kind: 'all', epochs: { reset: 4, letters: 1 } });
    expect(resetSignal({ reset: 3, letters: 1 }, { reset: 3, letters: 2 })).toEqual({ kind: 'letters', epochs: { reset: 3, letters: 2 } });
    // Tout l'emporte sur les lettres.
    expect(resetSignal({ reset: 3, letters: 1 }, { reset: 4, letters: 2 })?.kind).toBe('all');
  });

  it('foyer lu : compteurs entiers, absent = 0 ; vidage attendu au plus 3 minutes', () => {
    const info = resetInfoOf({ resetEpoch: 2, lettersEpoch: 'x', resetting: true }, 1_000);
    expect(info).toEqual({ reset: 2, letters: 0, resetAt: 1_000, resetting: true });
    expect(resetInfoOf(undefined)).toEqual({ reset: 0, letters: 0, resetAt: 0, resetting: false });
    expect(resetPending(info, 1_000 + RESET_WAIT_MS - 1)).toBe(true);
    expect(resetPending(info, 1_000 + RESET_WAIT_MS)).toBe(false);
    expect(resetPending({ ...info, resetting: false }, 1_000)).toBe(false);
  });

  it('plancher : rien d’avant la remise à zéro, sauf une écriture en attente', () => {
    expect(aboveFloor(500, false, 0)).toBe(true);
    expect(aboveFloor(500, false, 1_000)).toBe(false);
    expect(aboveFloor(1_000, false, 1_000)).toBe(true);
    expect(aboveFloor(500, true, 1_000)).toBe(true);
    expect(aboveFloor(undefined, false, 1_000)).toBe(true);
  });

  it('copie vide : relue telle quelle, jamais relue du serveur, compteurs gardés', () => {
    const fresh = freshCacheAfterReset('b', { reset: 4, letters: 2 });
    const back = parseSyncCache(serializeSyncCache(fresh));
    expect(back).toMatchObject({ role: 'b', syncedAt: null, cursors: {}, resetEpoch: 4, lettersEpoch: 2 });
    expect(back?.state.chores.tasks).toEqual([]);
    // Une copie d'avant (sans compteurs) reste lisible.
    const { resetEpoch: _r, lettersEpoch: _l, ...old } = fresh;
    expect(parseSyncCache(JSON.stringify(old))?.resetEpoch).toBeUndefined();
  });

  it('suppressions par lots de 400', () => {
    const ids = Array.from({ length: 901 }, (_, i) => i);
    expect(chunks(ids).map((c) => c.length)).toEqual([RESET_BATCH, RESET_BATCH, 101]);
    expect(chunks([])).toEqual([]);
  });
});

describe('remise à zéro sans écriture d’avant', () => {
  it('le téléphone de l’autre repart de la copie vide : rien de son ancien état ne revient au serveur', () => {
    resetTestIds();
    const initial = richState();
    const server = new MemoryServer();
    new MemoryTransport(server, 'a').write(migrationOps(initial, { now: NOW, role: 'a' }));
    const opts = { role: 'b' as const, selectedMonth: '2026-10', now: () => NOW, newId: () => testId('e') };

    // AC est branché sur le foyer rempli.
    const oldCore = new SyncCore(new MemoryTransport(server, 'b'), opts);
    const oldLink = new SyncLink('b', oldCore.state!);
    oldLink.attach(oldCore);
    expect(oldCore.state!.chores.tasks.length).toBeGreaterThan(0);

    // AL remet à zéro : le serveur est vidé ; AC voit le signal et fait comme SyncContext.
    server.wipe();
    oldLink.detach();
    oldCore.dispose();
    const fresh = freshCacheAfterReset('b', { reset: 1, letters: 0 });
    const link = new SyncLink('b', fresh.state);
    // Le store remonté prépare la copie vide (premier jour) ; l'ancien lien, débranché, n'envoie rien.
    const prepared: AppState = { ...fresh.state, budget: { ...fresh.state.budget, selectedMonth: '2026-10' } };
    link.commit(fresh.state, prepared);
    const commits = server.commits;
    oldLink.commit(oldCore.state!, addGrocery(oldCore.state!, 'Vieux riz', NOW, 'b'));
    expect(server.commits).toBe(commits);

    // Tout relu (foyer vide) puis branché : seul ce qui est neuf part.
    const core = new SyncCore(new MemoryTransport(server, 'b'), opts);
    link.attach(core);
    const after = addGrocery(prepared, 'Riz', NOW, 'b');
    link.commit(prepared, after);
    const keys = [...server.snapshot.keys()];
    expect(keys.some((k) => k.startsWith('tasks/'))).toBe(false);
    expect(keys.some((k) => k.startsWith('completions/'))).toBe(false);
    expect(keys.filter((k) => k.startsWith('groceries/'))).toHaveLength(1);
    expect(core.state!.groceries.items.map((g) => g.label)).toEqual(['Riz']);
    expect(core.state!.chores.tasks).toEqual([]);
  });
});
