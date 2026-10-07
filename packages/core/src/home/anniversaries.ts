/**
 * Anniversaires du foyer (V4.3) : celui du couple, fêté le même jour CHAQUE
 * mois, et ceux de A (Jiji) et de B (Calcifer), une fois par an. Fonctions
 * pures, sans exception.
 *
 * - Réglage optionnel `AppState.anniversaries` (absent des données d'avant) :
 *   `withAnniversaries` le préremplit (migration idempotente : déjà présent,
 *   l'état ressort tel quel, même référence).
 * - Jour du couple 29..31 : dernier jour des mois plus courts. 29 février
 *   d'une personne : 28 février les années non bissextiles (comme les
 *   anniversaires du calendrier).
 * - Au calendrier, les anniversaires de A et B sont des événements annuels
 *   VIRTUELS (`withAnniversaryEvents`), jamais écrits dans `calendar.events`.
 */

import type { CalendarEvent } from './calendarTypes.js';
import { isValidLocalDateKey } from './dates.js';
import type { AppState } from './types.js';
import { isIntInRange, isPlainObject, type Fail, type Ok } from './validationHelpers.js';

/** Un jour de l'année : mois 1..12, jour 1..31 (29 février permis). */
export interface MonthDay {
  month: number;
  day: number;
}

/** Réglage des anniversaires (optionnel dans AppState). */
export interface Anniversaries {
  /** Jour du mois (1..31) de l'anniversaire du couple, fêté chaque mois. */
  coupleDay: number;
  /** Anniversaire de la personne A (AL, Jiji). */
  a: MonthDay;
  /** Anniversaire de la personne B (AC, Calcifer). */
  b: MonthDay;
}

/** Une fête : le couple (chaque mois), A ou B (chaque année). */
export type FeteKind = 'couple' | 'a' | 'b';

/** Valeurs préremplies : le 19 de chaque mois, AL le 19 août, AC le 27 décembre. */
export const DEFAULT_ANNIVERSARIES: Readonly<Anniversaries> = Object.freeze({
  coupleDay: 19,
  a: Object.freeze({ month: 8, day: 19 }),
  b: Object.freeze({ month: 12, day: 27 }),
});

/** Plus long mois possible (février : 29). */
const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function lastDayOf(year: number, month: number): number {
  return month === 2 ? (isLeapYear(year) ? 29 : 28) : MAX_DAYS[month - 1]!;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function key(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Mois et jour valides (le 29 février compte). */
export function isMonthDay(value: unknown): value is MonthDay {
  return (
    isPlainObject(value) &&
    isIntInRange(value.month, 1, 12) &&
    isIntInRange(value.day, 1, MAX_DAYS[(value.month as number) - 1]!)
  );
}

/** Copie neuve des valeurs préremplies. */
export function defaultAnniversaries(): Anniversaries {
  const d = DEFAULT_ANNIVERSARIES;
  return { coupleDay: d.coupleDay, a: { ...d.a }, b: { ...d.b } };
}

/** Validation à l'exécution (raisons stables, champs inconnus ignorés). */
export function validateAnniversaries(value: unknown): Ok<Anniversaries> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'anniversaries-not-object' };
  if (!isIntInRange(value.coupleDay, 1, 31)) return { ok: false, reason: 'anniversaries-invalid-couple-day' };
  if (!isMonthDay(value.a)) return { ok: false, reason: 'anniversaries-invalid-a' };
  if (!isMonthDay(value.b)) return { ok: false, reason: 'anniversaries-invalid-b' };
  return {
    ok: true,
    state: { coupleDay: value.coupleDay, a: { month: value.a.month, day: value.a.day }, b: { month: value.b.month, day: value.b.day } },
  };
}

/** Migration idempotente : réglage absent → prérempli ; présent → état inchangé. */
export function withAnniversaries(app: AppState): AppState {
  return app.anniversaries === undefined ? { ...app, anniversaries: defaultAnniversaries() } : app;
}

// ---------------------------------------------------------------------------
// Dates des fêtes
// ---------------------------------------------------------------------------

/** Jour où tombe l'anniversaire du couple dans un mois (dernier jour s'il est plus court). */
export function coupleDayIn(coupleDay: number, year: number, month: number): number {
  return Math.min(coupleDay, lastDayOf(year, month));
}

/** Jour de l'anniversaire `md` l'année `year` (29 février → 28 hors année bissextile). */
function yearlyDayIn(md: MonthDay, year: number): number {
  return Math.min(md.day, lastDayOf(year, md.month));
}

function parts(dateKey: string): [number, number, number] | null {
  if (!isValidLocalDateKey(dateKey)) return null;
  return [Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)), Number(dateKey.slice(8, 10))];
}

/** Les fêtes du jour « YYYY-MM-DD », dans l'ordre A, B, couple (souvent aucune). */
export function fetesOn(anniv: Anniversaries | undefined, dateKey: string): FeteKind[] {
  const p = anniv ? parts(dateKey) : null;
  if (!anniv || p === null) return [];
  const [y, m, d] = p;
  const out: FeteKind[] = [];
  if (anniv.a.month === m && yearlyDayIn(anniv.a, y) === d) out.push('a');
  if (anniv.b.month === m && yearlyDayIn(anniv.b, y) === d) out.push('b');
  if (coupleDayIn(anniv.coupleDay, y, m) === d) out.push('couple');
  return out;
}

/** Vrai le jour de l'anniversaire du couple (chaque mois). */
export function isCoupleDay(anniv: Anniversaries | undefined, dateKey: string): boolean {
  return fetesOn(anniv, dateKey).includes('couple');
}

/** Prochaine date « YYYY-MM-DD » de la fête `kind`, `fromKey` compris ; null si clé invalide. */
export function nextAnniversary(anniv: Anniversaries, kind: FeteKind, fromKey: string): string | null {
  const p = parts(fromKey);
  if (p === null) return null;
  const [y, m, d] = p;
  if (kind === 'couple') {
    const here = coupleDayIn(anniv.coupleDay, y, m);
    if (here >= d) return key(y, m, here);
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    return key(ny, nm, coupleDayIn(anniv.coupleDay, ny, nm));
  }
  const md = anniv[kind];
  const thisYear = key(y, md.month, yearlyDayIn(md, y));
  return thisYear >= fromKey ? thisYear : key(y + 1, md.month, yearlyDayIn(md, y + 1));
}

/** Jours de l'anniversaire du couple dans [from, to] (bornes incluses, au plus 400 mois). */
export function coupleDaysBetween(anniv: Anniversaries | undefined, from: string, to: string): string[] {
  const a = parts(from);
  if (!anniv || a === null || !isValidLocalDateKey(to) || from > to) return [];
  const out: string[] = [];
  let [y, m] = a;
  for (let i = 0; i < 400; i += 1) {
    const k = key(y, m, coupleDayIn(anniv.coupleDay, y, m));
    if (k > to) break;
    if (k >= from) out.push(k);
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Saisie et affichage (Réglages)
// ---------------------------------------------------------------------------

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const FOLDED_MONTHS = MONTHS.map(fold);

/** « 19 août », « 1er mai ». */
export function monthDayLabel(md: MonthDay): string {
  return `${md.day === 1 ? '1er' : md.day} ${MONTHS[md.month - 1] ?? ''}`.trim();
}

/** « tous les 19 », « tous les 1ers ». */
export function coupleDayLabel(day: number): string {
  return day === 1 ? 'tous les 1ers' : `tous les ${day}`;
}

/** Mois d'un nom (« août », « aout », « déc. », « sept ») : préfixe sans ambiguïté, ≥ 3 lettres. */
function monthOf(word: string): number | null {
  const w = word.replace(/\.$/, '');
  if (w.length < 3) return null;
  const hits = FOLDED_MONTHS.flatMap((name, i) => (name.startsWith(w) ? [i + 1] : []));
  return hits.length === 1 ? hits[0]! : null;
}

/**
 * Jour de l'année saisi en français : « 19 août », « 19 aout », « le 1er mai »,
 * « 27 déc. », « 19/08 », « 19-8 », « 19.08 ». null si illisible ou impossible.
 */
export function parseMonthDay(text: string): MonthDay | null {
  const t = fold(text).replace(/^le /, '').replace(/^(\d{1,2})er\b/, '$1');
  let day: number;
  let month: number | null;
  const numeric = /^(\d{1,2}) ?[/.\- ] ?(\d{1,2})$/.exec(t);
  const named = /^(\d{1,2}) ?([a-z.]+)$/.exec(t);
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
  } else if (named) {
    day = Number(named[1]);
    month = monthOf(named[2]!);
  } else {
    return null;
  }
  const md = { month: month ?? 0, day };
  return isMonthDay(md) ? md : null;
}

/** Jour du couple saisi : « 19 », « le 19 », « tous les 19 », « le 1er de chaque mois ». */
export function parseCoupleDay(text: string): number | null {
  const t = fold(text)
    .replace(/^(tous les|chaque|le)\s*/, '')
    .replace(/\s*(du mois|de chaque mois|de mois|chaque mois)$/, '')
    .replace(/^(\d{1,2})(ers?|s)$/, '$1');
  if (!/^\d{1,2}$/.test(t)) return null;
  const day = Number(t);
  return day >= 1 && day <= 31 ? day : null;
}

// ---------------------------------------------------------------------------
// Calendrier : événements annuels virtuels
// ---------------------------------------------------------------------------

const VIRTUAL_PREFIX = 'anniversaire:';
/** Année d'origine des événements virtuels (bissextile : le 29 février reste valide). */
const VIRTUAL_YEAR = 2000;

/** Événement virtuel dérivé des réglages (jamais enregistré, ne se modifie pas au calendrier). */
export function isAnniversaryEventId(id: string): boolean {
  return id.startsWith(VIRTUAL_PREFIX);
}

/** Anniversaires de A et B en événements annuels (titre = prénom, sans âge). */
export function anniversaryEvents(anniv: Anniversaries, names: { a: string; b: string }): CalendarEvent[] {
  return (['a', 'b'] as const).map((who) => ({
    id: `${VIRTUAL_PREFIX}${who}`,
    title: names[who].trim() || (who === 'a' ? 'A' : 'B'),
    date: key(VIRTUAL_YEAR, anniv[who].month, anniv[who].day),
    allDay: true,
    kind: 'anniversaire',
    who,
    yearly: true,
    yearKnown: false,
    createdAt: `${VIRTUAL_YEAR}-01-01T00:00:00.000Z`,
  }));
}

/**
 * Événements du calendrier + anniversaires de A et B (virtuels). Un
 * anniversaire déjà saisi à la main (annuel, même personne, même jour) n'est
 * pas doublé. Sans réglage : les événements tels quels (même référence).
 */
export function withAnniversaryEvents(
  events: CalendarEvent[],
  anniv: Anniversaries | undefined,
  names: { a: string; b: string },
): CalendarEvent[] {
  if (!anniv) return events;
  const extra = anniversaryEvents(anniv, names).filter(
    (v) => !events.some((e) => e.kind === 'anniversaire' && e.yearly === true && e.who === v.who && e.date.slice(5) === v.date.slice(5)),
  );
  return extra.length === 0 ? events : [...events, ...extra];
}
