/**
 * Dates locales — domaine Maison/Forêt.
 *
 * Toutes les dates du domaine Maison sont des **dates locales** (fuseau de
 * l'utilisateur), jamais UTC. Les clés sont des chaînes « YYYY-MM-DD »
 * calculées à partir des composantes locales (getFullYear/getMonth/getDate),
 * ce qui rend les calculs insensibles aux transitions d'heure (DST) : on
 * n'ajoute jamais de secondes/UTC, on décale des jours calendaires.
 */

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Clé locale « YYYY-MM-DD » d'une date (jamais UTC). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: Date): number {
  const js = date.getDay(); // 0 = dimanche … 6 = samedi
  return js === 0 ? 7 : js;
}

/** Nombre de jours du mois de la date (28/29/30/31). */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Décale une date de `days` jours calendaires dans le fuseau local.
 * Sans dérive DST : on reconstruit la date à minuit local puis on décale le
 * jour, donc +1 jour avance toujours d'un jour calendaire.
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Début de semaine (lundi) de la date, à minuit local. */
export function startOfWeek(date: Date): Date {
  const weekday = isoWeekday(date); // 1 = lundi … 7 = dimanche
  return addDays(date, -(weekday - 1));
}

/**
 * Parse une clé locale « YYYY-MM-DD » en Date à minuit local.
 * Lève une RangeError si la clé est mal formée ou si la date n'existe pas
 * (ex. « 2026-02-30 »).
 */
export function parseLocalDateKey(key: string): Date {
  const m = DATE_KEY_RE.exec(key);
  if (m === null) throw new RangeError(`invalid local date key: ${String(key)}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    throw new RangeError(`invalid local date key: ${String(key)}`);
  }
  return date;
}

/** Vrai si la clé « YYYY-MM-DD » est une date locale valide. */
export function isValidLocalDateKey(key: string): boolean {
  try {
    parseLocalDateKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Comparaison lexicographique de deux clés locales (équivalent chronologique). */
export function compareLocalDateKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
