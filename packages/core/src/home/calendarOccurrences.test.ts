import { describe, expect, it } from 'vitest';
import { eventsBetween, eventsOn, nextEvents } from './calendarOccurrences.js';
import type { CalendarEvent } from './calendarTypes.js';

const AT = '2026-01-01T08:00:00.000Z';

function ev(id: string, date: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id, title: id, date, allDay: true, kind: 'autre', who: 'both', createdAt: AT, ...extra };
}

function timed(id: string, date: string, time: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return ev(id, date, { allDay: false, time, ...extra });
}

describe('eventsOn', () => {
  it('trie journée entière puis par heure, puis par titre', () => {
    const events = [
      timed('dîner', '2026-10-10', '20:00'),
      timed('brunch', '2026-10-10', '11:00'),
      ev('Voyage', '2026-10-10'),
      ev('anniv', '2026-10-10'),
      timed('autre jour', '2026-10-11', '09:00'),
    ];
    expect(eventsOn(events, '2026-10-10').map((o) => o.event.id)).toEqual(['anniv', 'Voyage', 'brunch', 'dîner']);
  });

  it('inclut les anniversaires annuels avec le nombre d’années', () => {
    const birthday = ev('AC', '1994-10-10', { kind: 'anniversaire', yearly: true });
    expect(eventsOn([birthday], '2026-10-10')).toEqual([{ event: birthday, date: '2026-10-10', years: 32 }]);
    expect(eventsOn([birthday], '1994-10-10')[0]!.years).toBe(0);
    expect(eventsOn([birthday], '1993-10-10')).toEqual([]);
  });

  it('un 29 février tombe le 28 février les années non bissextiles', () => {
    const leap = ev('leap', '2024-02-29', { yearly: true });
    expect(eventsOn([leap], '2025-02-28')).toHaveLength(1);
    expect(eventsOn([leap], '2025-03-01')).toHaveLength(0);
    expect(eventsOn([leap], '2028-02-29')).toHaveLength(1);
    expect(eventsOn([leap], '2028-02-28')).toHaveLength(0);
    expect(eventsOn([leap], '2100-02-28')).toHaveLength(1); // 2100 n'est pas bissextile
  });

  it('date invalide → aucune occurrence', () => {
    expect(eventsOn([ev('a', '2026-10-10')], '2026-13-01')).toEqual([]);
  });
});

describe('eventsBetween', () => {
  it('bornes incluses, triées par date, annuels sur plusieurs années', () => {
    const events = [
      ev('fin', '2026-10-31'),
      ev('début', '2026-10-01'),
      ev('hors', '2026-11-01'),
      ev('rencontre', '2020-12-31', { yearly: true }),
    ];
    const october = eventsBetween(events, '2026-10-01', '2026-10-31');
    expect(october.map((o) => o.event.id)).toEqual(['début', 'fin']);
    const span = eventsBetween(events, '2025-12-01', '2027-12-31').filter((o) => o.event.id === 'rencontre');
    expect(span.map((o) => [o.date, o.years])).toEqual([['2025-12-31', 5], ['2026-12-31', 6], ['2027-12-31', 7]]);
  });

  it('intervalle inversé ou invalide → []', () => {
    expect(eventsBetween([ev('a', '2026-10-10')], '2026-10-31', '2026-10-01')).toEqual([]);
    expect(eventsBetween([ev('a', '2026-10-10')], 'x', '2026-10-01')).toEqual([]);
  });

  it('ne mute pas la liste d’entrée', () => {
    const events = [ev('b', '2026-10-02'), ev('a', '2026-10-01')];
    eventsBetween(events, '2026-10-01', '2026-10-31');
    expect(events.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('nextEvents', () => {
  const now = new Date(2026, 9, 5, 14, 30); // lundi 5 octobre 2026, 14 h 30

  it('garde ce qui n’est pas terminé aujourd’hui puis les jours suivants', () => {
    const events = [
      timed('matin fini', '2026-10-05', '09:00'),
      timed('déjeuner en cours', '2026-10-05', '13:00', { endTime: '15:00' }),
      timed('soirée', '2026-10-05', '20:00'),
      timed('nuit blanche', '2026-10-05', '12:00', { endTime: '02:00' }),
      ev('toute la journée', '2026-10-05'),
      ev('hier', '2026-10-04'),
      ev('demain', '2026-10-06'),
    ];
    expect(nextEvents(events, now, 10).map((o) => o.event.id))
      .toEqual(['toute la journée', 'nuit blanche', 'déjeuner en cours', 'soirée', 'demain']);
  });

  it('limite à n, et n invalide → []', () => {
    const events = [ev('a', '2026-10-06'), ev('b', '2026-10-07'), ev('c', '2026-10-08')];
    expect(nextEvents(events, now, 2).map((o) => o.event.id)).toEqual(['a', 'b']);
    expect(nextEvents(events, now, 0)).toEqual([]);
    expect(nextEvents(events, now, Number.NaN)).toEqual([]);
  });

  it('un annuel apparaît une fois, à sa prochaine occurrence (l’an prochain si passée)', () => {
    const past = ev('passé', '1990-03-01', { yearly: true });
    const soon = ev('bientôt', '1990-10-20', { yearly: true });
    const future = ev('futur lointain', '2030-01-01', { yearly: true });
    const r = nextEvents([past, soon, future], now, 10);
    expect(r.map((o) => [o.event.id, o.date])).toEqual([
      ['bientôt', '2026-10-20'],
      ['passé', '2027-03-01'],
      ['futur lointain', '2030-01-01'],
    ]);
  });

  it('un annuel horaire déjà passé aujourd’hui revient l’an prochain', () => {
    const r = nextEvents([timed('apéro', '2020-10-05', '10:00', { yearly: true })], now, 1);
    expect(r[0]!.date).toBe('2027-10-05');
  });
});
