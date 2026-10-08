import { afterEach, describe, expect, it } from 'vitest';
import { START_STATE, applyGesture, parsePlay, type PlayGesture, type PlayState } from './play';
import { getPlay, playCatch, playGive, playSpend, resetPlayForTests, setPlayBackend, type PlayBackend } from './store';

/** Backend de test : garde les gestes reçus. */
function memory(initial: PlayState | null = null): PlayBackend & { log: PlayGesture[]; push?: (s: PlayState) => void } {
  const log: PlayGesture[] = [];
  const b: PlayBackend & { log: PlayGesture[]; push?: (s: PlayState) => void } = {
    log,
    load: () => initial,
    record: (g) => {
      log.push(g);
    },
    subscribe: (on) => {
      b.push = on;
      return () => {
        b.push = undefined;
      };
    },
  };
  return b;
}

afterEach(() => resetPlayForTests());

describe('bocal de kompeitō (pur)', () => {
  it('20 au départ, +1 par geste, +5 pour la dorée', () => {
    expect(START_STATE.jar).toBe(20);
    let s = applyGesture(START_STATE, { kind: 'give', n: 1, cause: 'virement' });
    expect(s.jar).toBe(21);
    s = applyGesture(s, { kind: 'catch', golden: false });
    expect(s).toEqual({ jar: 22, caught: 1, golden: 0 });
    s = applyGesture(s, { kind: 'catch', golden: true });
    expect(s).toEqual({ jar: 27, caught: 2, golden: 1 });
  });

  it('une dépense coûte 1, jamais sous zéro', () => {
    const empty = { ...START_STATE, jar: 0 };
    expect(applyGesture(empty, { kind: 'spend', n: 1 })).toBe(empty);
    expect(applyGesture(START_STATE, { kind: 'spend', n: 1 }).jar).toBe(19);
  });

  it('relit un état stocké, refuse le reste', () => {
    expect(parsePlay({ v: 1, jar: 4, caught: 2, golden: 1 })).toEqual({ jar: 4, caught: 2, golden: 1 });
    expect(parsePlay({ jar: 3 })).toEqual({ jar: 3, caught: 0, golden: 0 });
    expect(parsePlay({ jar: -1 })).toBeNull();
    expect(parsePlay('x')).toBeNull();
    expect(parsePlay(null)).toBeNull();
  });
});

describe('magasin derrière son interface', () => {
  it('ne confie au backend que les gestes faits ici, en deltas', () => {
    const b = memory();
    setPlayBackend(b);
    expect(getPlay().jar).toBe(20);
    playGive(1, 'soin');
    playCatch(false);
    expect(playSpend()).toBe(true);
    expect(getPlay()).toEqual({ jar: 21, caught: 1, golden: 0 });
    expect(b.log.map((g) => g.kind)).toEqual(['give', 'catch', 'spend']);
  });

  it('un état reçu d’ailleurs remplace l’affichage sans être renvoyé', () => {
    const b = memory({ jar: 2, caught: 0, golden: 0 });
    setPlayBackend(b);
    b.push?.({ jar: 9, caught: 3, golden: 0 });
    expect(getPlay().jar).toBe(9);
    expect(b.log).toEqual([]);
  });

  it('bocal vide : pas de dépense', () => {
    setPlayBackend(memory({ jar: 0, caught: 0, golden: 0 }));
    expect(playSpend()).toBe(false);
    expect(getPlay().jar).toBe(0);
  });
});
