import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_KEY, parseEntry, readEntry, writeEntry } from './accountChoice';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('choix de l’accueil', () => {
  it('lecture prudente : seul un choix connu compte', () => {
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry('{"entry":"guest"}')).toBe('guest');
    expect(parseEntry('{"entry":"google"}')).toBe('google');
    expect(parseEntry('{"entry":"admin"}')).toBeNull();
    expect(parseEntry('null')).toBeNull();
    expect(parseEntry('{oups')).toBeNull();
  });

  it('mémorisé sous sa propre clé, sans toucher aux données ni aux préférences', () => {
    const storage = fakeStorage({ 'a2-budget:state:v1': '{"x":1}', 'a2-budget:ui:v1': '{"module":"budget"}' });
    vi.stubGlobal('window', { localStorage: storage });
    expect(readEntry()).toBeNull();
    writeEntry('guest');
    expect(storage.data.get(ACCOUNT_KEY)).toBe('{"entry":"guest"}');
    expect(readEntry()).toBe('guest');
    writeEntry(null);
    expect(storage.data.has(ACCOUNT_KEY)).toBe(false);
    expect(storage.data.get('a2-budget:state:v1')).toBe('{"x":1}');
    expect(storage.data.get('a2-budget:ui:v1')).toBe('{"module":"budget"}');
  });

  it('stockage bloqué : ni erreur ni choix (l’accueil revient)', () => {
    const blocked = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
      removeItem: () => {
        throw new Error('bloqué');
      },
    };
    vi.stubGlobal('window', { localStorage: blocked });
    expect(readEntry()).toBeNull();
    expect(() => writeEntry('google')).not.toThrow();
  });
});
