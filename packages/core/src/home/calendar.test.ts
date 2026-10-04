import { describe, expect, it } from 'vitest';
import {
  addEvent,
  CALENDAR_EVENTS_MAX,
  CALENDAR_TITLE_MAX,
  removeEvent,
  restoreEvent,
  updateEvent,
  validateCalendar,
  validateCalendarEvent,
} from './calendar.js';
import type { CalendarEvent } from './calendarTypes.js';

const AT = '2026-10-05T08:00:00.000Z';

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`attendu ok : ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
}

const dinner: CalendarEvent = {
  id: 'e1',
  title: 'Dîner chez Léa',
  date: '2026-10-10',
  time: '20:00',
  allDay: false,
  kind: 'repas',
  who: 'both',
  place: 'Lyon',
  createdAt: AT,
};

describe('addEvent', () => {
  it('ajoute un événement normalisé avec des valeurs par défaut douces', () => {
    const r = ok(addEvent([], { id: 'x', createdAt: AT, title: '  Ciné   du  soir ', date: '2026-10-12' }));
    expect(r.event).toEqual({
      id: 'x', title: 'Ciné du soir', date: '2026-10-12', allDay: true, kind: 'autre', who: 'both', createdAt: AT,
    });
    expect(r.events).toHaveLength(1);
  });

  it('passe en horaire quand une heure est donnée, garde la fin', () => {
    const r = ok(addEvent([], {
      id: 'x', createdAt: AT, title: 'Resto', date: '2026-10-12', time: '19:30', endTime: '22:00', kind: 'sortie', who: 'a',
    }));
    expect(r.event).toMatchObject({ allDay: false, time: '19:30', endTime: '22:00', who: 'a' });
  });

  it('retire les heures si allDay est vrai', () => {
    const r = ok(addEvent([], { id: 'x', createdAt: AT, title: 'Voyage', date: '2026-10-12', time: '10:00', allDay: true }));
    expect(r.event.time).toBeUndefined();
    expect(r.event.endTime).toBeUndefined();
  });

  it('un anniversaire est annuel par défaut, désactivable', () => {
    expect(ok(addEvent([], { id: 'x', createdAt: AT, title: 'AC', date: '1996-02-29', kind: 'anniversaire' })).event.yearly).toBe(true);
    expect(ok(addEvent([], { id: 'x', createdAt: AT, title: 'AC', date: '1994-03-01', kind: 'anniversaire', yearly: false })).event.yearly)
      .toBeUndefined();
  });

  it('nettoie lieu et note, omet les vides, garde les retours à la ligne', () => {
    const r = ok(addEvent([], { id: 'x', createdAt: AT, title: 'T', date: '2026-10-12', place: '   ', note: ' apporter\r\nle dessert ' }));
    expect(r.event.place).toBeUndefined();
    expect(r.event.note).toBe('apporter\nle dessert');
  });

  it('tronque un titre trop long', () => {
    const r = ok(addEvent([], { id: 'x', createdAt: AT, title: 'a'.repeat(300), date: '2026-10-12' }));
    expect(r.event.title).toHaveLength(CALENDAR_TITLE_MAX);
  });

  it.each([
    [{ title: '   ', date: '2026-10-12' }, 'calendar-event-invalid-title'],
    [{ title: 'T', date: '2026-02-30' }, 'calendar-event-invalid-date'],
    [{ title: 'T', date: '2026-10-12', time: '24:00' }, 'calendar-event-invalid-time'],
    [{ title: 'T', date: '2026-10-12', allDay: false }, 'calendar-event-invalid-time'],
    [{ title: 'T', date: '2026-10-12', time: '10:00', endTime: '10:00' }, 'calendar-event-invalid-end-time'],
    [{ title: 'T', date: '2026-10-12', kind: 'fête' as never }, 'calendar-event-invalid-kind'],
  ])('refuse une saisie invalide %#', (draft, reason) => {
    expect(addEvent([], { id: 'x', createdAt: AT, ...draft })).toEqual({ ok: false, reason });
  });

  it('refuse un id déjà présent et un calendrier plein (jamais d’oubli silencieux)', () => {
    expect(addEvent([dinner], { id: 'e1', createdAt: AT, title: 'T', date: '2026-10-12' }))
      .toEqual({ ok: false, reason: 'duplicate-calendar-event-id' });
    const full = Array.from({ length: CALENDAR_EVENTS_MAX }, (_, i) => ({ ...dinner, id: `e${i}` }));
    expect(addEvent(full, { id: 'new', createdAt: AT, title: 'T', date: '2026-10-12' }))
      .toEqual({ ok: false, reason: 'calendar-full' });
  });

  it('ne mute jamais son entrée', () => {
    const events = [dinner];
    const frozen = structuredClone(events);
    ok(addEvent(events, { id: 'x', createdAt: AT, title: 'T', date: '2026-10-12' }));
    expect(events).toEqual(frozen);
  });
});

describe('updateEvent', () => {
  it('modifie un champ, garde id et createdAt', () => {
    const r = ok(updateEvent([dinner], 'e1', { title: 'Dîner chez Léa et Tom', id: 'zz' } as never));
    expect(r.event).toMatchObject({ id: 'e1', createdAt: AT, title: 'Dîner chez Léa et Tom', time: '20:00' });
  });

  it('patch sans effet → même référence', () => {
    const events = [dinner];
    expect(ok(updateEvent(events, 'e1', {})).events).toBe(events);
    expect(ok(updateEvent(events, 'e1', { title: 'Dîner chez Léa' })).events).toBe(events);
  });

  it('time: null repasse en journée entière, une heure repasse en horaire', () => {
    const allDay = ok(updateEvent([{ ...dinner, endTime: '23:00' }], 'e1', { time: null })).event;
    expect(allDay).toMatchObject({ allDay: true });
    expect(allDay.time).toBeUndefined();
    expect(allDay.endTime).toBeUndefined();
    const timed = ok(updateEvent([allDay], 'e1', { time: '12:30' })).event;
    expect(timed).toMatchObject({ allDay: false, time: '12:30' });
  });

  it('null retire lieu, note et répétition annuelle', () => {
    const base = { ...dinner, note: 'n', yearly: true };
    const r = ok(updateEvent([base], 'e1', { place: null, note: null, yearly: null })).event;
    expect(r.place).toBeUndefined();
    expect(r.note).toBeUndefined();
    expect(r.yearly).toBeUndefined();
  });

  it('id inconnu ou patch invalide → refus, sans changement', () => {
    expect(updateEvent([dinner], 'nope', { title: 'x' })).toEqual({ ok: false, reason: 'calendar-event-not-found' });
    expect(updateEvent([dinner], 'e1', { date: 'demain' })).toEqual({ ok: false, reason: 'calendar-event-invalid-date' });
  });
});

describe('removeEvent / restoreEvent', () => {
  const second: CalendarEvent = { ...dinner, id: 'e2', title: 'Second' };
  const third: CalendarEvent = { ...dinner, id: 'e3', title: 'Troisième' };

  it('retire puis restaure à la même place', () => {
    const events = [dinner, second, third];
    const r = removeEvent(events, 'e2');
    expect(r.events.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(r.removed).toEqual({ event: second, index: 1 });
    expect(restoreEvent(r.events, r.removed!)).toEqual(events);
  });

  it('id inconnu → même référence ; restauration en double → même référence', () => {
    const events = [dinner];
    expect(removeEvent(events, 'nope')).toEqual({ events, removed: null });
    expect(restoreEvent(events, { event: dinner, index: 0 })).toBe(events);
  });

  it('borne l’index de restauration', () => {
    expect(restoreEvent([dinner], { event: second, index: 99 }).map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(restoreEvent([dinner], { event: second, index: -4 }).map((e) => e.id)).toEqual(['e2', 'e1']);
  });
});

describe('validation', () => {
  it('un événement valide ressort identique', () => {
    const full: CalendarEvent = { ...dinner, endTime: '01:00', note: 'ligne 1\nligne 2', yearly: false };
    expect(validateCalendarEvent(full)).toEqual({ ok: true, state: full });
  });

  it.each([
    [{ ...dinner, allDay: true }, 'calendar-event-all-day-with-time'],
    [{ ...dinner, time: undefined }, 'calendar-event-invalid-time'],
    [{ ...dinner, endTime: '25:00' }, 'calendar-event-invalid-end-time'],
    [{ ...dinner, who: 'c' }, 'calendar-event-invalid-who'],
    [{ ...dinner, createdAt: '2026-10-05' }, 'calendar-event-invalid-created-at'],
    [{ ...dinner, yearly: 'oui' }, 'calendar-event-invalid-yearly'],
    [{ ...dinner, place: 3 }, 'calendar-event-invalid-place'],
  ])('raison stable pour un événement invalide %#', (value, reason) => {
    expect(validateCalendarEvent(value)).toEqual({ ok: false, reason });
  });

  it('calendrier : ids uniques, au plus 2000 événements', () => {
    expect(validateCalendar({ events: [dinner, dinner] })).toEqual({ ok: false, reason: 'duplicate-calendar-event-id' });
    expect(validateCalendar({ events: 'x' })).toEqual({ ok: false, reason: 'calendar-events-not-array' });
    const many = Array.from({ length: CALENDAR_EVENTS_MAX + 1 }, (_, i) => ({ ...dinner, id: `e${i}` }));
    expect(validateCalendar({ events: many })).toEqual({ ok: false, reason: 'calendar-too-many-events' });
  });
});
