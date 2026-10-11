import { describe, expect, it } from 'vitest';
import { anniversaryEvents, withAnniversaryEvents } from './anniversaries.js';
import type { CalendarEvent } from './calendarTypes.js';
import { escapeIcsText, eventsToIcs, foldIcsLine, googleCalendarUrl, icsFilename } from './ics.js';

const AT = '2026-01-01T08:00:00.000Z';
/** 11 octobre 2026, 10 h locale. */
const NOW = new Date(2026, 9, 11, 10, 0);

function ev(id: string, date: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id, title: id, date, allDay: true, kind: 'autre', who: 'both', createdAt: AT, ...extra };
}

function timed(id: string, date: string, time: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return ev(id, date, { allDay: false, time, ...extra });
}

function query(url: string): Record<string, string> {
  const [base, q = ''] = url.split('?');
  expect(base).toBe('https://calendar.google.com/calendar/render');
  return Object.fromEntries(q.split('&').map((pair) => pair.split('=').map(decodeURIComponent) as [string, string]));
}

describe('googleCalendarUrl', () => {
  it('encode titre, lieu et note (accents, &, retours à la ligne)', () => {
    const e = timed('e1', '2026-10-24', '20:00', { title: 'Dîner & ciné', place: 'Chez Léa, Montreuil', note: 'Dessert\nvin ?', endTime: '22:30' });
    const url = googleCalendarUrl(e, NOW);
    expect(url).not.toMatch(/[ \n]/);
    expect(url).toContain('text=D%C3%AEner%20%26%20cin%C3%A9');
    expect(query(url)).toEqual({
      action: 'TEMPLATE',
      text: 'Dîner & ciné',
      dates: '20261024T200000/20261024T223000',
      details: 'Dessert\nvin ?',
      location: 'Chez Léa, Montreuil',
    });
  });

  it('heure flottante (sans Z) et fin par défaut à +1 h, même à minuit', () => {
    expect(query(googleCalendarUrl(timed('a', '2026-10-24', '09:15'), NOW)).dates).toBe('20261024T091500/20261024T101500');
    expect(query(googleCalendarUrl(timed('b', '2026-12-31', '23:30'), NOW)).dates).toBe('20261231T233000/20270101T003000');
  });

  it('fin avant le début : le lendemain', () => {
    expect(query(googleCalendarUrl(timed('a', '2026-10-24', '22:00', { endTime: '01:00' }), NOW)).dates).toBe('20261024T220000/20261025T010000');
  });

  it('journée entière : date de fin exclusive (lendemain), pas de details/location vides', () => {
    const q = query(googleCalendarUrl(ev('a', '2026-02-28'), NOW));
    expect(q.dates).toBe('20260228/20260301');
    expect(q).not.toHaveProperty('details');
    expect(q).not.toHaveProperty('location');
  });

  it('annuel : prochaine occurrence + récurrence annuelle', () => {
    const passed = ev('Léa', '1991-03-12', { kind: 'anniversaire', yearly: true });
    expect(query(googleCalendarUrl(passed, NOW))).toMatchObject({ dates: '20270312/20270313', recur: 'RRULE:FREQ=YEARLY' });
    const today = ev('Moi', '1990-10-11', { kind: 'anniversaire', yearly: true });
    expect(query(googleCalendarUrl(today, NOW)).dates).toBe('20261011/20261012');
    const leap = ev('Bissextile', '1996-02-29', { yearly: true });
    expect(query(googleCalendarUrl(leap, NOW))).toMatchObject({ dates: '20270228/20270301', recur: 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' });
    expect(query(googleCalendarUrl(ev('x', '2026-03-12'), NOW))).not.toHaveProperty('recur');
  });

  it('titre affiché fourni par l’appelant', () => {
    expect(query(googleCalendarUrl(ev('Léa', '2026-11-02'), NOW, { titleOf: (e) => `Anniversaire de ${e.title}` })).text).toBe('Anniversaire de Léa');
  });
});

describe('escapeIcsText / foldIcsLine', () => {
  it('échappe antislash, point-virgule, virgule et retours à la ligne', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });

  it('plie à 75 octets, sans couper un caractère multi-octet', () => {
    expect(foldIcsLine('x'.repeat(75))).toBe('x'.repeat(75));
    const long = `SUMMARY:${'é'.repeat(60)}🌳${'a'.repeat(50)}`;
    const folded = foldIcsLine(long);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(' ')).toBe(true);
      expect(p).not.toContain('�');
    }
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(long);
  });
});

/** Mini-parseur : déplie, découpe en composants, propriétés (nom;params:valeur). */
function parseIcs(text: string) {
  expect(text.endsWith('\r\n')).toBe(true);
  expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  const lines = text.replace(/\r\n /g, '').split('\r\n').filter((l) => l !== '');
  const stack: { name: string; props: { name: string; params: string; value: string }[]; children: unknown[] }[] = [];
  let root: (typeof stack)[number] | null = null;
  for (const line of lines) {
    const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    if (!m) throw new Error(`ligne illisible : ${line}`);
    const [, name, params, value] = m as unknown as [string, string, string, string];
    if (name === 'BEGIN') {
      const c = { name: value, props: [], children: [] };
      if (stack.length > 0) stack.at(-1)!.children.push(c);
      else root = c;
      stack.push(c);
    } else if (name === 'END') {
      expect(stack.pop()?.name).toBe(value);
    } else {
      stack.at(-1)!.props.push({ name, params: params.slice(1), value });
    }
  }
  expect(stack).toHaveLength(0);
  return root!;
}

function unescape(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

describe('eventsToIcs', () => {
  const events: CalendarEvent[] = [
    timed('e-diner', '2026-10-24', '20:00', { title: 'Dîner, chez Léa; vin', place: 'Montreuil', note: 'Ligne 1\nLigne 2 \\ fin', endTime: '23:00' }),
    timed('e-ciné', '2026-10-25', '18:00'),
    ev('e-week', '2026-11-07'),
    ev('e-anniv', '1991-03-12', { title: 'Léa', kind: 'anniversaire', yearly: true }),
    ev('e-long', '2026-12-01', { title: 'Un titre très long '.repeat(6).trim() }),
  ];
  const text = eventsToIcs(events, { now: new Date(Date.UTC(2026, 9, 11, 8, 5, 9)), titleOf: (e) => (e.kind === 'anniversaire' ? `Anniversaire de ${e.title}` : e.title) });

  it('CRLF partout, lignes ≤ 75 octets', () => {
    expect(text.split('\n').every((l, i, all) => l.endsWith('\r') || i === all.length - 1)).toBe(true);
    for (const l of text.split('\r\n')) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    expect(text).toContain('\r\n ');
  });

  it('relu par un mini-parseur : VCALENDAR + un VEVENT par événement', () => {
    const cal = parseIcs(text);
    expect(cal.name).toBe('VCALENDAR');
    const get = (c: { props: { name: string; params: string; value: string }[] }, n: string) => c.props.find((p) => p.name === n);
    expect(get(cal, 'VERSION')?.value).toBe('2.0');
    expect(get(cal, 'PRODID')).toBeDefined();
    const vevents = cal.children as (typeof cal)[];
    expect(vevents.map((v) => v.name)).toEqual(Array(5).fill('VEVENT'));
    for (const v of vevents) {
      for (const n of ['UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'SUMMARY']) expect(get(v, n), n).toBeDefined();
      expect(get(v, 'DTSTAMP')!.value).toBe('20261011T080509Z');
    }
    const [diner, cine, week, anniv, long] = vevents as [typeof cal, typeof cal, typeof cal, typeof cal, typeof cal];
    expect(get(diner, 'UID')!.value).toBe('e-diner@a2home.invalid');
    expect(get(diner, 'DTSTART')).toEqual({ name: 'DTSTART', params: '', value: '20261024T200000' });
    expect(get(diner, 'DTEND')!.value).toBe('20261024T230000');
    expect(get(diner, 'SUMMARY')!.value).toBe('Dîner\\, chez Léa\\; vin');
    expect(unescape(get(diner, 'SUMMARY')!.value)).toBe('Dîner, chez Léa; vin');
    expect(unescape(get(diner, 'DESCRIPTION')!.value)).toBe('Ligne 1\nLigne 2 \\ fin');
    expect(get(diner, 'LOCATION')!.value).toBe('Montreuil');
    expect(get(cine, 'DTEND')!.value).toBe('20261025T190000');
    expect(get(cine, 'LOCATION')).toBeUndefined();
    expect(get(week, 'DTSTART')).toEqual({ name: 'DTSTART', params: 'VALUE=DATE', value: '20261107' });
    expect(get(week, 'DTEND')).toEqual({ name: 'DTEND', params: 'VALUE=DATE', value: '20261108' });
    expect(get(week, 'RRULE')).toBeUndefined();
    expect(get(anniv, 'DTSTART')!.value).toBe('19910312');
    expect(get(anniv, 'RRULE')!.value).toBe('FREQ=YEARLY');
    expect(get(anniv, 'SUMMARY')!.value).toBe('Anniversaire de Léa');
    expect(get(long, 'SUMMARY')!.value).toBe(events[4]!.title);
  });

  it('UID stables (même événement → même UID, quel que soit l’instant)', () => {
    const uids = (t: string) => t.replace(/\r\n /g, '').split('\r\n').filter((l) => l.startsWith('UID:'));
    const again = eventsToIcs([...events].reverse(), { now: new Date(Date.UTC(2030, 0, 1)) });
    expect(uids(again).sort()).toEqual(uids(text).sort());
    expect(new Set(uids(text)).size).toBe(events.length);
  });

  it('anniversaires de A et B (virtuels) : annuels, 29 février → dernier jour de février', () => {
    const names = { a: 'Arthur', b: 'Alexia' };
    const all = withAnniversaryEvents([], { coupleDay: 19, a: { month: 8, day: 19 }, b: { month: 2, day: 29 } }, names);
    expect(all).toEqual(anniversaryEvents({ coupleDay: 19, a: { month: 8, day: 19 }, b: { month: 2, day: 29 } }, names));
    const t = eventsToIcs(all, { now: NOW });
    expect(t).toContain('UID:anniversaire:a@a2home.invalid\r\n');
    expect(t).toContain('DTSTART;VALUE=DATE:20000819\r\n');
    expect(t).toContain('DTSTART;VALUE=DATE:20000229\r\nDTEND;VALUE=DATE:20000301\r\nRRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1\r\n');
  });

  it('calendrier vide : enveloppe valide', () => {
    const cal = parseIcs(eventsToIcs([], { now: NOW }));
    expect(cal.children).toHaveLength(0);
  });

  it('nom de fichier daté du jour local', () => {
    expect(icsFilename(NOW)).toBe('a2home-calendrier-2026-10-11.ics');
  });
});
