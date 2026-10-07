import { describe, expect, it } from 'vitest';
import { emptyMilestones } from '@a2/core';
import { applyBatch, applyOptimistic, setField } from './apply';
import { DELETE_FIELD, isDeleteField, type DocData, type WriteOp } from './docs';
import { SyncEngine } from './engine';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { parseSyncCache, serializeSyncCache, SYNC_STORAGE_KEY } from './syncCache';
import { NOW, richState } from './testFixtures';

const docs = (entries: Record<string, DocData>) => new Map(Object.entries(entries));
const ok = (r: ReturnType<typeof applyBatch>) => {
  if (!r.ok) throw new Error(r.reason);
  return r.docs;
};

describe('application d’un lot (sémantique Firestore)', () => {
  it('champs imbriqués écrits ou supprimés sans toucher aux voisins ; clés avec points', () => {
    const base: DocData = { memory: { 'lait.demi': { category: 'frais', order: 0 } }, a: 1 };
    expect(setField(base, ['memory', 'café', 'category'], 'epicerie')).toEqual({
      memory: { 'lait.demi': { category: 'frais', order: 0 }, café: { category: 'epicerie' } }, a: 1,
    });
    expect(setField(base, ['memory', 'lait.demi'], DELETE_FIELD)).toEqual({ memory: {}, a: 1 });
    expect(setField(base, ['absent', 'x'], DELETE_FIELD)).toBe(base);
    expect(setField({ a: 3 }, ['a', 'b'], 1)).toEqual({ a: { b: 1 } });
    expect(isDeleteField(DELETE_FIELD)).toBe(true);
    expect(isDeleteField({ $delete: true, autre: 1 })).toBe(false);
  });

  it('create = créer si absent ; set remplace ; update exige le document ; merge le crée', () => {
    const start = docs({ 'tasks/t': { title: 'A', effort: 1 } });
    const after = ok(applyBatch(start, [
      { kind: 'create', collection: 'tasks', id: 't', data: { title: 'écrasé ?' } },
      { kind: 'update', collection: 'tasks', id: 't', fields: [[['effort'], 3]] },
      { kind: 'merge', collection: 'settings', id: 'focus', fields: [[['selectedLantern'], 'oribe']] },
    ]));
    expect(after.get('tasks/t')).toEqual({ title: 'A', effort: 3 });
    expect(after.get('settings/focus')).toEqual({ selectedLantern: 'oribe' });
    const missing = applyBatch(start, [
      { kind: 'update', collection: 'tasks', id: 'zz', fields: [[['title'], 'x']] },
    ]);
    expect(missing).toEqual({ ok: false, reason: 'tasks/zz: not-found' });
  });

  it('règles : un fait ne change que par son annulation ; un refus annule tout le lot', () => {
    const start = docs({ 'completions/c': { taskId: 't', localDay: '2026-10-08' } });
    const tamper: WriteOp[] = [
      { kind: 'update', collection: 'tasks', id: 'x', fields: [] },
    ];
    expect(applyBatch(start, tamper, { rules: true }).ok).toBe(false);
    const rewrite: WriteOp[] = [
      { kind: 'create', collection: 'groceries', id: 'g', data: { label: 'Lait' } },
      { kind: 'update', collection: 'completions', id: 'c', fields: [[['localDay'], '2026-10-01']] },
    ];
    expect(applyBatch(start, rewrite, { rules: true })).toEqual({ ok: false, reason: 'completions/c: fact-immutable' });
    expect(applyBatch(start, [{ kind: 'set', collection: 'completions', id: 'c', data: {} }], { rules: true }).ok).toBe(false);
    const undone = ok(applyBatch(start, [
      { kind: 'update', collection: 'completions', id: 'c', fields: [[['undoneAt'], 'x'], [['undoneBy'], 'b']] },
    ], { rules: true, stamp: { syncedAt: 7, updatedBy: 'b' } }));
    expect(undone.get('completions/c')).toEqual({ taskId: 't', localDay: '2026-10-08', undoneAt: 'x', undoneBy: 'b', syncedAt: 7, updatedBy: 'b' });
  });

  it('jalons : jamais en baisse, quel que soit l’ordre des écritures', () => {
    const high = { ...emptyMilestones(), growthStage: 3, lifetimeCare: 30 };
    const low = { ...emptyMilestones(), growthStage: 2, lifetimeCare: 12, longestStreak: 5 };
    const raise = (data: DocData): WriteOp => ({ kind: 'raise', collection: 'meta', id: 'forestMilestones', data });
    const one = ok(applyBatch(new Map(), [raise(high), raise(low)]));
    const two = ok(applyBatch(new Map(), [raise(low), raise(high)]));
    expect(one.get('meta/forestMilestones')).toEqual(two.get('meta/forestMilestones'));
    expect(one.get('meta/forestMilestones')).toMatchObject({ growthStage: 3, lifetimeCare: 30, longestStreak: 5 });
    expect(applyBatch(new Map(), [raise({ growthStage: 0 })]).ok).toBe(false);
  });

  it('vue optimiste : un lot impossible est ignoré, les autres appliqués', () => {
    const view = applyOptimistic(new Map(), [
      [{ kind: 'update', collection: 'tasks', id: 'absent', fields: [[['title'], 'x']] }],
      [{ kind: 'create', collection: 'tasks', id: 't', data: { title: 'ok' } }],
    ]);
    expect([...view.keys()]).toEqual(['tasks/t']);
  });
});

describe('transport en mémoire et pont', () => {
  it('un lot refusé par le serveur disparaît de la vue ; le téléphone revient à l’état du serveur', () => {
    const server = new MemoryServer();
    const t = new MemoryTransport(server, 'a', { online: false });
    t.write([{ kind: 'update', collection: 'tasks', id: 'fantome', fields: [[['title'], 'x']] }]);
    t.write([{ kind: 'create', collection: 'tasks', id: 't', data: { title: 'ok' } }]);
    expect(t.pendingBatches).toBe(2);
    t.setOnline(true);
    expect(t.pendingBatches).toBe(0);
    expect(server.rejected).toEqual(['tasks/fantome: not-found']);
    expect([...server.snapshot.keys()]).toEqual(['tasks/t']);
    expect(server.snapshot.get('tasks/t')).toMatchObject({ title: 'ok', syncedAt: 1, updatedBy: 'a' });
  });

  it('un document invalide reçu n’est jamais propagé : il est ignoré et signalé', () => {
    const server = new MemoryServer();
    const t = new MemoryTransport(server, 'a');
    const engine = new SyncEngine(t, { role: 'a', selectedMonth: '2026-10', now: () => NOW });
    expect(engine.state).toBeNull();
    const initial = richState();
    t.write(migrationOps(initial, { now: NOW, role: 'a' }));
    expect(engine.state).toEqual(initial);
    server.commit([{ kind: 'create', collection: 'events', id: 'cassé', data: { id: 'cassé', title: '', order: 9 } }], 'b');
    expect(engine.state).toEqual(initial);
    expect(engine.issues).toEqual(['events/cassé: calendar-event-invalid-title']);
  });

  it('copie locale du mode synchronisé : clé distincte, relue à l’identique, illisible → null', () => {
    expect(SYNC_STORAGE_KEY).toBe('a2-budget:sync:v1');
    expect(SYNC_STORAGE_KEY).not.toBe('a2-budget:state:v1');
    const cache = { version: 1 as const, householdId: 'a2home', role: 'b' as const, state: richState(), cursor: 42 };
    expect(parseSyncCache(serializeSyncCache(cache))).toEqual(cache);
    expect(parseSyncCache(null)).toBeNull();
    expect(parseSyncCache('{oups')).toBeNull();
    expect(parseSyncCache(JSON.stringify({ ...cache, role: 'c' }))).toBeNull();
    expect(parseSyncCache(JSON.stringify({ ...cache, state: { schemaVersion: 9 } }))).toBeNull();
  });
});
