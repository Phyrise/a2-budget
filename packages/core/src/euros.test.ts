import { describe, expect, it } from 'vitest';
import {
  eurosToCents,
  formatEuros,
  parseEurosInput,
  roundEurosConsistent,
  roundToEuroCents,
  splitRounded,
} from './euros.js';
import { computeMonthSummary } from './calculations.js';
import { createMonthRecord, defaultSettings } from './state.js';

/** Remplace les espaces insécables par des espaces simples pour comparer. */
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('roundToEuroCents', () => {
  it('arrondit à l’euro, demi-euro vers le haut (symétrique)', () => {
    expect(roundToEuroCents(0)).toBe(0);
    expect(roundToEuroCents(49)).toBe(0);
    expect(roundToEuroCents(50)).toBe(100);
    expect(roundToEuroCents(88_049)).toBe(88_000);
    expect(roundToEuroCents(88_050)).toBe(88_100);
    expect(roundToEuroCents(-50)).toBe(-100);
    expect(roundToEuroCents(-149)).toBe(-100);
    expect(Object.is(roundToEuroCents(-40), 0)).toBe(true);
    expect(roundToEuroCents(-150)).toBe(-200);
  });
});

describe('formatEuros', () => {
  it('affiche des euros entiers fr-FR, sans centimes', () => {
    expect(plain(formatEuros(123_456))).toBe('1 235 €');
    expect(plain(formatEuros(220_000))).toBe('2 200 €');
    expect(plain(formatEuros(0))).toBe('0 €');
    expect(plain(formatEuros(49))).toBe('0 €');
    expect(plain(formatEuros(150))).toBe('2 €');
  });

  it('« € » est précédé d’une espace insécable ; jamais « −0 € »', () => {
    expect(formatEuros(1000)).toContain(' €');
    expect(formatEuros(-40)).not.toContain('-');
    expect(plain(formatEuros(-40))).toBe('0 €');
  });

  it('les négatifs gardent leur signe (solde du compte commun)', () => {
    const out = plain(formatEuros(-123_456));
    expect(out).toMatch(/^[-−]1 235 €$/);
  });
});

describe('parseEurosInput', () => {
  it('accepte les euros entiers usuels', () => {
    expect(parseEurosInput('0')).toEqual({ ok: true, cents: 0 });
    expect(parseEurosInput('1234')).toEqual({ ok: true, cents: 123_400 });
    expect(parseEurosInput(' 1 234 ')).toEqual({ ok: true, cents: 123_400 });
    expect(parseEurosInput('1 234 €')).toEqual({ ok: true, cents: 123_400 });
    expect(parseEurosInput('1 234 €')).toEqual({ ok: true, cents: 123_400 });
    expect(parseEurosInput('€12')).toEqual({ ok: true, cents: 1200 });
    expect(parseEurosInput('1 234,00')).toEqual({ ok: true, cents: 123_400 });
    expect(parseEurosInput('12.0')).toEqual({ ok: true, cents: 1200 });
  });

  it('rejette sans tronquer', () => {
    expect(parseEurosInput('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseEurosInput(' € ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseEurosInput('12,50')).toEqual({ ok: false, reason: 'not-integer' });
    expect(parseEurosInput('12.5')).toEqual({ ok: false, reason: 'not-integer' });
    expect(parseEurosInput('1.234')).toEqual({ ok: false, reason: 'not-integer' });
    expect(parseEurosInput('-5')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEurosInput('+5')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEurosInput('12a')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEurosInput('1 23')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEurosInput(',00')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEurosInput('12,')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEurosInput('99999999999')).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('accepte jusqu’à 1 milliard d’euros', () => {
    expect(parseEurosInput('1000000000')).toEqual({ ok: true, cents: 100_000_000_000 });
    expect(parseEurosInput('1000000001')).toEqual({ ok: false, reason: 'out-of-range' });
  });
});

describe('eurosToCents', () => {
  it('convertit des euros entiers, négatifs compris', () => {
    expect(eurosToCents(12)).toBe(1200);
    expect(eurosToCents(-300)).toBe(-30_000);
    expect(eurosToCents(-0)).toBe(0);
    expect(() => eurosToCents(1.5)).toThrow(RangeError);
    expect(() => eurosToCents(Number.NaN)).toThrow(RangeError);
  });
});

describe('splitRounded / roundEurosConsistent', () => {
  it('A + B affichés = total affiché', () => {
    expect(roundEurosConsistent(1050, 1050)).toEqual({ aCents: 1100, bCents: 1000, totalCents: 2100 });
    expect(roundEurosConsistent(88_040, 133_540)).toEqual({ aCents: 88_100, bCents: 133_500, totalCents: 221_600 });
    expect(roundEurosConsistent(88_040, 133_560)).toEqual({ aCents: 88_000, bCents: 133_600, totalCents: 221_600 });
    expect(roundEurosConsistent(88_000, 120_000)).toEqual({ aCents: 88_000, bCents: 120_000, totalCents: 208_000 });
  });

  it('somme exacte arrondie, plus forts restes, ordre stable', () => {
    const values = [3333, 3333, 3334];
    const out = splitRounded(values);
    expect(out.reduce((a, b) => a + b, 0)).toBe(roundToEuroCents(10_000));
    expect(out).toEqual([3300, 3300, 3400]);
    expect(splitRounded([])).toEqual([]);
    expect(splitRounded([149, 149, 2])).toEqual([200, 100, 0]);
  });

  it('fonctionne avec des négatifs', () => {
    const out = splitRounded([-150, 20]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(roundToEuroCents(-130));
    expect(out.every((v) => v % 100 === 0)).toBe(true);
  });

  it('propriété : chaque valeur à moins d’un euro de l’exacte, somme cohérente', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 48_271) % 2_147_483_647) % 500_000;
    for (let i = 0; i < 200; i++) {
      const values = [rand(), rand(), rand() - 250_000];
      const out = splitRounded(values);
      expect(out.reduce((a, b) => a + b, 0)).toBe(roundToEuroCents(values.reduce((a, b) => a + b, 0)));
      out.forEach((v, k) => expect(Math.abs(v - values[k]!)).toBeLessThan(100));
    }
  });

  it('contributions d’un mois réel : cohérentes avec le total commun', () => {
    const month = { ...createMonthRecord('2026-10', defaultSettings()), salaryACents: 220_100, bonusBCents: 67_550 };
    const summary = computeMonthSummary(month);
    const shown = roundEurosConsistent(summary.contributionACents, summary.contributionBCents);
    expect(shown.aCents + shown.bCents).toBe(shown.totalCents);
    expect(shown.totalCents).toBe(roundToEuroCents(summary.householdContributionCents));
  });
});
