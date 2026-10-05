/**
 * Euros entiers (V4) : plus aucun centime ni en saisie ni à l'affichage.
 *
 * Les montants restent stockés et calculés en **centimes entiers** (calculs
 * exacts). Seul l'affichage est arrondi à l'euro ; les montants saisis sont
 * des euros entiers, donc stockés en multiples de 100.
 *
 * Arrondi à l'euro : demi-euro vers le haut en valeur absolue (symétrique :
 * 0,50 € → 1 €, −0,50 € → −1 €), pour que `formatEuros(−x)` soit toujours
 * `formatEuros(x)` précédé du signe moins.
 */

import { MAX_AMOUNT_CENTS } from './amounts.js';

const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Arrondit des centimes à l'euro le plus proche (résultat en centimes,
 * multiple de 100). Demi-euro arrondi en s'éloignant de zéro. Pur.
 */
export function roundToEuroCents(cents: number): number {
  if (!Number.isFinite(cents)) throw new RangeError('cents must be finite');
  const magnitude = Math.floor((Math.abs(Math.round(cents)) + 50) / 100) * 100;
  return cents < 0 && magnitude > 0 ? -magnitude : magnitude;
}

/**
 * Formate des centimes en euros entiers fr-FR : 123456 → « 1 235 € ».
 * Séparateur de milliers fine insécable (U+202F) et espace insécable
 * (U+00A0) avant « € », comme `Intl.NumberFormat('fr-FR')`. Jamais « −0 € ».
 */
export function formatEuros(cents: number): string {
  const rounded = roundToEuroCents(cents);
  return euroFormatter.format(rounded === 0 ? 0 : rounded / 100);
}

/** Résultat de l'analyse d'une saisie en euros entiers. */
export type ParseEurosResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'not-integer' | 'out-of-range' };

const SPACES_RE = /[\s  ]/;

/**
 * Analyse une saisie en **euros entiers** → centimes (multiple de 100).
 *
 * Accepte : « 1234 », « 1 234 » (espaces, insécables ou fines insécables par
 * groupes de trois), « 1 234 € », « €12 », et une partie décimale nulle
 * collée d'un relevé (« 1 234,00 », « 12.0 »). Rejette sans tronquer : vide
 * (`empty`), signe, lettres, groupes mal formés (`invalid`), centimes non
 * nuls (`not-integer`), au-delà de MAX_AMOUNT_CENTS (`out-of-range`).
 * « 0 » est valide. Pur, ne lève jamais.
 */
export function parseEurosInput(raw: string): ParseEurosResult {
  let s = String(raw).trim();
  if (s.startsWith('€')) s = s.slice(1);
  if (s.endsWith('€')) s = s.slice(0, -1);
  s = s.trim();
  if (s === '') return { ok: false, reason: 'empty' };

  let intPart = s;
  const sep = s.search(/[.,]/);
  if (sep !== -1) {
    const decimals = s.slice(sep + 1);
    intPart = s.slice(0, sep);
    if (!/^\d{1,2}$/.test(decimals)) {
      return /^\d+$/.test(decimals) ? { ok: false, reason: 'not-integer' } : { ok: false, reason: 'invalid' };
    }
    if (!/^0+$/.test(decimals)) return { ok: false, reason: 'not-integer' };
    if (intPart.trim() === '') return { ok: false, reason: 'invalid' };
  }

  let digits: string;
  if (/^\d+$/.test(intPart)) {
    digits = intPart;
  } else if (SPACES_RE.test(intPart) && /^\d{1,3}(?:[\s  ]\d{3})+$/.test(intPart)) {
    digits = intPart.replace(/[\s  ]/g, '');
  } else {
    return { ok: false, reason: 'invalid' };
  }
  if (digits.length > 10) return { ok: false, reason: 'out-of-range' };
  const cents = Number(digits) * 100;
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    return { ok: false, reason: 'out-of-range' };
  }
  return { ok: true, cents };
}

/** Euros entiers → centimes (multiple de 100). Lève si non entier ou hors plage. */
export function eurosToCents(euros: number): number {
  if (!Number.isInteger(euros) || Math.abs(euros) * 100 > MAX_AMOUNT_CENTS) {
    throw new RangeError('euros must be an integer within range');
  }
  return euros === 0 ? 0 : euros * 100;
}

/**
 * Arrondit une liste de montants à l'euro **de façon cohérente** : chaque
 * valeur arrondie (multiple de 100, en centimes) et la somme des valeurs
 * arrondies vaut exactement `roundToEuroCents(somme exacte)`.
 *
 * Méthode du plus fort reste : chaque valeur est d'abord arrondie à l'euro
 * inférieur, puis les euros manquants vont aux plus forts restes (à reste
 * égal, l'ordre de la liste départage). Ex. 10,50 € + 10,50 € = 21 € →
 * [11 €, 10 €] (et non 11 € + 11 € = 22 €). Pur.
 */
export function splitRounded(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  let total = 0;
  const floors = values.map((v) => {
    if (!Number.isInteger(v)) throw new RangeError('values must be integer cents');
    total += v;
    return Math.floor(v / 100) * 100;
  });
  const target = roundToEuroCents(total);
  let missing = (target - floors.reduce((a, b) => a + b, 0)) / 100;
  const order = values
    .map((v, i) => ({ i, rest: v - floors[i]! }))
    .sort((x, y) => y.rest - x.rest || x.i - y.i);
  const out = floors.slice();
  for (const { i } of order) {
    if (missing <= 0) break;
    out[i] = out[i]! + 100;
    missing--;
  }
  return out;
}

/**
 * Contributions A et B et leur total, arrondis à l'euro de façon cohérente :
 * `aCents + bCents === totalCents` (tous multiples de 100), avec
 * `totalCents = roundToEuroCents(a + b)`. À utiliser pour afficher
 * « AL verse … · AC verse … · Total … » sans écart d'un euro.
 */
export function roundEurosConsistent(
  aCents: number,
  bCents: number,
): { aCents: number; bCents: number; totalCents: number } {
  const [a, b] = splitRounded([aCents, bCents]) as [number, number];
  return { aCents: a, bCents: b, totalCents: a + b };
}
