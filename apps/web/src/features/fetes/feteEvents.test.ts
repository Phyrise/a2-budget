import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimPartyDay, claimTrainMonth } from './feteEvents';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('fêtes — une fois par jour, train une fois par mois (préférence locale)', () => {
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

  it('le train passe à la première ouverture du mois, pas deux fois', () => {
    expect(claimTrainMonth('2026-10')).toBe(true);
    expect(claimTrainMonth('2026-10')).toBe(false);
    expect(claimTrainMonth('2026-11')).toBe(true);
  });

  it('fête et train gardent chacun leur marque sous la même clé', () => {
    claimPartyDay('2026-12-27');
    claimTrainMonth('2026-12');
    expect(JSON.parse(storage.data.get('a2-budget:fetes:v1')!)).toEqual({ partySeen: '2026-12-27', trainSeen: '2026-12' });
  });

  it('stockage bloqué ou illisible : pas d’exception', () => {
    storage.data.set('a2-budget:fetes:v1', '{oops');
    expect(claimTrainMonth('2026-10')).toBe(true);
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
