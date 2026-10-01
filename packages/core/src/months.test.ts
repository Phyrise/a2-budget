import { describe, expect, it } from 'vitest';
import {
  compareMonthKeys,
  currentMonthKey,
  isValidMonthKey,
  monthKeyToLabel,
} from './index.js';

describe('currentMonthKey — fuseau local', () => {
  it('dates fixes construites dans le fuseau local', () => {
    // new Date(année, mois, jour) est interprété en fuseau LOCAL.
    expect(currentMonthKey(new Date(2026, 9, 15))).toBe('2026-10');
    expect(currentMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe('2026-12');
    expect(currentMonthKey(new Date(2025, 5, 3, 23, 59))).toBe('2025-06');
  });

  it('sans argument : cohérent avec la date locale courante', () => {
    const now = new Date();
    const expected = `${String(now.getFullYear()).padStart(4, '0')}-${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}`;
    expect(currentMonthKey()).toBe(expected);
  });

  it('jamais UTC : une date ISO proche de minuit UTC garde la date locale', () => {
    // 2026-01-01T00:30:00Z : dans tout fuseau à l'ouest de UTC, la date
    // locale est encore le 31/12/2025 ; à l'est, c'est le 01/01/2026.
    const d = new Date('2026-01-01T00:30:00Z');
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(currentMonthKey(d)).toBe(expected);
    // Et surtout, pas le résultat d'une lecture UTC aveugle quand les deux diffèrent.
    const utcKey = `2026-01`;
    if (d.getFullYear() !== 2026 || d.getMonth() !== 0) {
      expect(currentMonthKey(d)).not.toBe(utcKey);
    }
  });
});

describe('isValidMonthKey', () => {
  it('clés valides', () => {
    expect(isValidMonthKey('2026-10')).toBe(true);
    expect(isValidMonthKey('2026-01')).toBe(true);
    expect(isValidMonthKey('2026-12')).toBe(true);
    expect(isValidMonthKey('0001-01')).toBe(true);
  });

  it('clés invalides', () => {
    expect(isValidMonthKey('2026-00')).toBe(false);
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-1')).toBe(false);
    expect(isValidMonthKey('26-10')).toBe(false);
    expect(isValidMonthKey('2026-10-01')).toBe(false);
    expect(isValidMonthKey('2026/10')).toBe(false);
    expect(isValidMonthKey('2026-1a')).toBe(false);
    expect(isValidMonthKey('')).toBe(false);
  });
});

describe('compareMonthKeys', () => {
  it('ordre chronologique', () => {
    expect(compareMonthKeys('2026-01', '2026-02')).toBe(-1);
    expect(compareMonthKeys('2026-12', '2027-01')).toBe(-1);
    expect(compareMonthKeys('2027-01', '2026-12')).toBe(1);
    expect(compareMonthKeys('2026-10', '2026-10')).toBe(0);
  });

  it('compatible avec Array.prototype.sort', () => {
    const keys = ['2026-12', '2025-03', '2026-02', '2024-11'];
    expect([...keys].sort(compareMonthKeys)).toEqual([
      '2024-11',
      '2025-03',
      '2026-02',
      '2026-12',
    ]);
  });
});

describe('monthKeyToLabel', () => {
  it('libellés français', () => {
    expect(monthKeyToLabel('2026-10')).toBe('Octobre 2026');
    expect(monthKeyToLabel('2026-01')).toBe('Janvier 2026');
    expect(monthKeyToLabel('2026-12')).toBe('Décembre 2026');
    expect(monthKeyToLabel('2025-06')).toBe('Juin 2025');
  });

  it('clé invalide → erreur', () => {
    expect(() => monthKeyToLabel('2026-13')).toThrow(RangeError);
  });
});
