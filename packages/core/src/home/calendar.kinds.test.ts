/** V4.2 — natures du Calendrier : `voyage` fusionné dans `sortie`, `maison` retiré. */
import { describe, expect, it } from 'vitest';
import { ACTIVE_CALENDAR_KINDS, activeCalendarKind, addEvent, updateEvent, validateCalendar } from './calendar.js';
import type { CalendarEvent } from './calendarTypes.js';

const AT = '2026-10-05T08:00:00.000Z';

const legacy = (kind: CalendarEvent['kind'], id: string): CalendarEvent => ({
  id,
  title: 'Ancien',
  date: '2026-10-10',
  allDay: true,
  kind,
  who: 'both',
  createdAt: AT,
});

describe('natures actives', () => {
  it('cinq natures proposées, sans voyage ni maison', () => {
    expect(ACTIVE_CALENDAR_KINDS).toEqual(['repas', 'sortie', 'anniversaire', 'rdv', 'autre']);
  });

  it('voyage → sortie, maison → autre, le reste inchangé (idempotent)', () => {
    expect(activeCalendarKind('voyage')).toBe('sortie');
    expect(activeCalendarKind('maison')).toBe('autre');
    for (const kind of ACTIVE_CALENDAR_KINDS) expect(activeCalendarKind(activeCalendarKind(kind))).toBe(kind);
  });

  it('les anciens événements restent valides, à l’identique', () => {
    const events = [legacy('voyage', 'v'), legacy('maison', 'm')];
    const result = validateCalendar({ events });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.events).toEqual(events);
  });

  it('une nature ancienne donnée à l’ajout ou à la modification est ramenée aux actuelles', () => {
    const added = addEvent([], { id: 'a', createdAt: AT, title: 'Week-end', date: '2026-10-10', kind: 'voyage' });
    expect(added.ok && added.event.kind).toBe('sortie');
    const events = [legacy('maison', 'm')];
    const same = updateEvent(events, 'm', { title: 'Ancien' });
    expect(same.ok && same.events).toBe(events);
    const changed = updateEvent(events, 'm', { kind: 'maison' });
    expect(changed.ok && changed.event.kind).toBe('autre');
  });
});
