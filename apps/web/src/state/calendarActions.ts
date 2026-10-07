/**
 * Actions du Calendrier commun (V3.2) du store. Même sémantique que les
 * autres actions : transition PURE via `transact` (id et horloge capturés
 * avant, sûr en StrictMode), résultat synchrone, écriture sérialisée par le
 * store. Le calendrier (`appState.calendar`) n'apparaît qu'au premier ajout.
 * V4.3 : le réglage des anniversaires (`appState.anniversaries`) vit ici aussi.
 */
import { useCallback, useMemo } from 'react';
import {
  addEvent,
  removeEvent,
  restoreEvent,
  updateEvent,
  validateAnniversaries,
  type Anniversaries,
  type AppState,
  type CalendarEvent,
  type CalendarEventDraft,
  type CalendarEventPatch,
  type RemovedCalendarEvent,
} from '@a2/core';
import { newId } from './ids';
import type { Transact } from './careActions';

export type { RemovedCalendarEvent } from '@a2/core';

/** Résultat d'un ajout / d'une modification (raison stable si refus). */
export type CalendarActionResult =
  | { ok: true; event: CalendarEvent }
  | { ok: false; reason: string };

export interface CalendarActions {
  /**
   * Ajoute un événement partagé. Refus (raison stable) si la saisie est
   * invalide ou si le calendrier est plein (2000 événements).
   */
  addCalendarEvent: (draft: CalendarEventDraft) => CalendarActionResult;
  /** Modifie un événement (null retire un champ facultatif). */
  updateCalendarEvent: (id: string, patch: CalendarEventPatch) => CalendarActionResult;
  /** Retire un événement ; renvoie de quoi annuler (null si inconnu). */
  removeCalendarEvent: (id: string) => RemovedCalendarEvent | null;
  /** Annule un retrait (même position). false si rien n'a été remis. */
  restoreCalendarEvent: (removed: RemovedCalendarEvent) => boolean;
  /** V4.3 — anniversaires (Réglages) : remplace le réglage ; false s'il est invalide. */
  setAnniversaries: (next: Anniversaries) => boolean;
}

function withEvents(s: AppState, events: CalendarEvent[]): AppState {
  return { ...s, calendar: { ...s.calendar, events } };
}

export function useCalendarActions(transact: Transact): CalendarActions {
  const addCalendarEvent = useCallback(
    (draft: CalendarEventDraft): CalendarActionResult => {
      const id = newId();
      const createdAt = new Date().toISOString();
      return transact<CalendarActionResult>((s) => {
        const r = addEvent(s.calendar?.events ?? [], { ...draft, id, createdAt });
        if (!r.ok) return { state: s, result: r };
        return { state: withEvents(s, r.events), result: { ok: true, event: r.event } };
      }, { ok: false, reason: 'not-ready' });
    },
    [transact],
  );

  const updateCalendarEvent = useCallback(
    (id: string, patch: CalendarEventPatch): CalendarActionResult =>
      transact<CalendarActionResult>((s) => {
        const events = s.calendar?.events ?? [];
        const r = updateEvent(events, id, patch);
        if (!r.ok) return { state: s, result: r };
        return {
          state: r.events === events ? s : withEvents(s, r.events),
          result: { ok: true, event: r.event },
        };
      }, { ok: false, reason: 'not-ready' }),
    [transact],
  );

  const removeCalendarEvent = useCallback(
    (id: string): RemovedCalendarEvent | null =>
      transact<RemovedCalendarEvent | null>((s) => {
        const r = removeEvent(s.calendar?.events ?? [], id);
        if (r.removed === null) return { state: s, result: null };
        return { state: withEvents(s, r.events), result: r.removed };
      }, null),
    [transact],
  );

  const restoreCalendarEvent = useCallback(
    (removed: RemovedCalendarEvent): boolean =>
      transact((s) => {
        const events = s.calendar?.events ?? [];
        const next = restoreEvent(events, removed);
        if (next === events) return { state: s, result: false };
        return { state: withEvents(s, next), result: true };
      }, false),
    [transact],
  );

  const setAnniversaries = useCallback(
    (next: Anniversaries): boolean => {
      const checked = validateAnniversaries(next);
      if (!checked.ok) return false;
      return transact((s) => ({ state: { ...s, anniversaries: checked.state }, result: true }), false);
    },
    [transact],
  );

  // Objet stable : le contexte du store ne se recalcule pas à chaque rendu.
  return useMemo(
    () => ({ addCalendarEvent, updateCalendarEvent, removeCalendarEvent, restoreCalendarEvent, setAnniversaries }),
    [addCalendarEvent, updateCalendarEvent, removeCalendarEvent, restoreCalendarEvent, setAnniversaries],
  );
}
