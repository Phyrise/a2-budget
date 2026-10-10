/**
 * Libellés de dates en français (présentation uniquement).
 * Les clés de jour « YYYY-MM-DD » et de mois « YYYY-MM » viennent de core.
 */
import { addDays, localDateKey, parseLocalDateKey } from '@a2/core';

const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const dayMonthYearFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const longYearFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Premier du mois en ordinal : « 1 octobre » → « 1er octobre ». */
function firstOrdinal(text: string): string {
  return text.replace(/(^|\s)1(?=\s)/u, (_match, before: string) => `${before}1er`);
}

/** L'année est à dire : une date d'une autre année que `today` (si donné). */
function otherYear(date: Date, today: Date | undefined): boolean {
  return today !== undefined && date.getFullYear() !== today.getFullYear();
}

/**
 * « Samedi 3 octobre », « Jeudi 1er octobre » ; avec `today`, l'année
 * s'ajoute pour une autre année : « Jeudi 19 août 2027 ».
 */
export function longDate(date: Date, today?: Date): string {
  return capitalize(firstOrdinal((otherYear(date, today) ? longYearFmt : longFmt).format(date)));
}

/** « 3 octobre », « 1er octobre » ; avec `today`, « 1er janvier 2027 » pour une autre année. */
export function dayMonth(date: Date, today?: Date): string {
  return firstOrdinal((otherYear(date, today) ? dayMonthYearFmt : dayMonthFmt).format(date));
}

/** « Lundi ». */
export function weekdayName(date: Date): string {
  return capitalize(weekdayFmt.format(date));
}

/** « 14:05 ». */
export function clockTime(date: Date): string {
  return timeFmt.format(date);
}

/** Jour relatif : « Aujourd’hui », « Hier », « Demain », sinon « Jeudi 1 octobre ». */
export function relativeDayLabel(dateKey: string, today: Date): string {
  const todayKey = localDateKey(today);
  if (dateKey === todayKey) return 'Aujourd’hui';
  if (dateKey === localDateKey(addDays(today, -1))) return 'Hier';
  if (dateKey === localDateKey(addDays(today, 1))) return 'Demain';
  return longDate(parseLocalDateKey(dateKey));
}

/** Décale une clé de mois « YYYY-MM » de `delta` mois. */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type TimeOfDay = 'matin' | 'apres-midi' | 'soir' | 'nuit';

export function timeOfDay(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'matin';
  if (h >= 12 && h < 18) return 'apres-midi';
  if (h >= 18 && h < 23) return 'soir';
  return 'nuit';
}

/** Jours ISO 1 = lundi … 7 = dimanche. */
export const WEEKDAYS: ReadonlyArray<{ iso: number; short: string; long: string }> = [
  { iso: 1, short: 'L', long: 'lundi' },
  { iso: 2, short: 'M', long: 'mardi' },
  { iso: 3, short: 'M', long: 'mercredi' },
  { iso: 4, short: 'J', long: 'jeudi' },
  { iso: 5, short: 'V', long: 'vendredi' },
  { iso: 6, short: 'S', long: 'samedi' },
  { iso: 7, short: 'D', long: 'dimanche' },
];
