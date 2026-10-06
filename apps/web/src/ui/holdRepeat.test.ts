import { describe, expect, it } from 'vitest';
import { holdDelay, holdStep, nextEuros, snapEuros } from './holdRepeat';

describe('appui long des boutons − / + (euros entiers)', () => {
  it('commence à 1 €, puis 10 €, puis 50 €', () => {
    expect(holdStep(0)).toBe(1);
    expect(holdStep(13)).toBe(1);
    expect(holdStep(14)).toBe(10);
    expect(holdStep(33)).toBe(10);
    expect(holdStep(34)).toBe(50);
  });

  it('accélère sans descendre sous 45 ms', () => {
    expect(holdDelay(0)).toBe(150);
    expect(holdDelay(5)).toBeLessThan(holdDelay(1));
    expect(holdDelay(100)).toBe(45);
  });

  it('un pas de 1 € part de la valeur ; un grand pas se cale sur ses multiples', () => {
    expect(nextEuros(2203, 1, 1)).toBe(2204);
    expect(nextEuros(2203, -1, 1)).toBe(2202);
    expect(nextEuros(2203, 1, 10)).toBe(2210);
    expect(nextEuros(2210, 1, 10)).toBe(2220);
    expect(nextEuros(2203, -1, 10)).toBe(2200);
    expect(nextEuros(2200, -1, 10)).toBe(2190);
    expect(nextEuros(2230, 1, 50)).toBe(2250);
    expect(nextEuros(2230, -1, 50)).toBe(2200);
  });
});

describe('piste du curseur : crans au pointeur seulement', () => {
  it('un geste de lecteur d’écran (input sans pointeur) à v + 1 donne v + 1', () => {
    expect(snapEuros(2201, false, 10)).toBe(2201);
    expect(snapEuros(2204, false, 10)).toBe(2204);
    expect(snapEuros(2202, false, 10)).toBe(2202);
  });

  it('au pointeur, crans de 10 €', () => {
    expect(snapEuros(2204, true, 10)).toBe(2200);
    expect(snapEuros(2206, true, 10)).toBe(2210);
  });
});
