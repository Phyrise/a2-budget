import { describe, expect, it } from 'vitest';
import { addEvent, updateEvent, validateCalendarEvent } from './calendar.js';
import { eventsBetween } from './calendarOccurrences.js';
import type { CalendarEvent } from './calendarTypes.js';

const AT = '2026-10-05T08:00:00.000Z';

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`attendu ok : ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
}

describe('yearKnown (année d’origine réellement connue)', () => {
  it('est conservé tel quel, vrai ou faux, et retiré par null', () => {
    const known = ok(addEvent([], { id: 'a', createdAt: AT, title: 'Léa', date: '1992-02-29', kind: 'anniversaire', yearKnown: true }));
    expect(known.event.yearKnown).toBe(true);
    const unknown = ok(addEvent([], { id: 'b', createdAt: AT, title: 'Léa', date: '2024-02-29', kind: 'anniversaire', yearKnown: false }));
    expect(unknown.event.yearKnown).toBe(false);
    expect(validateCalendarEvent(unknown.event)).toEqual({ ok: true, state: unknown.event });
    const cleared = ok(updateEvent(unknown.events, 'b', { yearKnown: null })).event;
    expect('yearKnown' in cleared).toBe(false);
  });

  it('hérite de la valeur précédente quand le patch ne le mentionne pas', () => {
    const r = ok(addEvent([], { id: 'a', createdAt: AT, title: 'Léa', date: '2024-02-29', kind: 'anniversaire', yearKnown: false }));
    const same = updateEvent(r.events, 'a', { title: 'Léa' });
    expect(ok(same).events).toBe(r.events);
    expect(ok(updateEvent(r.events, 'a', { title: 'Léa M.' })).event.yearKnown).toBe(false);
  });

  it('refuse une valeur qui n’est pas un booléen', () => {
    const e = { id: 'a', title: 'Léa', date: '2024-02-29', allDay: true, kind: 'anniversaire', who: 'both', createdAt: AT, yearKnown: 'oui' };
    expect(validateCalendarEvent(e)).toEqual({ ok: false, reason: 'calendar-event-invalid-year-known' });
  });

  it('un 29 février sans année rangé sur 2024 se fête chaque année (28 février sinon)', () => {
    const e: CalendarEvent = {
      id: 'a', title: 'Léa', date: '2024-02-29', allDay: true, kind: 'anniversaire', who: 'both',
      yearly: true, yearKnown: false, createdAt: AT,
    };
    expect(eventsBetween([e], '2027-01-01', '2027-12-31').map((o) => o.date)).toEqual(['2027-02-28']);
    expect(eventsBetween([e], '2028-01-01', '2028-12-31').map((o) => o.date)).toEqual(['2028-02-29']);
  });

  it('modifier le titre d’un anniversaire du 29 février garde le 29 février', () => {
    const r = ok(addEvent([], { id: 'a', createdAt: AT, title: 'Léa', date: '1992-02-29', kind: 'anniversaire', yearKnown: true }));
    const after = ok(updateEvent(r.events, 'a', { title: 'Léa M.', date: '1992-02-29' })).event;
    expect(after.date).toBe('1992-02-29');
  });
});
