import { describe, expect, it } from 'vitest';
import {
  anniversaryEvents,
  coupleDayLabel,
  coupleDaysBetween,
  DEFAULT_ANNIVERSARIES,
  defaultAnniversaries,
  fetesOn,
  isAnniversaryEventId,
  isCoupleDay,
  monthDayLabel,
  nextAnniversary,
  parseCoupleDay,
  parseMonthDay,
  validateAnniversaries,
  withAnniversaries,
  withAnniversaryEvents,
  type Anniversaries,
} from './anniversaries.js';
import { emptyAppState, validateAppState } from './appState.js';
import { eventsBetween, nextEvents } from './calendarOccurrences.js';
import type { CalendarEvent } from './calendarTypes.js';

const ANNIV: Anniversaries = defaultAnniversaries();
const NAMES = { a: 'AL', b: 'AC' };

describe('réglage et migration', () => {
  it('préremplit le 19 de chaque mois, AL le 19 août, AC le 27 décembre', () => {
    expect(DEFAULT_ANNIVERSARIES).toEqual({ coupleDay: 19, a: { month: 8, day: 19 }, b: { month: 12, day: 27 } });
    const app = emptyAppState();
    expect(app.anniversaries).toBeUndefined();
    const migrated = withAnniversaries(app);
    expect(migrated.anniversaries).toEqual(DEFAULT_ANNIVERSARIES);
    expect(app.anniversaries).toBeUndefined();
  });

  it('est idempotente : un réglage présent ressort tel quel (même référence)', () => {
    const once = withAnniversaries(emptyAppState());
    expect(withAnniversaries(once)).toBe(once);
    const custom = { ...once, anniversaries: { coupleDay: 3, a: { month: 1, day: 2 }, b: { month: 2, day: 29 } } };
    expect(withAnniversaries(custom)).toBe(custom);
  });

  it('validateAppState accepte l’absence, garde un réglage valide, refuse un réglage invalide', () => {
    const app = emptyAppState();
    const plain = validateAppState(JSON.parse(JSON.stringify(app)));
    expect(plain.ok && plain.state.anniversaries).toBeUndefined();
    const withIt = validateAppState(JSON.parse(JSON.stringify(withAnniversaries(app))));
    expect(withIt.ok && withIt.state.anniversaries).toEqual(DEFAULT_ANNIVERSARIES);
    const bad = validateAppState({ ...JSON.parse(JSON.stringify(app)), anniversaries: { coupleDay: 32, a: ANNIV.a, b: ANNIV.b } });
    expect(bad).toEqual({ ok: false, reason: 'anniversaries-invalid-couple-day' });
  });

  it('valide mois et jour (29 février permis, 30 février non), ignore les champs inconnus', () => {
    expect(validateAnniversaries({ coupleDay: 31, a: { month: 2, day: 29 }, b: { month: 12, day: 31 }, x: 1 })).toEqual({
      ok: true,
      state: { coupleDay: 31, a: { month: 2, day: 29 }, b: { month: 12, day: 31 } },
    });
    expect(validateAnniversaries({ coupleDay: 19, a: { month: 2, day: 30 }, b: ANNIV.b })).toEqual({ ok: false, reason: 'anniversaries-invalid-a' });
    expect(validateAnniversaries({ coupleDay: 19, a: ANNIV.a, b: { month: 13, day: 1 } })).toEqual({ ok: false, reason: 'anniversaries-invalid-b' });
    expect(validateAnniversaries({ coupleDay: 0, a: ANNIV.a, b: ANNIV.b }).ok).toBe(false);
    expect(validateAnniversaries(null)).toEqual({ ok: false, reason: 'anniversaries-not-object' });
  });
});

describe('quelle fête aujourd’hui', () => {
  it('le 19 de chaque mois : le couple ; AL le 19 août (et le couple) ; AC le 27 décembre', () => {
    expect(fetesOn(ANNIV, '2026-10-19')).toEqual(['couple']);
    expect(fetesOn(ANNIV, '2027-01-19')).toEqual(['couple']);
    expect(fetesOn(ANNIV, '2026-08-19')).toEqual(['a', 'couple']);
    expect(fetesOn(ANNIV, '2026-12-27')).toEqual(['b']);
    expect(fetesOn(ANNIV, '2026-10-08')).toEqual([]);
    expect(isCoupleDay(ANNIV, '2026-11-19')).toBe(true);
    expect(isCoupleDay(ANNIV, '2026-11-18')).toBe(false);
  });

  it('sans réglage ou date invalide : aucune fête', () => {
    expect(fetesOn(undefined, '2026-10-19')).toEqual([]);
    expect(fetesOn(ANNIV, '2026-02-30')).toEqual([]);
  });

  it('jour du couple 31 : le dernier jour des mois plus courts', () => {
    const late = { ...ANNIV, coupleDay: 31 };
    expect(isCoupleDay(late, '2026-04-30')).toBe(true);
    expect(isCoupleDay(late, '2026-02-28')).toBe(true);
    expect(isCoupleDay(late, '2028-02-28')).toBe(false);
    expect(isCoupleDay(late, '2028-02-29')).toBe(true);
    expect(isCoupleDay(late, '2026-05-31')).toBe(true);
  });

  it('29 février : le 28 les années non bissextiles', () => {
    const leap = { ...ANNIV, b: { month: 2, day: 29 } };
    expect(fetesOn(leap, '2027-02-28')).toEqual(['b']);
    expect(fetesOn(leap, '2028-02-28')).toEqual([]);
    expect(fetesOn(leap, '2028-02-29')).toEqual(['b']);
  });
});

describe('prochaines dates', () => {
  it('couple : ce mois-ci si le jour n’est pas passé, sinon le mois suivant (année comprise)', () => {
    expect(nextAnniversary(ANNIV, 'couple', '2026-10-08')).toBe('2026-10-19');
    expect(nextAnniversary(ANNIV, 'couple', '2026-10-19')).toBe('2026-10-19');
    expect(nextAnniversary(ANNIV, 'couple', '2026-12-20')).toBe('2027-01-19');
    expect(nextAnniversary({ ...ANNIV, coupleDay: 31 }, 'couple', '2026-02-01')).toBe('2026-02-28');
  });

  it('A et B : cette année, sinon l’an prochain', () => {
    expect(nextAnniversary(ANNIV, 'a', '2026-10-08')).toBe('2027-08-19');
    expect(nextAnniversary(ANNIV, 'b', '2026-10-08')).toBe('2026-12-27');
    expect(nextAnniversary(ANNIV, 'b', '2026-12-27')).toBe('2026-12-27');
    expect(nextAnniversary({ ...ANNIV, a: { month: 2, day: 29 } }, 'a', '2026-03-01')).toBe('2027-02-28');
    expect(nextAnniversary(ANNIV, 'a', 'hier')).toBeNull();
  });

  it('jours du couple sur un intervalle (grille du mois)', () => {
    expect(coupleDaysBetween(ANNIV, '2026-09-28', '2026-11-08')).toEqual(['2026-10-19']);
    expect(coupleDaysBetween(ANNIV, '2026-11-19', '2027-01-19')).toEqual(['2026-11-19', '2026-12-19', '2027-01-19']);
    expect(coupleDaysBetween(ANNIV, '2026-10-20', '2026-11-18')).toEqual([]);
    expect(coupleDaysBetween(undefined, '2026-10-01', '2026-10-31')).toEqual([]);
    expect(coupleDaysBetween(ANNIV, '2026-10-31', '2026-10-01')).toEqual([]);
  });
});

describe('saisie et libellés', () => {
  it('lit les dates en français', () => {
    expect(parseMonthDay('19 août')).toEqual({ month: 8, day: 19 });
    expect(parseMonthDay('19 aout')).toEqual({ month: 8, day: 19 });
    expect(parseMonthDay('  27   Décembre ')).toEqual({ month: 12, day: 27 });
    expect(parseMonthDay('27 déc.')).toEqual({ month: 12, day: 27 });
    expect(parseMonthDay('le 1er mai')).toEqual({ month: 5, day: 1 });
    expect(parseMonthDay('19/08')).toEqual({ month: 8, day: 19 });
    expect(parseMonthDay('3-2')).toEqual({ month: 2, day: 3 });
    expect(parseMonthDay('29 février')).toEqual({ month: 2, day: 29 });
    expect(parseMonthDay('30 février')).toBeNull();
    expect(parseMonthDay('19 jui')).toBeNull();
    expect(parseMonthDay('19 juil')).toEqual({ month: 7, day: 19 });
    expect(parseMonthDay('demain')).toBeNull();
  });

  it('lit le jour du couple', () => {
    expect(parseCoupleDay('19')).toBe(19);
    expect(parseCoupleDay('tous les 19')).toBe(19);
    expect(parseCoupleDay('le 19 de chaque mois')).toBe(19);
    expect(parseCoupleDay('le 1er')).toBe(1);
    expect(parseCoupleDay('tous les 1ers')).toBe(1);
    expect(parseCoupleDay('32')).toBeNull();
    expect(parseCoupleDay('dix-neuf')).toBeNull();
  });

  it('affiche « 19 août », « 1er mai », « tous les 19 »', () => {
    expect(monthDayLabel({ month: 8, day: 19 })).toBe('19 août');
    expect(monthDayLabel({ month: 5, day: 1 })).toBe('1er mai');
    expect(coupleDayLabel(19)).toBe('tous les 19');
    expect(coupleDayLabel(1)).toBe('tous les 1ers');
    for (const md of [{ month: 8, day: 19 }, { month: 12, day: 27 }, { month: 5, day: 1 }]) {
      expect(parseMonthDay(monthDayLabel(md))).toEqual(md);
    }
    expect(parseCoupleDay(coupleDayLabel(19))).toBe(19);
    expect(parseCoupleDay(coupleDayLabel(1))).toBe(1);
  });
});

describe('événements virtuels du calendrier', () => {
  const lea: CalendarEvent = {
    id: 'e1', title: 'Léa', date: '1991-03-02', allDay: true, kind: 'anniversaire', who: 'both', yearly: true, createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('AL et AC en annuels, sans âge, ids reconnaissables', () => {
    const [a, b] = anniversaryEvents(ANNIV, NAMES);
    expect(a).toMatchObject({ title: 'AL', date: '2000-08-19', kind: 'anniversaire', who: 'a', yearly: true, yearKnown: false, allDay: true });
    expect(b).toMatchObject({ title: 'AC', date: '2000-12-27', who: 'b' });
    expect(isAnniversaryEventId(a!.id)).toBe(true);
    expect(isAnniversaryEventId('e1')).toBe(false);
  });

  it('s’ajoutent aux événements sans jamais les modifier, sans doublon d’un anniversaire saisi', () => {
    const events = [lea];
    const all = withAnniversaryEvents(events, ANNIV, NAMES);
    expect(events).toEqual([lea]);
    expect(all.map((e) => e.id)).toEqual(['e1', 'anniversaire:a', 'anniversaire:b']);
    const manual: CalendarEvent = { ...lea, id: 'e2', title: 'AC', date: '1990-12-27', who: 'b' };
    expect(withAnniversaryEvents([manual], ANNIV, NAMES).map((e) => e.id)).toEqual(['e2', 'anniversaire:a']);
    expect(withAnniversaryEvents(events, undefined, NAMES)).toBe(events);
  });

  it('apparaissent dans les occurrences (mois, À venir)', () => {
    const all = withAnniversaryEvents([], ANNIV, NAMES);
    expect(eventsBetween(all, '2026-12-01', '2026-12-31').map((o) => [o.event.id, o.date])).toEqual([['anniversaire:b', '2026-12-27']]);
    const next = nextEvents(all, new Date(2026, 9, 8, 12), 5).map((o) => o.date);
    expect(next).toEqual(['2026-12-27', '2027-08-19']);
  });
});
