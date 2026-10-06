/**
 * Aides d'affichage (présentation uniquement, aucune logique financière).
 *
 * - V4 : plus aucun centime à l'écran. Les montants passent par
 *   `formatEuros` (@a2/core, arrondi à l'euro, « 1 235 € ») ; les totaux
 *   qui doivent tomber juste (A + B = ensemble) s'arrondissent ensemble avec
 *   `roundEurosConsistent` avant d'être affichés.
 * - Typographie française : espace fine insécable (U+202F) avant ; ! ?,
 *   espace insécable (U+00A0) avant : et à l'intérieur des guillemets.
 */
import { formatEuros, roundToEuroCents } from '@a2/core';

export const NBSP = '\u00a0';
export const NNBSP = '\u202f';

/** 123456 → « 1 235 € » (euros entiers, formatEuros de core). */
export function euro(cents: number): string {
  return formatEuros(cents);
}

/** Alias historique : les montants sont désormais toujours sans centimes. */
export function euroShort(cents: number): string {
  return formatEuros(cents);
}

/** Montant d'une ligne de soustraction : « − 1 845 € ». */
export function euroMinus(cents: number): string {
  return `−${NNBSP}${formatEuros(cents)}`;
}

/** Montant signé (« + 370 € », « − 120 € », « 0 € »), pour un écart. */
export function euroSigned(cents: number): string {
  const rounded = roundToEuroCents(cents);
  if (rounded === 0) return formatEuros(0);
  return rounded > 0 ? `+${NNBSP}${formatEuros(rounded)}` : euroMinus(-rounded);
}

const rateFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 4000 → « 40 », 3333 → « 33,33 ». */
export function formatRateBps(bps: number): string {
  return rateFormatter.format(bps / 100);
}

/** 4000 → « 40 % » (espace fine insécable). */
export function percent(bps: number): string {
  return `${formatRateBps(bps)}${NNBSP}%`;
}

/** Notation plate (euros entiers) d'un montant, point de départ d'une édition : 123456 → « 1235 ». */
export function centsToPlain(cents: number): string {
  return String(roundToEuroCents(cents) / 100);
}

/** 4000 → « 40 », 3333 → « 33,33 », 50 → « 0,50 ». */
export function bpsToPlain(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rest = bps % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`;
}

/** Applique les espaces insécables de la typographie française à une chaîne. */
export function fr(text: string): string {
  return text
    .replace(/ ([;!?])/g, `${NNBSP}$1`)
    .replace(/ :/g, `${NBSP}:`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`);
}

/** Pluriel français simple : plural(3, 'article') → « 3 articles ». */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n}${NBSP}${n > 1 ? pluralForm : singular}`;
}

/** Concatène des classes CSS en ignorant les valeurs vides. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
