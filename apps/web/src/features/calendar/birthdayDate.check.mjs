/**
 * Test unitaire de la date d'origine d'un anniversaire (logique pure).
 * Usage : node apps/web/src/features/calendar/birthdayDate.check.mjs   (Node ≥ 22.6, types effacés)
 */
import assert from 'node:assert/strict';
import { birthdayOrigin, isLeapYear, leapYearAtOrBefore } from './birthdayDate.ts';

let count = 0;
const check = (input, expected, label) => {
  assert.deepEqual(birthdayOrigin({ originDate: '', initialDate: input.date, nowYear: 2026, birthYear: '', ...input }), expected, label);
  count += 1;
};

assert.equal(isLeapYear(2024), true);
assert.equal(isLeapYear(2026), false);
assert.equal(isLeapYear(1900), false);
assert.equal(isLeapYear(2000), true);
assert.equal(leapYearAtOrBefore(2027), 2024);
assert.equal(leapYearAtOrBefore(2028), 2028);

// Année connue : modifier depuis l'occurrence du 28 février garde le 29.
check({ date: '2026-02-28', initialDate: '2026-02-28', originDate: '1992-02-29', birthYear: '1992' },
  { ok: true, date: '1992-02-29', yearKnown: true }, 'aller-retour du 29 février');
// … mais un jour réellement changé est pris.
check({ date: '2026-03-01', initialDate: '2026-02-28', originDate: '1992-02-29', birthYear: '1992' },
  { ok: true, date: '1992-03-01', yearKnown: true }, 'jour changé');
// Changer l'année de naissance garde le 29 février si l'année le permet.
check({ date: '2026-02-28', initialDate: '2026-02-28', originDate: '1992-02-29', birthYear: '1996' },
  { ok: true, date: '1996-02-29', yearKnown: true }, 'autre année bissextile');
check({ date: '2026-02-28', initialDate: '2026-02-28', originDate: '1992-02-29', birthYear: '1993' },
  { ok: false, reason: 'no-leap-day', year: 1993 }, 'année sans 29 février');
// Ajout : le 29 février 2028 choisi avec une année de naissance 1990 → expliqué.
check({ date: '2028-02-29', birthYear: '1990' }, { ok: false, reason: 'no-leap-day', year: 1990 }, '1990 sans 29 février');
check({ date: '2028-02-29', birthYear: '1992' }, { ok: true, date: '1992-02-29', yearKnown: true }, '29 février 1992');
// Année inconnue : 29 février rangé sur la dernière année bissextile, jamais dans le futur.
check({ date: '2028-02-29' }, { ok: true, date: '2024-02-29', yearKnown: false }, '2028 → 2024');
check({ date: '2024-02-29' }, { ok: true, date: '2024-02-29', yearKnown: false }, '2024 gardé');
check({ date: '2020-02-29' }, { ok: true, date: '2020-02-29', yearKnown: false }, 'origine passée gardée');
check({ date: '2028-02-29', nowYear: 2028 }, { ok: true, date: '2028-02-29', yearKnown: false }, 'année bissextile en cours');
// Année inconnue, autre jour : date telle quelle, sans âge.
check({ date: '2027-03-12' }, { ok: true, date: '2027-03-12', yearKnown: false }, 'autre jour');
check({ date: '2025-05-01' }, { ok: true, date: '2025-05-01', yearKnown: false }, 'origine passée : pas d’âge');
// Modification d'un anniversaire sans année : le jour d'origine reste.
check({ date: '2024-02-29', initialDate: '2024-02-29', originDate: '2024-02-29' },
  { ok: true, date: '2024-02-29', yearKnown: false }, 'sans année, inchangé');

console.log(`birthdayDate : ${count} cas OK`);
