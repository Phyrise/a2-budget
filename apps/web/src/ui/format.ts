/**
 * Aides d'affichage (présentation uniquement, aucune logique financière).
 *
 * - Les montants passent toujours par `formatCents` (@a2/core) ; on ne fait
 *   ici que de la mise en forme de chaînes (retrait des « ,00 », etc.).
 * - Typographie française : espace fine insécable (U+202F) avant ; ! ?,
 *   espace insécable (U+00A0) avant : et à l'intérieur des guillemets.
 */
import { formatCents } from '@a2/core';

export const NBSP = ' ';
export const NNBSP = ' ';

/** 123456 → « 1 234,56 € » (formatCents de core). */
export function euro(cents: number): string {
  return formatCents(cents);
}

/** Montant sans centimes nuls : 300000 → « 3 000 € », 67550 → « 675,50 € ». */
export function euroShort(cents: number): string {
  return formatCents(cents).replace(/,00(?=\s*€)/u, '');
}

/** Montant signé pour une ligne de soustraction : « − 1 845,00 € ». */
export function euroMinus(cents: number): string {
  return `−${NNBSP}${formatCents(cents)}`;
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

/** Notation plate d'un montant validé, point de départ d'une édition : 123456 → « 1234,56 ». */
export function centsToPlain(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`;
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
