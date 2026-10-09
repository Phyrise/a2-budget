import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMPANIONS_KEY,
  attachCompanionWriter,
  companionChoices,
  hasPendingCompanion,
  pickOwnCompanion,
  receiveCompanion,
  receiveOwnCompanion,
  resetCompanionChoicesForTests,
  subscribeCompanionChoices,
} from './companionChoices';

/** Faux localStorage (environnement node). */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
  };
  return map;
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('compagnons des comptes (V5.7)', () => {
  beforeEach(() => {
    fakeStorage();
    resetCompanionChoicesForTests();
  });

  it('les fiches lues remplissent les choix ; inconnu ou absent : rien ne change', () => {
    let calls = 0;
    subscribeCompanionChoices(() => (calls += 1));
    receiveCompanion('b', 'hin');
    receiveCompanion('a', undefined);
    receiveCompanion('a', 'ponyo');
    expect(companionChoices()).toEqual({ b: 'hin' });
    const same = companionChoices();
    receiveCompanion('b', 'hin');
    expect(companionChoices()).toBe(same);
    expect(calls).toBe(1);
  });

  it('choix avant l’ouverture du canal : affiché tout de suite, envoyé à l’ouverture', () => {
    pickOwnCompanion('a', 'teto');
    expect(companionChoices().a).toBe('teto');
    expect(hasPendingCompanion('a')).toBe(true);
    // Une lecture plus ancienne de ma fiche ne l'écrase pas.
    receiveCompanion('a', 'jiji');
    expect(companionChoices().a).toBe('teto');

    const sent: string[] = [];
    const stop = attachCompanionWriter('a', (id) => sent.push(id));
    expect(sent).toEqual(['teto']);
    expect(hasPendingCompanion('a')).toBe(false);

    // Canal ouvert : chaque choix part aussitôt.
    pickOwnCompanion('a', 'hin');
    expect(sent).toEqual(['teto', 'hin']);
    // Lecture de ma fiche commencée juste avant : périmée, ignorée.
    receiveOwnCompanion('a', 'teto', Date.now() - 1_000);
    expect(companionChoices().a).toBe('hin');
    stop();
    pickOwnCompanion('a', 'calcifer');
    expect(sent).toEqual(['teto', 'hin']);
    expect(hasPendingCompanion('a')).toBe(true);
  });

  it('copie locale : les choix (et l’envoi en attente) survivent au rechargement', () => {
    const storage = fakeStorage();
    resetCompanionChoicesForTests();
    receiveCompanion('b', 'jiji');
    pickOwnCompanion('a', 'hin');
    expect(JSON.parse(storage.get(COMPANIONS_KEY)!)).toEqual({ choices: { a: 'hin', b: 'jiji' }, pending: { role: 'a', companion: 'hin' } });

    resetCompanionChoicesForTests(); // « rechargement » : relu du stockage
    expect(companionChoices()).toEqual({ a: 'hin', b: 'jiji' });
    const sent: string[] = [];
    attachCompanionWriter('a', (id) => sent.push(id));
    expect(sent).toEqual(['hin']);
  });

  it('copie locale illisible ou absente : aucun choix', () => {
    fakeStorage({ [COMPANIONS_KEY]: '{oups' });
    resetCompanionChoicesForTests();
    expect(companionChoices()).toEqual({});
    fakeStorage({ [COMPANIONS_KEY]: JSON.stringify({ choices: { a: 'ponyo', b: 'teto' }, pending: { role: 'c', companion: 'hin' } }) });
    resetCompanionChoicesForTests();
    expect(companionChoices()).toEqual({ b: 'teto' });
    expect(hasPendingCompanion('a')).toBe(false);
  });
});
