import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, readPrefs } from './prefs';

const KEY = 'a2-budget:ui:v1';

function withStored(raw: string | null) {
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === KEY ? raw : null) } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readPrefs — forestFps30', () => {
  it('absent ou stockage vide : false', () => {
    expect(DEFAULT_PREFS.forestFps30).toBe(false);
    withStored(null);
    expect(readPrefs().forestFps30).toBe(false);
    withStored(JSON.stringify({ forestMotion: 'full' }));
    expect(readPrefs().forestFps30).toBe(false);
  });

  it('valeur invalide ou JSON cassé : false', () => {
    for (const v of ['true', 1, 'oui', null, {}]) {
      withStored(JSON.stringify({ forestFps30: v }));
      expect(readPrefs().forestFps30).toBe(false);
    }
    withStored('{pas du json');
    expect(readPrefs().forestFps30).toBe(false);
  });

  it('true enregistré : true', () => {
    withStored(JSON.stringify({ forestFps30: true }));
    expect(readPrefs().forestFps30).toBe(true);
  });

  it('stockage bloqué : valeurs par défaut', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
      },
    });
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
  });
});
