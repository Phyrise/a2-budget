/**
 * Calendrier → Google Agenda / Calendrier (V5.10) : un lien « ajouter à
 * Google Agenda » pour un événement et un fichier iCalendar (RFC 5545) pour
 * tout le calendrier. Fonctions pures. Ce sont des COPIES : un événement
 * modifié dans A² ne change pas dans l'agenda (aucune synchro).
 *
 * - Heures « flottantes » (sans Z ni TZID) : l'agenda les lit dans son propre
 *   fuseau, comme A² (heure locale).
 * - Journée entière : date de fin EXCLUSIVE (lendemain).
 * - Sans heure de fin : une heure. Fin avant le début : le lendemain (après
 *   minuit).
 * - Annuel : RRULE:FREQ=YEARLY ; un 29 février → dernier jour de février
 *   (BYMONTH=2;BYMONTHDAY=-1), comme le 28 février d'A² hors année bissextile.
 * - Le fichier reçoit ce qu'on lui passe : côté web, les événements du
 *   calendrier + les anniversaires de A et B (`withAnniversaryEvents`).
 *   L'anniversaire du couple (chaque mois) n'est pas exporté.
 */

import { eventsBetween } from './calendarOccurrences.js';
import type { CalendarEvent } from './calendarTypes.js';
import { localDateKey } from './dates.js';

/** Domaine fixe des UID (stables : même événement → même UID, réimport sans doublon). */
export const ICS_UID_DOMAIN = 'a2home.invalid';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** « YYYY-MM-DD » → « YYYYMMDD ». */
const compactDate = (dateKey: string) => dateKey.replace(/-/g, '');

/** Date + heure flottantes décalées de `minutes` (calcul sur l'horloge, sans fuseau). */
function shift(dateKey: string, time: string, minutes: number): { date: string; time: string } {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
  return {
    date: `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}

const nextDay = (dateKey: string) => shift(dateKey, '00:00', 24 * 60).date;

/** Début et fin d'une occurrence au jour `date` : dates seules (journée) ou date + heure. */
function span(event: CalendarEvent, date: string): { allDay: true; start: string; end: string } | { allDay: false; start: string; end: string } {
  if (event.allDay || event.time === undefined) return { allDay: true, start: compactDate(date), end: compactDate(nextDay(date)) };
  const start = { date, time: event.time };
  const end =
    event.endTime === undefined
      ? shift(date, event.time, 60)
      : { date: event.endTime < event.time ? nextDay(date) : date, time: event.endTime };
  const fmt = (p: { date: string; time: string }) => `${compactDate(p.date)}T${p.time.replace(':', '')}00`;
  return { allDay: false, start: fmt(start), end: fmt(end) };
}

/** Règle annuelle (29 février → dernier jour de février). */
function yearlyRule(event: CalendarEvent): string {
  return event.date.endsWith('-02-29') ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY';
}

/** Prochaine occurrence (aujourd'hui compris) d'un événement annuel ; sinon sa date. */
function nextOccurrenceDate(event: CalendarEvent, now: Date): string {
  if (event.yearly !== true) return event.date;
  const today = localDateKey(now);
  const to = `${pad(now.getFullYear() + 1, 4)}-12-31`;
  return eventsBetween([event], today, to)[0]?.date ?? event.date;
}

export interface CalendarExportOptions {
  /** Titre affiché (ex. « Anniversaire de Léa ») ; par défaut `event.title`. */
  titleOf?: (event: CalendarEvent) => string;
}

/**
 * Lien « ajouter à Google Agenda » (ouvre la page de création préremplie,
 * ou l'app sur téléphone). Annuel : commence à la prochaine occurrence et
 * se répète chaque année (`recur`).
 */
export function googleCalendarUrl(event: CalendarEvent, now: Date, opts: CalendarExportOptions = {}): string {
  const s = span(event, nextOccurrenceDate(event, now));
  const params: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', opts.titleOf?.(event) ?? event.title],
    ['dates', `${s.start}/${s.end}`],
  ];
  if (event.note) params.push(['details', event.note]);
  if (event.place) params.push(['location', event.place]);
  if (event.yearly === true) params.push(['recur', yearlyRule(event)]);
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}

// ---------------------------------------------------------------------------
// iCalendar (RFC 5545)
// ---------------------------------------------------------------------------

/** Échappe un TEXT : antislash, point-virgule, virgule, retours à la ligne. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Taille UTF-8 d'un point de code. */
function utf8Size(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/**
 * Plie une ligne à 75 octets (UTF-8) : suite = CRLF + espace. Ne coupe
 * jamais un caractère (ni une paire de substitution) en deux.
 */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8Size(ch);
    // Ligne de suite : l'espace initial compte dans les 75 octets.
    if (bytes + size > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n');
}

/** Horodatage UTC « YYYYMMDDTHHMMSSZ ». */
function utcStamp(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export interface IcsOptions extends CalendarExportOptions {
  /** Instant de l'export (DTSTAMP). */
  now: Date;
  /** Nom du calendrier (X-WR-CALNAME) ; par défaut « A² Home ». */
  calendarName?: string;
}

/** Les lignes (non pliées) d'un VEVENT. Annuel : depuis sa date d'origine. */
function veventLines(event: CalendarEvent, stamp: string, opts: IcsOptions): string[] {
  const s = span(event, event.date);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.id)}@${ICS_UID_DOMAIN}`,
    `DTSTAMP:${stamp}`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`,
  ];
  if (event.yearly === true) lines.push(yearlyRule(event));
  lines.push(`SUMMARY:${escapeIcsText(opts.titleOf?.(event) ?? event.title)}`);
  if (event.place) lines.push(`LOCATION:${escapeIcsText(event.place)}`);
  if (event.note) lines.push(`DESCRIPTION:${escapeIcsText(event.note)}`);
  lines.push('END:VEVENT');
  return lines;
}

/** Fichier iCalendar complet (CRLF, lignes pliées), un VEVENT par événement. */
export function eventsToIcs(events: readonly CalendarEvent[], opts: IcsOptions): string {
  const stamp = utcStamp(opts.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//A2 Home//Calendrier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts.calendarName ?? 'A² Home')}`,
    ...events.flatMap((e) => veventLines(e, stamp, opts)),
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Nom du fichier exporté : « a2home-calendrier-AAAA-MM-JJ.ics » (jour local). */
export function icsFilename(now: Date): string {
  return `a2home-calendrier-${localDateKey(now)}.ics`;
}
