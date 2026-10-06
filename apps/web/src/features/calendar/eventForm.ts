/**
 * État du formulaire d'événement (présentation) : valeurs initiales depuis un
 * événement ou une saisie rapide, contrôles de saisie avec messages
 * chaleureux, et construction du brouillon pour le store. La validation
 * stricte reste celle de @a2/core (addEvent / updateEvent).
 */
import type { CalendarEvent, CalendarEventDraft, CalendarEventKind, CalendarWho } from '@a2/core';
import { birthdayOrigin } from './birthdayDate';
import { originYearKnown } from './calendarText';
import { quickParse } from './quickParse';

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
  /** Jour montré à l'ouverture (pour savoir s'il a été touché). */
  initialDate: string;
  /** Date d'origine de l'événement modifié ('' pour un ajout). */
  originDate: string;
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
      initialDate: p.date,
      originDate: '',
    };
  }
  const e = state.event;
  const known = e.kind === 'anniversaire' && originYearKnown(e);
  // Année connue : on montre le jour de l'occurrence touchée, l'année à part
  // (un 29 février reste un 29 février : voir birthdayDate.ts).
  const date = known ? state.occurrenceDate : e.date;
  return {
    title: e.title,
    date,
    allDay: e.allDay,
    time: e.time ?? '',
    endTime: e.endTime ?? '',
    kind: e.kind,
    who: e.who,
    place: e.place ?? '',
    note: e.note ?? '',
    yearly: e.yearly === true,
    birthYear: known ? e.date.slice(0, 4) : '',
    initialDate: date,
    originDate: e.date,
  };
}

/**
 * Saisie en une phrase (feuille d'ajout) : « dîner chez Léa samedi 20h »
 * remplit titre, jour, heure(s) et nature, au fil de la frappe. Les champs
 * que la phrase ne précise pas reviennent à leur valeur d'ouverture (`base`)
 * ; qui, lieu et note ne sont jamais touchés. Une retouche à la main tient
 * jusqu'à la prochaine frappe dans la phrase. Phrase vide : retour à `base`.
 */
export function applySentence(
  current: EventFormValues,
  base: EventFormValues,
  raw: string,
  now: Date,
  yearlyTouched: boolean,
): EventFormValues {
  const text = raw.replace(/\s+/g, ' ').trim();
  const parsed = text === '' ? null : quickParse(text, now);
  const kind = parsed?.kind ?? base.kind;
  const time = parsed?.time;
  return {
    ...current,
    title: parsed ? parsed.title || text : base.title,
    date: parsed?.date ?? base.date,
    allDay: time === undefined ? base.allDay : false,
    time: time ?? base.time,
    endTime: time === undefined ? base.endTime : (parsed?.endTime ?? ''),
    kind,
    yearly: yearlyTouched ? current.yearly : kind === 'anniversaire',
  };
}

export type FieldErrors = Partial<Record<'title' | 'date' | 'time' | 'endTime' | 'birthYear', string>>;

const NBSP = '\u00a0';
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
  if (v.kind === 'anniversaire' && !errors.birthYear && !errors.date) {
    const origin = birthdayOrigin({ ...v, nowYear: now.getFullYear() });
    if (!origin.ok) {
      errors.birthYear = `${origin.year} n’avait pas de 29${NBSP}février${NBSP}: vérifiez l’année ou le jour.`;
    }
  }
  return errors;
}

/**
 * Brouillon pour addCalendarEvent / updateCalendarEvent (null retire un
 * champ). Anniversaire : date d'origine et `yearKnown` selon birthdayDate.ts.
 */
export function toDraft(v: EventFormValues, now: Date): CalendarEventDraft {
  let date = v.date;
  let yearKnown: boolean | null = null;
  if (v.kind === 'anniversaire') {
    const origin = birthdayOrigin({ ...v, nowYear: now.getFullYear() });
    if (origin.ok) {
      date = origin.date;
      yearKnown = origin.yearKnown;
    }
  }
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
    yearKnown,
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
