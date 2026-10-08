/**
 * Cercle de la semaine (V5.2) : une « part » par personne — les lettres.
 *
 * Chacun écrit SA part de la semaine, quand il veut, de son téléphone : son
 * merci à l'autre, ce qui lui pèse, son intention, un petit mot. Une part a
 * un id déterministe (`circle-<lundi>-<rôle>`) et n'est écrite que par son
 * auteur : deux téléphones qui écrivent la même semaine ne s'écrasent plus
 * et ne créent plus deux cercles. Le cercle tenu à deux sur un même
 * téléphone (ancien format, mode invité) reste tel quel ; la vue d'une
 * semaine fusionne tout (`mergeWeek`).
 *
 * « Non lu » : la part la plus récente de l'autre (semaine en cours ou
 * précédente) plus récente que la marque de lecture (`heldAt` de la
 * dernière lettre lue). Fonctions pures.
 */

import { addDays, isoWeekday, isValidLocalDateKey, localDateKey, parseLocalDateKey } from './dates.js';
import { weekStartKey } from './occurrences.js';
import type { BurdenNote, Circle, GratitudeNote, RitualsState } from './types.js';
import { isIsoTimestamp, isPerson } from './validationHelpers.js';

/** Longueur maximale d'un mot du cercle (merci, ce qui pèse, intention, petit mot). */
export const CIRCLE_TEXT_MAX = 280;
/** Nombre maximal de semaines de cercles gardées (les plus anciennes sont oubliées). */
export const CIRCLES_MAX = 260;

type Person = 'a' | 'b';

function cleanText(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(/\s+/g, ' ');
  return t === '' ? null : t.slice(0, CIRCLE_TEXT_MAX);
}

function isMonday(key: unknown): key is string {
  return typeof key === 'string' && isValidLocalDateKey(key) && isoWeekday(parseLocalDateKey(key)) === 1;
}

function cleanNotes(list: readonly GratitudeNote[] | undefined, what: string): GratitudeNote[] {
  const out: GratitudeNote[] = [];
  for (const g of list ?? []) {
    if (!isPerson(g.from) || !isPerson(g.to)) throw new RangeError(`invalid ${what} person`);
    const text = cleanText(g.text);
    if (text !== null) out.push({ from: g.from, to: g.to, text });
  }
  return out;
}

/**
 * Cercle nettoyé (espaces réduits, ≤ CIRCLE_TEXT_MAX, entrées vides
 * retirées). Une part ne garde que les mots de son auteur (une intention au
 * plus). RangeError si l'id, la semaine, l'heure ou une personne est invalide.
 */
export function normalizeCircle(circle: Circle): Circle {
  if (typeof circle.id !== 'string' || circle.id === '') throw new RangeError('circle id required');
  if (!isMonday(circle.weekStart)) throw new RangeError('circle weekStart must be a Monday');
  if (!isIsoTimestamp(circle.heldAt)) throw new RangeError('circle heldAt must be ISO');
  if (circle.author !== undefined && !isPerson(circle.author)) throw new RangeError('invalid circle author');
  const author = circle.author;
  let gratitude = cleanNotes(circle.gratitude, 'gratitude');
  let notes = cleanNotes(circle.notes, 'note');
  let burdens: BurdenNote[] = [];
  for (const b of circle.burdens) {
    if (!isPerson(b.who)) throw new RangeError('invalid burden person');
    const text = cleanText(b.text);
    if (text !== null) burdens.push({ who: b.who, text });
  }
  let intentions = circle.intentions.map(cleanText).filter((t): t is string => t !== null);
  if (author !== undefined) {
    gratitude = gratitude.filter((g) => g.from === author).slice(0, 1);
    notes = notes.filter((n) => n.from === author).slice(0, 1);
    burdens = burdens.filter((b) => b.who === author).slice(0, 1);
    intentions = intentions.slice(0, 1);
  }
  const out: Circle = { id: circle.id, weekStart: circle.weekStart, heldAt: circle.heldAt, gratitude, burdens, intentions };
  if (author !== undefined) out.author = author;
  if (notes.length > 0) out.notes = notes;
  return out;
}

const slotOf = (c: Circle) => `${c.weekStart}|${c.author ?? ''}`;

/** Tri par semaine (cercle à deux, puis parts a, b) ; au plus CIRCLES_MAX semaines. */
export function trimCircles(circles: Circle[]): Circle[] {
  const sorted = [...circles].sort((x, y) => (slotOf(x) < slotOf(y) ? -1 : slotOf(x) > slotOf(y) ? 1 : 0));
  const weeks = [...new Set(sorted.map((c) => c.weekStart))];
  if (weeks.length <= CIRCLES_MAX) return sorted;
  const oldestKept = weeks[weeks.length - CIRCLES_MAX]!;
  return sorted.filter((c) => c.weekStart >= oldestKept);
}

/** Id déterministe de la part de `author` pour la semaine `weekStart`. */
export function circlePartId(weekStart: string, author: Person): string {
  return `circle-${weekStart}-${author}`;
}

/**
 * Enregistre la part de `part.author` pour sa semaine : remplace seulement
 * SA part (id déterministe imposé). Ni le cercle à deux de la semaine ni la
 * part de l'autre ne sont touchés. RangeError si invalide. Pur.
 */
export function saveCirclePart(rituals: RitualsState | undefined, part: Omit<Circle, 'id'> & { author: Person }): RitualsState {
  if (!isPerson(part.author)) throw new RangeError('invalid circle author');
  const saved = normalizeCircle({ ...part, id: circlePartId(part.weekStart, part.author) });
  const others = (rituals?.circles ?? []).filter((c) => slotOf(c) !== slotOf(saved));
  return { circles: trimCircles([...others, saved]) };
}

/** Tous les enregistrements (cercle à deux, parts) d'une semaine. */
export function weekRecords(rituals: RitualsState | undefined, weekStart: string): Circle[] {
  return (rituals?.circles ?? []).filter((c) => c.weekStart === weekStart);
}

/**
 * Vue d'une semaine : un seul cercle. Les mots d'une personne viennent de
 * sa part si elle en a écrit une, sinon du cercle à deux. Un cercle seul est
 * rendu tel quel (même objet). null si rien.
 */
export function mergeWeek(records: readonly Circle[]): Circle | null {
  if (records.length === 0) return null;
  if (records.length === 1 && records[0]!.author === undefined) return records[0]!;
  const legacy = records.find((c) => c.author === undefined);
  const part = (p: Person) => records.find((c) => c.author === p);
  const source = (p: Person): Circle | undefined => part(p) ?? legacy;
  const pick = <T>(get: (c: Circle) => readonly T[] | undefined, mine: (x: T, p: Person) => boolean): T[] =>
    (['a', 'b'] as const).flatMap((p) => (get(source(p) ?? ({} as Circle)) ?? []).filter((x) => mine(x, p)));
  const fromParts = records.filter((c) => c.author !== undefined).flatMap((c) => c.intentions);
  const intentions = fromParts.length > 0 ? [...new Set(fromParts)] : (legacy?.intentions ?? []);
  const weekStart = records[0]!.weekStart;
  const out: Circle = {
    id: legacy?.id ?? `circle-${weekStart}`,
    weekStart,
    heldAt: records.map((c) => c.heldAt).reduce((x, y) => (y > x ? y : x)),
    gratitude: pick((c) => c.gratitude, (g, p) => g.from === p),
    burdens: pick((c) => c.burdens, (b, p) => b.who === p),
    intentions,
  };
  const notes = pick((c) => c.notes, (n, p) => n.from === p);
  if (notes.length > 0) out.notes = notes;
  return out;
}

/** Une vue par semaine (fusionnée), semaines croissantes. */
export function weeklyCircles(rituals: RitualsState | undefined): Circle[] {
  const byWeek = new Map<string, Circle[]>();
  for (const c of rituals?.circles ?? []) byWeek.set(c.weekStart, [...(byWeek.get(c.weekStart) ?? []), c]);
  return [...byWeek.keys()].sort().map((w) => mergeWeek(byWeek.get(w)!)!);
}

/** Qui a écrit cette semaine : ceux qui ont une part ; les deux si le cercle a été tenu à deux. */
export function circleWriters(rituals: RitualsState | undefined, weekStart: string): Person[] {
  const records = weekRecords(rituals, weekStart);
  if (records.some((c) => c.author === undefined)) return ['a', 'b'];
  return (['a', 'b'] as const).filter((p) => records.some((c) => c.author === p));
}

/** Part de `author` pour la semaine, ou null. */
export function circlePart(rituals: RitualsState | undefined, weekStart: string, author: Person): Circle | null {
  return weekRecords(rituals, weekStart).find((c) => c.author === author) ?? null;
}

/** Une lettre a-t-elle des mots ? (une part vide reste un « je suis passé ».) */
export function letterHasWords(c: Circle): boolean {
  return c.gratitude.length + c.burdens.length + c.intentions.length + (c.notes?.length ?? 0) > 0;
}

/**
 * La lettre non lue de l'autre pour `me`, ou null : sa part la plus récente
 * de la semaine de `now` ou de la précédente, écrite après `seen` (marque de
 * lecture = `heldAt` de la dernière lettre lue ; absente = jamais rien lu).
 */
export function unreadLetter(rituals: RitualsState | undefined, me: Person, seen: string | null | undefined, now: Date): Circle | null {
  const from: Person = me === 'a' ? 'b' : 'a';
  const thisWeek = weekStartKey(now);
  const lastWeek = localDateKey(addDays(parseLocalDateKey(thisWeek), -7));
  const mark = typeof seen === 'string' ? seen : '';
  let best: Circle | null = null;
  for (const c of rituals?.circles ?? []) {
    if (c.author !== from || (c.weekStart !== thisWeek && c.weekStart !== lastWeek)) continue;
    if (c.heldAt <= mark) continue;
    if (best === null || c.heldAt > best.heldAt) best = c;
  }
  return best;
}

/** Nouvelle marque de lecture après avoir lu `letter` (jamais en arrière). */
export function nextSeenMark(seen: string | null | undefined, letter: Circle): string {
  return typeof seen === 'string' && seen > letter.heldAt ? seen : letter.heldAt;
}
