/**
 * Date d'origine d'un anniversaire saisi dans la feuille (logique pure, sans
 * dépendance ; testée par `birthdayDate.check.mjs`,
 * `node apps/web/src/features/calendar/birthdayDate.check.mjs`).
 *
 * Le 29 février demande un peu de soin :
 * - année de naissance connue : on garde toujours le mois et le jour
 *   d'origine. Modifier l'anniversaire depuis son occurrence du 28 février
 *   (année non bissextile) ne le déplace jamais au 28 février pour de bon ;
 *   une année de naissance sans 29 février est signalée gentiment ;
 * - année inconnue : le 29 février est rangé sur la dernière année
 *   bissextile (jamais dans le futur), pour qu'il soit fêté dès cette année
 *   (le 28 février les années non bissextiles), sans âge affiché.
 */

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Dernière année bissextile ≤ `year`. */
export function leapYearAtOrBefore(year: number): number {
  let y = year;
  while (!isLeapYear(y)) y -= 1;
  return y;
}

export interface BirthdayInput {
  /** Jour choisi dans le formulaire « YYYY-MM-DD ». */
  date: string;
  /** Jour montré à l'ouverture de la feuille (occurrence touchée). */
  initialDate: string;
  /** Date d'origine de l'événement modifié ('' pour un ajout). */
  originDate: string;
  /** Année de naissance saisie (« 1991 ») ou ''. */
  birthYear: string;
  /** Année en cours (horloge locale). */
  nowYear: number;
}

export type BirthdayOrigin =
  | { ok: true; date: string; yearKnown: boolean }
  | { ok: false; reason: 'no-leap-day'; year: number };

/** Mois et jour retenus : ceux d'origine tant que le jour n'a pas été touché. */
function monthDayOf(input: BirthdayInput): string {
  const untouched = input.originDate !== '' && input.date === input.initialDate;
  return (untouched ? input.originDate : input.date).slice(5);
}

/** Date d'origine à enregistrer pour un anniversaire. */
export function birthdayOrigin(input: BirthdayInput): BirthdayOrigin {
  const monthDay = monthDayOf(input);
  const year = input.birthYear.trim();
  if (/^\d{4}$/.test(year)) {
    const y = Number(year);
    if (monthDay === '02-29' && !isLeapYear(y)) return { ok: false, reason: 'no-leap-day', year: y };
    return { ok: true, date: `${year}-${monthDay}`, yearKnown: true };
  }
  if (monthDay === '02-29') {
    const chosen = Number(input.date.slice(0, 4));
    const y = leapYearAtOrBefore(Math.min(chosen, input.nowYear));
    return { ok: true, date: `${String(y).padStart(4, '0')}-02-29`, yearKnown: false };
  }
  return { ok: true, date: `${input.date.slice(0, 4)}-${monthDay}`, yearKnown: false };
}
