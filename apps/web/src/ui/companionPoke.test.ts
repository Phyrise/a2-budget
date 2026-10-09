import { describe, expect, it } from 'vitest';
import { BURST, IDLE_POKE, POKE_MS, UPSET_MS, pokeMood, pokeSettle, pokeStep, type PokeState } from './companionPoke';

const taps = (times: number[], from: PokeState = IDLE_POKE) => times.reduce((s, t) => pokeStep(s, t), from);

describe('toucher un compagnon', () => {
  it('un toucher : une petite réaction, qui se termine', () => {
    const s = pokeStep(IDLE_POKE, 1000);
    expect(s.kind).toBe('poke');
    expect(s.n).toBe(1);
    expect(pokeSettle(s, 1000 + POKE_MS - 1).kind).toBe('poke');
    expect(pokeSettle(s, 1000 + POKE_MS).kind).toBeNull();
  });

  it('anti-rafale : un toucher pendant la réaction ne la relance pas', () => {
    const s = taps([1000, 1200]);
    expect(s.kind).toBe('poke');
    expect(s.n).toBe(1);
    expect(s.until).toBe(1000 + POKE_MS);
  });

  it(`≥ ${BURST.taps} touchers en ${BURST.windowMs / 1000} s : il s'agace, puis plus rien jusqu'au calme`, () => {
    const s = taps([1000, 1300, 1600, 1900]);
    expect(s.kind).toBe('upset');
    expect(s.until).toBe(1900 + UPSET_MS);
    // Pendant la colère, les touchers sont sans effet.
    expect(pokeStep(s, 2500)).toBe(s);
    const calm = pokeSettle(s, 1900 + UPSET_MS);
    expect(calm.kind).toBeNull();
    // Après, on repart de zéro : un toucher = une petite réaction.
    expect(pokeStep(calm, 1900 + UPSET_MS + 10).kind).toBe('poke');
  });

  it('des touchers espacés ne l’agacent jamais', () => {
    let s = IDLE_POKE;
    for (let t = 0; t < 20000; t += 900) s = pokeSettle(pokeStep(s, t), t + 800);
    expect(s.kind).not.toBe('upset');
    expect(s.n).toBe(Math.ceil(20000 / 900));
  });

  it('les poses peintes des réactions (planches v3 / v2)', () => {
    expect(pokeMood('calcifer', 'poke')).toBe('happy');
    expect(pokeMood('calcifer', 'upset')).toBe('proud');
    expect(pokeMood('jiji', 'poke')).toBe('curious');
    expect(pokeMood('jiji', 'upset')).toBe('idle');
    expect(pokeMood('jiji', null)).toBeNull();
    // Teto : curieux, puis se renfrogne ; Hin : content, puis s'effondre, blasé.
    expect(pokeMood('teto', 'poke')).toBe('curious');
    expect(pokeMood('teto', 'upset')).toBe('idle');
    expect(pokeMood('hin', 'poke')).toBe('happy');
    expect(pokeMood('hin', 'upset')).toBe('sleepy');
  });
});
