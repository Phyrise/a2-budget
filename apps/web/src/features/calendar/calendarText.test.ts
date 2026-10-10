import { describe, expect, it } from 'vitest';
import { parseLocalDateKey } from '@a2/core';
import { dayMonth, longDate } from '../../ui/dates';
import { dayHeading, dayPhrase } from './calendarText';

// Nous sommes le dimanche 11 octobre 2026.
const today = new Date(2026, 9, 11, 10, 0);

describe('titres de jour : l’année seulement pour une autre année', () => {
  it('même année : inchangé', () => {
    expect(dayHeading('2026-12-15', today)).toBe('Mardi 15 décembre');
    expect(dayPhrase('2026-12-15', today)).toBe('le mardi 15 décembre');
  });

  it('autre année : l’année s’ajoute', () => {
    expect(dayHeading('2027-08-19', today)).toBe('Jeudi 19 août 2027');
    expect(dayHeading('2027-09-29', today)).toBe('Mercredi 29 septembre 2027');
    expect(dayPhrase('2027-08-19', today)).toBe('le jeudi 19 août 2027');
    expect(dayHeading('2025-10-01', today)).toBe('Mercredi 1er octobre 2025');
  });

  it('aujourd’hui / demain restent relatifs', () => {
    expect(dayHeading('2026-10-11', today)).toBe('Aujourd’hui');
    expect(dayHeading('2026-10-12', today)).toBe('Demain');
  });

  it('31 décembre → 1er janvier : demain, avec l’année dans la date', () => {
    const eve = new Date(2026, 11, 31, 10, 0);
    expect(dayHeading('2026-12-31', eve)).toBe('Aujourd’hui');
    expect(dayHeading('2027-01-01', eve)).toBe('Demain');
    expect(dayMonth(parseLocalDateKey('2027-01-01'), eve)).toBe('1er janvier 2027');
    expect(dayMonth(parseLocalDateKey('2026-12-31'), eve)).toBe('31 décembre');
    expect(dayHeading('2027-01-02', eve)).toBe('Samedi 2 janvier 2027');
  });

  it('sans référence : jamais d’année (comportement d’avant)', () => {
    expect(longDate(parseLocalDateKey('2027-08-19'))).toBe('Jeudi 19 août');
    expect(dayMonth(parseLocalDateKey('2027-01-01'))).toBe('1er janvier');
  });
});
