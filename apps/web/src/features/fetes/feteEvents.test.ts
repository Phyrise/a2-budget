import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimPartyDay } from './feteEvents';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('fêtes — une fois par jour (préférence locale)', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la fête d’anniversaire ne se rejoue pas le même jour', () => {
    expect(claimPartyDay('2026-08-19')).toBe(true);
    expect(claimPartyDay('2026-08-19')).toBe(false);
    expect(claimPartyDay('2027-08-19')).toBe(true);
  });

  it('une ancienne marque du train (retiré) est ignorée', () => {
    storage.data.set('a2-budget:fetes:v1', JSON.stringify({ trainSeen: '2026-12' }));
    claimPartyDay('2026-12-27');
    expect(JSON.parse(storage.data.get('a2-budget:fetes:v1')!)).toEqual({ partySeen: '2026-12-27' });
  });

  it('stockage bloqué ou illisible : pas d’exception', () => {
    storage.data.set('a2-budget:fetes:v1', '{oops');
    expect(claimPartyDay('2026-10-01')).toBe(true);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('bloqué');
        },
        setItem: () => {
          throw new Error('bloqué');
        },
      },
    });
    expect(claimPartyDay('2026-08-19')).toBe(true);
  });
});
