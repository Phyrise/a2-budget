import { describe, expect, it } from 'vitest';
import { formatCents, MAX_AMOUNT_CENTS, parseAmountInput } from './index.js';

/** Normalise les espaces insécables pour comparer les formats fr-FR. */
const norm = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

describe('parseAmountInput — valeurs valides', () => {
  it('« 0 » est valide', () => {
    expect(parseAmountInput('0')).toEqual({ ok: true, cents: 0 });
  });

  it('entier simple', () => {
    expect(parseAmountInput('1234')).toEqual({ ok: true, cents: 123_400 });
  });

  it('fr-FR : virgule décimale et espaces de milliers', () => {
    expect(parseAmountInput('1 234,56')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('1 234,5')).toEqual({ ok: true, cents: 123_450 });
    expect(parseAmountInput('1 234')).toEqual({ ok: true, cents: 123_400 });
  });

  it('en-US : point décimal et virgules de milliers', () => {
    expect(parseAmountInput('1234.56')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('1,234.56')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('1,234,567')).toEqual({ ok: true, cents: 123_456_700 });
  });

  it('fr-FR avec point de milliers', () => {
    expect(parseAmountInput('1.234,56')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('1.234.567')).toEqual({ ok: true, cents: 123_456_700 });
  });

  it('symbole euro en fin (et en début) de chaîne', () => {
    expect(parseAmountInput('1 234,56 €')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('€1234.56')).toEqual({ ok: true, cents: 123_456 });
  });

  it('espaces français au collage (insécable U+00A0, fine insécable U+202F)', () => {
    expect(parseAmountInput('1\u00a0234,56')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('1\u202f234,56')).toEqual({ ok: true, cents: 123_456 });
    expect(parseAmountInput('  1234  ')).toEqual({ ok: true, cents: 123_400 });
  });

  it('décimales sans partie entière', () => {
    expect(parseAmountInput(',56')).toEqual({ ok: true, cents: 56 });
    expect(parseAmountInput('0,5')).toEqual({ ok: true, cents: 50 });
  });

  it('limite haute : 1 000 000 000,00 € = MAX_AMOUNT_CENTS', () => {
    expect(parseAmountInput('1 000 000 000,00')).toEqual({ ok: true, cents: MAX_AMOUNT_CENTS });
  });
});

describe('parseAmountInput — rejets', () => {
  it('vide (et espaces seulement, symbole seul)', () => {
    expect(parseAmountInput('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseAmountInput('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseAmountInput('€')).toEqual({ ok: false, reason: 'empty' });
  });

  it('ambigu : un seul séparateur suivi de 3 chiffres', () => {
    expect(parseAmountInput('1,234')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('1.234')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('12,345')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('plus de deux décimales (pas de troncature)', () => {
    expect(parseAmountInput('1,2345')).toEqual({ ok: false, reason: 'too-many-decimals' });
    expect(parseAmountInput('1.2345')).toEqual({ ok: false, reason: 'too-many-decimals' });
    expect(parseAmountInput('1,234.567')).toEqual({ ok: false, reason: 'too-many-decimals' });
    expect(parseAmountInput(',567')).toEqual({ ok: false, reason: 'too-many-decimals' });
  });

  it('négatif', () => {
    expect(parseAmountInput('-5')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('-1 234,56')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('hors plage', () => {
    expect(parseAmountInput('1 000 000 000,01')).toEqual({ ok: false, reason: 'out-of-range' });
    expect(parseAmountInput('99999999999999999999')).toEqual({
      ok: false,
      reason: 'out-of-range',
    });
  });

  it('caractères invalides et formes incohérentes', () => {
    expect(parseAmountInput('abc')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('12a')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('1 2 34,56')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('12,34,56')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('1,23')).toEqual({ ok: true, cents: 123 });
    expect(parseAmountInput('1 234,')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmountInput('123€€')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('formatCents', () => {
  it('123456 → « 1 234,56 € » (fr-FR, espaces normalisés)', () => {
    expect(norm(formatCents(123_456))).toBe('1 234,56 €');
  });

  it('zéro', () => {
    expect(norm(formatCents(0))).toBe('0,00 €');
  });

  it('montants entiers', () => {
    expect(norm(formatCents(23_500))).toBe('235,00 €');
    expect(norm(formatCents(184_500))).toBe('1 845,00 €');
  });
});
