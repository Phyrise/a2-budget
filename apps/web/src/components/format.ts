/**
 * Aides d'affichage (présentation uniquement, aucune logique financière) :
 * - formatRateBps : bps entiers → pourcentage français (« 4000 » → « 40 »).
 * - centsToPlain / bpsToPlain : notation « plate » d'une valeur déjà validée,
 *   utilisée comme chaîne de départ de l'édition d'un champ (sans symbole
 *   monétaire ni séparateur de milliers), pour que l'utilisateur édite une
 *   chaîne simple que parseAmountInput / le parseur de taux pourra rejouer.
 */

const rateFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 4000 → « 40 », 3333 → « 33,33 ». */
export function formatRateBps(bps: number): string {
  return rateFormatter.format(bps / 100);
}

/** 123456 → « 1234,56 », 220000 → « 2200 ». */
export function centsToPlain(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const rest = cents % 100;
  if (rest === 0) {
    return String(euros);
  }
  return `${euros},${String(rest).padStart(2, '0')}`;
}

/** 4000 → « 40 », 3333 → « 33,33 », 50 → « 0,50 ». */
export function bpsToPlain(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rest = bps % 100;
  if (rest === 0) {
    return String(whole);
  }
  return `${whole},${String(rest).padStart(2, '0')}`;
}
