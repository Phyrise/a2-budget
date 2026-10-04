/**
 * État du formulaire d'événement (présentation) : valeurs initiales depuis un
 * événement ou une saisie rapide, contrôles de saisie avec messages
 * chaleureux, et construction du brouillon pour le store. La validation
 * stricte reste celle de @a2/core (addEvent / updateEvent).
 */
import type { CalendarEvent, CalendarEventDraft, CalendarEventKind, CalendarWho } from '@a2/core';
import { originYearKnown } from './calendarText';

export interface EventFormValues {
  title: string;
  date: string;
  allDay: boolean;
  time: string;
  endTime: string;
  kind: CalendarEventKind;
  who: CalendarWho;
  place: string;
  note: string;
  yearly: boolean;
  /** Anniversaire : année de naissance si connue (« 1991 »), sinon ''. */
  birthYear: string;
}

/** Ce qu'une saisie rapide ou un jour choisi pré-remplit. */
export interface EventPrefill {
  title?: string;
  date: string;
  time?: string;
  endTime?: string;
  kind?: CalendarEventKind;
}

export type EventSheetState =
  | { mode: 'create'; prefill: EventPrefill }
  | { mode: 'edit'; event: CalendarEvent; occurrenceDate: string }
  | null;

export function initialValues(state: Exclude<EventSheetState, null>): EventFormValues {
  if (state.mode === 'create') {
    const p = state.prefill;
    const kind = p.kind ?? 'autre';
    return {
      title: p.title ?? '',
      date: p.date,
      allDay: p.time === undefined,
      time: p.time ?? '',
      endTime: p.endTime ?? '',
      kind,
      who: 'both',
      place: '',
      note: '',
      yearly: kind === 'anniversaire',
      birthYear: '',
    };
  }
  const e = state.event;
  const known = e.kind === 'anniversaire' && originYearKnown(e);
  return {
    title: e.title,
    // Année connue : on montre le jour de l'occurrence touchée, l'année à part.
    date: known ? state.occurrenceDate : e.date,
    allDay: e.allDay,
    time: e.time ?? '',
    endTime: e.endTime ?? '',
    kind: e.kind,
    who: e.who,
    place: e.place ?? '',
    note: e.note ?? '',
    yearly: e.yearly === true,
    birthYear: known ? e.date.slice(0, 4) : '',
  };
}

export type FieldErrors = Partial<Record<'title' | 'date' | 'time' | 'endTime' | 'birthYear', string>>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^\d{2}:\d{2}$/;

export function validate(v: EventFormValues, now: Date): FieldErrors {
  const errors: FieldErrors = {};
  if (v.title.replace(/\s+/g, ' ').trim() === '') errors.title = 'Donnez un petit nom à ce moment.';
  if (!DATE_KEY.test(v.date)) errors.date = 'Choisissez un jour.';
  if (!v.allDay) {
    if (!TIME_KEY.test(v.time)) errors.time = 'Indiquez l’heure de début, ou passez en journée entière.';
    else if (v.endTime !== '' && v.endTime === v.time) errors.endTime = 'La fin doit être à une autre heure que le début.';
  }
  if (v.kind === 'anniversaire' && v.birthYear.trim() !== '') {
    const y = Number(v.birthYear.trim());
    if (!/^\d{4}$/.test(v.birthYear.trim()) || y < 1900 || y > now.getFullYear()) {
      errors.birthYear = `Une année entre 1900 et ${now.getFullYear()}, ou rien du tout.`;
    }
  }
  return errors;
}

/** Brouillon pour addCalendarEvent / updateCalendarEvent (null retire un champ). */
export function toDraft(v: EventFormValues): CalendarEventDraft {
  let date = v.date;
  const year = v.birthYear.trim();
  if (v.kind === 'anniversaire' && /^\d{4}$/.test(year)) date = `${year}${v.date.slice(4)}`;
  return {
    title: v.title,
    date,
    allDay: v.allDay,
    time: v.allDay ? null : v.time,
    endTime: v.allDay || v.endTime === '' ? null : v.endTime,
    kind: v.kind,
    who: v.who,
    place: v.place.trim() === '' ? null : v.place,
    note: v.note.trim() === '' ? null : v.note,
    yearly: v.yearly,
  };
}

/** Message lisible pour une raison de refus du domaine. */
export function reasonMessage(reason: string): string {
  if (reason === 'calendar-full') return 'Le calendrier est plein (2 000 événements). Retirez-en quelques anciens.';
  if (reason.includes('date')) return 'Ce jour ne semble pas valide.';
  if (reason.includes('time')) return 'Ces heures ne semblent pas valides.';
  if (reason.includes('title')) return 'Ce titre ne convient pas.';
  return 'Impossible d’enregistrer cet événement.';
}
