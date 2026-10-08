import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyAppState } from '@a2/core';
import { BACKUP_BEFORE_SWITCH_KEY, BACKUP_PRE_SYNC_KEY, backupBeforeSync, keepSharedCopyLocally, readLocalState } from '../state/localCopies';
import { STORAGE_KEY } from '../state/storage';
import { syncMode, syncRole } from './syncMode';

function fakeStorage(initial: Record<string, string> = {}, opts: { full?: boolean } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.full === true) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mode de l’app', () => {
  const copy = { role: 'a' as const };

  it('sans configuration ou en invité : local, même avec une copie commune', () => {
    expect(syncMode({ enabled: false, entry: 'google' }, copy)).toBe('local');
    expect(syncMode({ enabled: true, entry: 'guest' }, copy)).toBe('local');
    expect(syncMode({ enabled: true, entry: null }, null)).toBe('local');
  });

  it('connecté : écran de choix tant que ce téléphone n’a pas rejoint, puis la copie commune', () => {
    expect(syncMode({ enabled: true, entry: 'google' }, null)).toBe('setup');
    expect(syncMode({ enabled: true, entry: 'google' }, copy)).toBe('sync');
  });

  it('le rôle du compte connecté l’emporte sur celui de la copie', () => {
    expect(syncRole(copy, null)).toBe('a');
    expect(syncRole(copy, { role: 'b' })).toBe('b');
  });
});

describe('données locales : jamais perdues', () => {
  const local = JSON.stringify({ ...emptyAppState(), budget: { ...emptyAppState().budget, selectedMonth: '2026-10' } });

  it('copie de sécurité avant la première synchronisation, une seule fois', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: local });
    vi.stubGlobal('window', { localStorage: storage });
    backupBeforeSync();
    expect(storage.data.get(BACKUP_PRE_SYNC_KEY)).toBe(local);
    storage.data.set(STORAGE_KEY, '{"plus":"tard"}');
    backupBeforeSync();
    expect(storage.data.get(BACKUP_PRE_SYNC_KEY)).toBe(local);
    expect(readLocalState()).toBeNull(); // illisible : rien n'est envoyé
  });

  it('garder la copie commune : les données d’avant sont mises de côté d’abord', () => {
    const shared = { ...emptyAppState(), budget: { ...emptyAppState().budget, selectedMonth: '2026-11' } };
    const storage = fakeStorage({ [STORAGE_KEY]: local, [BACKUP_PRE_SYNC_KEY]: local });
    vi.stubGlobal('window', { localStorage: storage });
    expect(keepSharedCopyLocally(shared)).toBe(true);
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).toEqual(shared);
    expect(storage.data.has(BACKUP_BEFORE_SWITCH_KEY)).toBe(false); // déjà dans la copie d'avant la synchro

    const edited = '{"modifié":"en invité"}';
    storage.data.set(STORAGE_KEY, edited);
    expect(keepSharedCopyLocally(shared)).toBe(true);
    expect(storage.data.get(BACKUP_BEFORE_SWITCH_KEY)).toBe(edited);
  });

  it('stockage plein : rien ne change', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: local }, { full: true });
    vi.stubGlobal('window', { localStorage: storage });
    expect(keepSharedCopyLocally(emptyAppState())).toBe(false);
    expect(storage.data.get(STORAGE_KEY)).toBe(local);
  });
});
