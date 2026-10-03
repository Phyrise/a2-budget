/**
 * Libellés de dates en français (présentation uniquement).
 * Les clés de jour « YYYY-MM-DD » et de mois « YYYY-MM » viennent de core.
 */
import { addDays, localDateKey, parseLocalDateKey } from '@a2/core';

const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « Samedi 3 octobre ». */
export function longDate(date: Date): string {
  return capitalize(longFmt.format(date));
}

/** « 3 octobre ». */
export function dayMonth(date: Date): string {
  return dayMonthFmt.format(date);
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
