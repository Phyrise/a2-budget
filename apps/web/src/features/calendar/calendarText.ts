/**
 * Libellés du Calendrier (présentation uniquement ; les occurrences, tris et
 * répétitions annuelles viennent de @a2/core).
 *
 * Âge d'un anniversaire : on ne l'affiche que si l'année d'origine est
 * réellement connue : `yearKnown` posé par la feuille (année de naissance
 * saisie ou non), sinon (données d'avant) une année d'origine antérieure à
 * l'année de création (« Léa, née en 1991 », saisi en 2026).
 */
import {
  addDays,
  localDateKey,
  parseLocalDateKey,
  startOfWeek,
  type CalendarEvent,
  type CalendarOccurrence,
  type CalendarWho,
} from '@a2/core';
import { NBSP, capitalize, longDate } from '../../ui';

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

/** « 2026-10 » pour une date locale. */
export function monthKeyOf(date: Date): string {
  return localDateKey(date).slice(0, 7);
}

/** Premier jour du mois « YYYY-MM ». */
export function monthStart(key: string): Date {
  return parseLocalDateKey(`${key}-01`);
}

/** { month: « Octobre », year: « 2026 » }. */
export function monthLabel(key: string): { month: string; year: string } {
  const start = monthStart(key);
  return { month: capitalize(monthFmt.format(start)), year: String(start.getFullYear()) };
}

/**
 * Semaines (lundi d'abord) couvrant le mois : 4 à 6 rangées de 7 clés de
 * jour, débordant sur les mois voisins pour compléter les semaines.
 */
export function monthWeeks(key: string): string[][] {
  const first = monthStart(key);
  const weeks: string[][] = [];
  let cursor = startOfWeek(first);
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(localDateKey(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (monthKeyOf(cursor) !== key) break;
  }
  return weeks;
}

/** « 20:00 » → « 20 h », « 08:30 » → « 8 h 30 ». */
export function timeLabel(time: string): string {
  const [h, m] = time.split(':');
  const hours = String(Number(h));
  return m === '00' ? `${hours}${NBSP}h` : `${hours}${NBSP}h${NBSP}${m}`;
}

/** « Toute la journée », « 20 h », « 20 h – 23 h 30 ». */
export function timeRangeLabel(event: CalendarEvent): string {
  if (event.allDay || event.time === undefined) return 'Toute la journée';
  if (event.endTime === undefined) return timeLabel(event.time);
  return `${timeLabel(event.time)}${NBSP}–${NBSP}${timeLabel(event.endTime)}`;
}

/** Version lisible par un lecteur d'écran : « de 20 h à 23 h ». */
export function timeRangeSpoken(event: CalendarEvent): string {
  if (event.allDay || event.time === undefined) return 'toute la journée';
  if (event.endTime === undefined) return `à ${timeLabel(event.time)}`;
  return `de ${timeLabel(event.time)} à ${timeLabel(event.endTime)}`;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const VOWEL_START = /^[aeiouyœæ]/u;

/** Le titre parle déjà d'anniversaire (« Anniv’ de Léa », « Anniversaire de mariage »). */
function mentionsBirthday(title: string): boolean {
  return /\banniv/u.test(fold(title));
}

/** Titre affiché : « Léa » (anniversaire) → « Anniversaire de Léa », « Arthur » → « Anniversaire d’Arthur ». */
export function displayTitle(event: CalendarEvent): string {
  if (event.kind !== 'anniversaire' || mentionsBirthday(event.title)) return event.title;
  const article = VOWEL_START.test(fold(event.title)) ? 'd’' : 'de ';
  return `Anniversaire ${article}${event.title}`;
}

/** L'année d'origine est connue (`yearKnown`, sinon antérieure à l'année de création). */
export function originYearKnown(event: CalendarEvent): boolean {
  if (event.yearKnown !== undefined) return event.yearKnown;
  const created = Number(event.createdAt.slice(0, 4));
  const origin = Number(event.date.slice(0, 4));
  return Number.isFinite(created) && Number.isFinite(origin) && origin < created;
}

/** « 35 ans » / « 1 an » si l'année est connue, sinon null. */
export function yearsLabel(occurrence: CalendarOccurrence): string | null {
  const years = occurrence.years;
  if (years === undefined || years < 1 || !originYearKnown(occurrence.event)) return null;
  return `${years}${NBSP}an${years > 1 ? 's' : ''}`;
}

/** « Pour AL », « Pour AC », « Ensemble ». */
export function whoLabel(who: CalendarWho, names: { a: string; b: string }): string {
  if (who === 'a') return `Pour ${names.a}`;
  if (who === 'b') return `Pour ${names.b}`;
  return 'Ensemble';
}

/** « Aujourd’hui », « Demain », « Samedi 10 octobre ». */
export function dayHeading(dateKey: string, today: Date): string {
  if (dateKey === localDateKey(today)) return 'Aujourd’hui';
  if (dateKey === localDateKey(addDays(today, 1))) return 'Demain';
  return longDate(parseLocalDateKey(dateKey));
}

/** « 1 événement », « 3 événements ». */
export function eventsCount(n: number): string {
  return `${n}${NBSP}événement${n > 1 ? 's' : ''}`;
}
