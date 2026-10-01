import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareLocalDateKeys,
  daysInMonth,
  isoWeekday,
  isValidLocalDateKey,
  localDateKey,
  parseLocalDateKey,
  startOfWeek,
} from './dates.js';

describe('localDateKey', () => {
  it('produit une clé locale YYYY-MM-DD (jamais UTC)', () => {
    // Date construite en local : les composantes locales sont utilisées.
    const d = new Date(2026, 9, 5); // 5 octobre 2026 (local)
    expect(localDateKey(d)).toBe('2026-10-05');
  });

  it('zéro-padded mois et jour', () => {
    expect(localDateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('isoWeekday', () => {
  it('1 = lundi … 7 = dimanche', () => {
    // 2026-10-05 est un lundi.
    expect(isoWeekday(new Date(2026, 9, 5))).toBe(1);
    // 2026-10-11 est un dimanche.
    expect(isoWeekday(new Date(2026, 9, 11))).toBe(7);
    // 2026-10-08 est un jeudi.
    expect(isoWeekday(new Date(2026, 9, 8))).toBe(4);
  });
});

describe('daysInMonth', () => {
  it('mois courts prédictibles', () => {
    expect(daysInMonth(new Date(2026, 0, 15))).toBe(31); // janvier
    expect(daysInMonth(new Date(2026, 1, 10))).toBe(28); // 2026 non bissextile
    expect(daysInMonth(new Date(2028, 1, 10))).toBe(29); // 2028 bissextile
    expect(daysInMonth(new Date(2026, 3, 10))).toBe(30); // avril
    expect(daysInMonth(new Date(2026, 9, 10))).toBe(31); // octobre
  });
});

describe('addDays', () => {
  it('avance d’un jour calendaire (sans dérive)', () => {
    const d = new Date(2026, 9, 30); // 30 octobre
    expect(localDateKey(addDays(d, 1))).toBe('2026-10-31');
    expect(localDateKey(addDays(d, 2))).toBe('2026-11-01');
  });

  it('traverse un changement de mois et d’année', () => {
    const d = new Date(2026, 11, 31); // 31 décembre 2026
    expect(localDateKey(addDays(d, 1))).toBe('2027-01-01');
  });

  it('traverse une transition DST sans dérive (printemps)', () => {
    // Europe/Paris : le 29 mars 2026, l'horloge passe de 2h à 3h.
    // +1 jour doit donner le 30 mars, quel que soit le décalage d'horloge.
    const d = new Date(2026, 2, 29);
    expect(localDateKey(addDays(d, 1))).toBe('2026-03-30');
    expect(localDateKey(addDays(d, 2))).toBe('2026-03-31');
  });

  it('traverse une transition DST sans dérive (automne)', () => {
    // Europe/Paris : le 25 octobre 2026, l'horloge repasse de 3h à 2h.
    const d = new Date(2026, 9, 25);
    expect(localDateKey(addDays(d, 1))).toBe('2026-10-26');
  });
});

describe('startOfWeek', () => {
  it('retourne le lundi de la semaine', () => {
    // 2026-10-08 (jeudi) → lundi 2026-10-05.
    expect(localDateKey(startOfWeek(new Date(2026, 9, 8)))).toBe('2026-10-05');
    // 2026-10-11 (dimanche) → lundi 2026-10-05.
    expect(localDateKey(startOfWeek(new Date(2026, 9, 11)))).toBe('2026-10-05');
    // 2026-10-05 (lundi) → lui-même.
    expect(localDateKey(startOfWeek(new Date(2026, 9, 5)))).toBe('2026-10-05');
  });
});

describe('parseLocalDateKey', () => {
  it('parse une clé valide à minuit local', () => {
    const d = parseLocalDateKey('2026-10-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(5);
  });

  it('rejette une date inexistante (2026-02-30)', () => {
    expect(() => parseLocalDateKey('2026-02-30')).toThrow(RangeError);
  });

  it('rejette une clé mal formée', () => {
    expect(() => parseLocalDateKey('2026-10-5')).toThrow(RangeError);
    expect(() => parseLocalDateKey('once')).toThrow(RangeError);
  });
});

describe('isValidLocalDateKey', () => {
  it('accepte les dates valides', () => {
    expect(isValidLocalDateKey('2026-02-28')).toBe(true);
    expect(isValidLocalDateKey('2028-02-29')).toBe(true);
  });
  it('rejette les dates invalides', () => {
    expect(isValidLocalDateKey('2026-02-29')).toBe(false);
    expect(isValidLocalDateKey('once')).toBe(false);
  });
});

describe('compareLocalDateKeys', () => {
  it('compare chronologiquement', () => {
    expect(compareLocalDateKeys('2026-10-01', '2026-10-02')).toBe(-1);
    expect(compareLocalDateKeys('2026-10-02', '2026-10-01')).toBe(1);
    expect(compareLocalDateKeys('2026-10-01', '2026-10-01')).toBe(0);
  });
});
