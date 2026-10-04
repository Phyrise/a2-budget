/**
 * Calendrier commun (V3.2) : ajout, modification, retrait (annulable) et
 * validation des événements partagés. Fonctions pures : elles ne mutent
 * jamais leurs entrées, ne lèvent jamais d'exception et renvoient la même
 * référence quand rien ne change.
 *
 * Occurrences (jour, intervalle, prochains événements) : calendarOccurrences.ts.
 * Sémantique : docs/DOMAIN_CONTRACTS.md §12.
 */

import { isValidLocalDateKey } from './dates.js';
import { isIsoTimestamp, isPlainObject, type Fail, type Ok } from './validationHelpers.js';
import type {
  CalendarEvent,
  CalendarEventKind,
  CalendarState,
  CalendarWho,
} from './calendarTypes.js';

/** Nombre maximal d'événements gardés (au-delà, l'ajout est refusé). */
export const CALENDAR_EVENTS_MAX = 2000;
/** Longueur maximale du titre. */
export const CALENDAR_TITLE_MAX = 120;
/** Longueur maximale du lieu. */
export const CALENDAR_PLACE_MAX = 120;
/** Longueur maximale de la note. */
export const CALENDAR_NOTE_MAX = 1000;
/** Natures d'événement, dans l'ordre d'affichage suggéré. */
export const CALENDAR_KINDS: readonly CalendarEventKind[] = [
  'repas', 'sortie', 'anniversaire', 'rdv', 'voyage', 'maison', 'autre',
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isCalendarKind(value: unknown): value is CalendarEventKind {
  return typeof value === 'string' && (CALENDAR_KINDS as readonly string[]).includes(value);
}

export function isCalendarWho(value: unknown): value is CalendarWho {
  return value === 'a' || value === 'b' || value === 'both';
}

/** Heure locale « HH:MM » valide (00:00..23:59). */
export function isTimeKey(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

// ---------------------------------------------------------------------------
// Validation stricte (données persistées) — source de vérité unique
// ---------------------------------------------------------------------------

/**
 * Valide un événement persisté sans le transformer : un événement valide
 * ressort champ pour champ identique (rechargement à l'identique).
 */
export function validateCalendarEvent(value: unknown): Ok<CalendarEvent> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'calendar-event-not-object' };
  if (typeof value.id !== 'string' || value.id === '') {
    return { ok: false, reason: 'calendar-event-invalid-id' };
  }
  if (typeof value.title !== 'string' || value.title.trim() === '' ||
    value.title.length > CALENDAR_TITLE_MAX) {
    return { ok: false, reason: 'calendar-event-invalid-title' };
  }
  if (typeof value.date !== 'string' || !isValidLocalDateKey(value.date)) {
    return { ok: false, reason: 'calendar-event-invalid-date' };
  }
  if (typeof value.allDay !== 'boolean') return { ok: false, reason: 'calendar-event-invalid-all-day' };
  if (!isCalendarKind(value.kind)) return { ok: false, reason: 'calendar-event-invalid-kind' };
  if (!isCalendarWho(value.who)) return { ok: false, reason: 'calendar-event-invalid-who' };
  if (!isIsoTimestamp(value.createdAt)) return { ok: false, reason: 'calendar-event-invalid-created-at' };
  const out: CalendarEvent = {
    id: value.id,
    title: value.title,
    date: value.date,
    allDay: value.allDay,
    kind: value.kind,
    who: value.who,
    createdAt: value.createdAt,
  };
  if (value.allDay) {
    if (value.time !== undefined || value.endTime !== undefined) {
      return { ok: false, reason: 'calendar-event-all-day-with-time' };
    }
  } else {
    if (!isTimeKey(value.time)) return { ok: false, reason: 'calendar-event-invalid-time' };
    out.time = value.time;
    if (value.endTime !== undefined) {
      if (!isTimeKey(value.endTime) || value.endTime === value.time) {
        return { ok: false, reason: 'calendar-event-invalid-end-time' };
      }
      out.endTime = value.endTime;
    }
  }
  if (value.place !== undefined) {
    if (typeof value.place !== 'string' || value.place.length > CALENDAR_PLACE_MAX) {
      return { ok: false, reason: 'calendar-event-invalid-place' };
    }
    out.place = value.place;
  }
  if (value.note !== undefined) {
    if (typeof value.note !== 'string' || value.note.length > CALENDAR_NOTE_MAX) {
      return { ok: false, reason: 'calendar-event-invalid-note' };
    }
    out.note = value.note;
  }
  if (value.yearly !== undefined) {
    if (typeof value.yearly !== 'boolean') return { ok: false, reason: 'calendar-event-invalid-yearly' };
    out.yearly = value.yearly;
  }
  if (value.yearKnown !== undefined) {
    if (typeof value.yearKnown !== 'boolean') return { ok: false, reason: 'calendar-event-invalid-year-known' };
    out.yearKnown = value.yearKnown;
  }
  return { ok: true, state: out };
}

/** Valide `calendar` (présent seulement) : tableau ≤ 2000, ids uniques. */
export function validateCalendar(value: unknown): Ok<CalendarState> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'calendar-not-object' };
  if (!Array.isArray(value.events)) return { ok: false, reason: 'calendar-events-not-array' };
  if (value.events.length > CALENDAR_EVENTS_MAX) return { ok: false, reason: 'calendar-too-many-events' };
  const ids = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const raw of value.events) {
    const r = validateCalendarEvent(raw);
    if (!r.ok) return r;
    if (ids.has(r.state.id)) return { ok: false, reason: 'duplicate-calendar-event-id' };
    ids.add(r.state.id);
    events.push(r.state);
  }
  return { ok: true, state: { events } };
}

// ---------------------------------------------------------------------------
// Saisie (normalisation douce) puis validation stricte
// ---------------------------------------------------------------------------

/** Champs saisis pour créer un événement (id et horodatage posés par le store). */
export interface CalendarEventDraft {
  title: string;
  date: string;
  /** Heure de début ; absente ou null → journée entière (sauf `allDay: false` explicite → refus). */
  time?: string | null;
  endTime?: string | null;
  /** Défaut : vrai si aucune heure n'est donnée. `true` retire les heures. */
  allDay?: boolean;
  /** Défaut : 'autre'. */
  kind?: CalendarEventKind;
  /** Défaut : 'both'. */
  who?: CalendarWho;
  place?: string | null;
  note?: string | null;
  /** Défaut : vrai pour un anniversaire, faux sinon. */
  yearly?: boolean | null;
  /** Année d'origine réellement connue (âge affichable) ; null ou absent → non renseigné. */
  yearKnown?: boolean | null;
}

/** Modification : chaque champ présent remplace ; null retire un champ facultatif. */
export type CalendarEventPatch = Partial<CalendarEventDraft>;

export type CalendarResult =
  | { ok: true; events: CalendarEvent[]; event: CalendarEvent }
  | { ok: false; reason: string };

function cleanLine(value: string, max: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max).trim();
}

function cleanNote(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim().slice(0, CALENDAR_NOTE_MAX).trim();
}

/** Construit l'événement normalisé à partir d'une base et d'un patch, puis le valide. */
function buildEvent(base: CalendarEvent | null, patch: CalendarEventPatch & { id: string; createdAt: string }):
  Ok<CalendarEvent> | Fail {
  const title = patch.title !== undefined ? cleanLine(String(patch.title), CALENDAR_TITLE_MAX) : base?.title ?? '';
  const date = patch.date !== undefined ? patch.date : base?.date ?? '';
  let time = patch.time !== undefined ? patch.time ?? undefined : base?.time;
  let endTime = patch.endTime !== undefined ? patch.endTime ?? undefined : base?.endTime;
  let allDay: boolean;
  if (patch.allDay !== undefined) allDay = patch.allDay;
  else if (patch.time !== undefined) allDay = patch.time === null;
  else allDay = base?.allDay ?? time === undefined;
  if (allDay) {
    time = undefined;
    endTime = undefined;
  } else if (time === undefined) {
    endTime = undefined;
  }
  const kind = patch.kind ?? base?.kind ?? 'autre';
  const candidate: Record<string, unknown> = {
    id: patch.id,
    title,
    date,
    allDay,
    kind,
    who: patch.who ?? base?.who ?? 'both',
    createdAt: patch.createdAt,
  };
  if (time !== undefined) candidate.time = time;
  if (endTime !== undefined) candidate.endTime = endTime;
  // Seuls les champs présents dans le patch sont nettoyés : un champ hérité
  // reste tel quel (un patch vide rend la même référence).
  if (patch.place !== undefined) {
    const cleaned = typeof patch.place === 'string' ? cleanLine(patch.place, CALENDAR_PLACE_MAX) : '';
    if (cleaned !== '') candidate.place = cleaned;
  } else if (base?.place !== undefined) candidate.place = base.place;
  if (patch.note !== undefined) {
    const cleaned = typeof patch.note === 'string' ? cleanNote(patch.note) : '';
    if (cleaned !== '') candidate.note = cleaned;
  } else if (base?.note !== undefined) candidate.note = base.note;
  if (patch.yearly !== undefined) {
    if (patch.yearly === true) candidate.yearly = true;
  } else if (base !== null) {
    if (base.yearly !== undefined) candidate.yearly = base.yearly;
  } else if (kind === 'anniversaire') candidate.yearly = true;
  if (patch.yearKnown !== undefined) {
    if (patch.yearKnown !== null) candidate.yearKnown = patch.yearKnown;
  } else if (base?.yearKnown !== undefined) candidate.yearKnown = base.yearKnown;
  return validateCalendarEvent(candidate);
}

/**
 * Ajoute un événement. Refus (`ok: false`) si la saisie est invalide, si l'id
 * existe déjà ou si le calendrier compte déjà CALENDAR_EVENTS_MAX événements
 * (on n'oublie jamais un anniversaire en silence).
 */
export function addEvent(
  events: CalendarEvent[],
  draft: CalendarEventDraft & { id: string; createdAt: string },
): CalendarResult {
  if (typeof draft.id !== 'string' || draft.id === '') return { ok: false, reason: 'calendar-event-invalid-id' };
  if (events.some((e) => e.id === draft.id)) return { ok: false, reason: 'duplicate-calendar-event-id' };
  if (events.length >= CALENDAR_EVENTS_MAX) return { ok: false, reason: 'calendar-full' };
  const built = buildEvent(null, draft);
  if (!built.ok) return built;
  return { ok: true, events: [...events, built.state], event: built.state };
}

function sameEvent(a: CalendarEvent, b: CalendarEvent): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof CalendarEvent>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/**
 * Modifie un événement (id et createdAt inchangés). Donner une heure passe
 * l'événement en horaire ; `time: null` ou `allDay: true` le repasse en
 * journée entière (heures retirées). Patch sans effet → même référence.
 */
export function updateEvent(
  events: CalendarEvent[],
  id: string,
  patch: CalendarEventPatch,
): CalendarResult {
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return { ok: false, reason: 'calendar-event-not-found' };
  const current = events[index]!;
  const built = buildEvent(current, { ...patch, id: current.id, createdAt: current.createdAt });
  if (!built.ok) return built;
  if (sameEvent(current, built.state)) return { ok: true, events, event: current };
  const next = events.slice();
  next[index] = built.state;
  return { ok: true, events: next, event: built.state };
}

/** Événement retiré, à passer à `restoreEvent` pour annuler. */
export interface RemovedCalendarEvent {
  event: CalendarEvent;
  index: number;
}

/** Retire un événement. Id inconnu → même référence, `removed: null`. */
export function removeEvent(
  events: CalendarEvent[],
  id: string,
): { events: CalendarEvent[]; removed: RemovedCalendarEvent | null } {
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return { events, removed: null };
  const next = events.slice();
  next.splice(index, 1);
  return { events: next, removed: { event: events[index]!, index } };
}

/**
 * Annule un retrait : remet l'événement à sa position d'origine (bornée).
 * Même id déjà présent, calendrier plein ou événement invalide → même référence.
 */
export function restoreEvent(events: CalendarEvent[], removed: RemovedCalendarEvent): CalendarEvent[] {
  if (events.some((e) => e.id === removed.event.id)) return events;
  if (events.length >= CALENDAR_EVENTS_MAX) return events;
  const valid = validateCalendarEvent(removed.event);
  if (!valid.ok) return events;
  const at = Math.max(0, Math.min(events.length, Math.floor(removed.index) || 0));
  const next = events.slice();
  next.splice(at, 0, valid.state);
  return next;
}
