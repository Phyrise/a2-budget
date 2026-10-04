/**
 * Occurrences du calendrier commun (V3.2) : le jour, un intervalle (grille
 * mensuelle, agenda) et les prochains événements. Fonctions pures.
 *
 * - Un événement ponctuel a une seule occurrence, à sa `date`.
 * - Un événement annuel (`yearly`) a une occurrence par année à partir de
 *   l'année d'origine, au même mois/jour ; un 29 février tombe le 28 février
 *   les années non bissextiles.
 * - Tri : par date, puis journée entière avant les horaires, puis heure,
 *   puis titre (ordre français), puis id (stable).
 */

import { isValidLocalDateKey, localDateKey } from './dates.js';
import type { CalendarEvent, CalendarOccurrence } from './calendarTypes.js';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Jour de l'occurrence annuelle de `event` l'année `year` (null avant l'année d'origine). */
function yearlyDateIn(event: CalendarEvent, year: number): string | null {
  const originYear = Number(event.date.slice(0, 4));
  if (year < originYear || year > 9999) return null;
  const month = event.date.slice(5, 7);
  let day = event.date.slice(8, 10);
  if (month === '02' && day === '29' && !isLeapYear(year)) day = '28';
  return `${pad(year, 4)}-${month}-${day}`;
}

function occurrence(event: CalendarEvent, date: string): CalendarOccurrence {
  if (event.yearly !== true) return { event, date };
  return { event, date, years: Number(date.slice(0, 4)) - Number(event.date.slice(0, 4)) };
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Comparateur d'occurrences (date, journée entière, heure, titre, id). */
export function compareOccurrences(a: CalendarOccurrence, b: CalendarOccurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  const ta = a.event.time ?? '';
  const tb = b.event.time ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  const byTitle = collator.compare(a.event.title, b.event.title);
  if (byTitle !== 0) return byTitle;
  return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
}

/**
 * Occurrences dans l'intervalle [from, to] (bornes incluses, clés
 * « YYYY-MM-DD »), triées. Intervalle invalide ou inversé → [].
 */
export function eventsBetween(events: CalendarEvent[], from: string, to: string): CalendarOccurrence[] {
  if (!isValidLocalDateKey(from) || !isValidLocalDateKey(to) || from > to) return [];
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4));
  const out: CalendarOccurrence[] = [];
  for (const event of events) {
    if (event.yearly === true) {
      for (let year = Math.max(firstYear, Number(event.date.slice(0, 4))); year <= lastYear; year += 1) {
        const date = yearlyDateIn(event, year);
        if (date !== null && date >= from && date <= to) out.push(occurrence(event, date));
      }
    } else if (event.date >= from && event.date <= to) {
      out.push(occurrence(event, event.date));
    }
  }
  return out.sort(compareOccurrences);
}

/** Occurrences du jour `date` (annuelles comprises) : journée entière, puis par heure. */
export function eventsOn(events: CalendarEvent[], date: string): CalendarOccurrence[] {
  return eventsBetween(events, date, date);
}

/** Heure locale « HH:MM » d'une date. */
function localTimeKey(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Une occurrence d'aujourd'hui est encore « à venir » si elle dure toute la
 * journée, si son début n'est pas passé, ou si elle n'est pas terminée (fin
 * plus tard dans la journée, ou après minuit).
 */
function stillAheadToday(event: CalendarEvent, nowTime: string): boolean {
  if (event.allDay || event.time === undefined) return true;
  if (event.time >= nowTime) return true;
  if (event.endTime === undefined) return false;
  return event.endTime < event.time || event.endTime > nowTime;
}

/**
 * Les `n` prochaines occurrences à partir de `now` (date et heure locales) :
 * celles d'aujourd'hui pas encore terminées, puis les jours suivants. Un
 * événement annuel apparaît au plus une fois (sa prochaine occurrence).
 */
export function nextEvents(events: CalendarEvent[], now: Date, n: number): CalendarOccurrence[] {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (count === 0 || Number.isNaN(now.getTime())) return [];
  const today = localDateKey(now);
  const nowTime = localTimeKey(now);
  const year = now.getFullYear();
  const out: CalendarOccurrence[] = [];
  for (const event of events) {
    if (event.yearly === true) {
      for (let y = year; y <= year + 1; y += 1) {
        const date = yearlyDateIn(event, y);
        if (date === null || date < today) continue;
        if (date === today && !stillAheadToday(event, nowTime)) continue;
        out.push(occurrence(event, date));
        break;
      }
      // Origine dans le futur lointain : première occurrence = la date d'origine.
      if (Number(event.date.slice(0, 4)) > year + 1) out.push(occurrence(event, event.date));
    } else if (event.date > today || (event.date === today && stillAheadToday(event, nowTime))) {
      out.push(occurrence(event, event.date));
    }
  }
  return out.sort(compareOccurrences).slice(0, count);
}
