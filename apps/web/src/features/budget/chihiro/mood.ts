/**
 * Univers Chihiro du Budget : lecture visuelle (jamais financière) du mois.
 * Les montants viennent tous de @a2/core (computeMonthSummary) ; ici, on ne
 * fait que les classer pour choisir une pose ou un remplissage de jauge.
 * Aucune de ces valeurs n'est affichée en texte : l'information reste dans
 * les chiffres de l'écran.
 */
import type { MonthSummary } from '@a2/core';
import type { BudgetTheme, NoFacePose } from '../../../themes/types';

/** Pose « humeur » du Sans-Visage (hors 'bow' et 'fading', réservées aux transitions). */
export type NoFaceMood = Extract<NoFacePose, 'offering' | 'calm' | 'content' | 'shy'>;

/** Au-delà de cette part des versements consommée par les dépenses : Sans-Visage repu. */
export const CONTENT_SPEND_SHARE = 0.95;
/** Reste supérieur à cette part des versements : Sans-Visage offre ses pépites. */
export const OFFERING_REST_SHARE = 0.1;
/** Réserve couverte « avec de la marge » : loisirs ≥ cette part des versements. */
export const RESERVE_MARGIN_SHARE = 0.05;

/**
 * - 'shy' : déficit (mains vides, timide — jamais effrayant) ;
 * - 'content' : dépenses > ~95 % des versements, reste ≥ 0 (un peu plus rond) ;
 * - 'offering' : reste > 10 % des versements, ou réserve couverte avec marge ;
 * - 'calm' : reste positif mais modeste (ou mois encore vide).
 */
export function noFaceMood(summary: MonthSummary, reserveTargetCents: number): NoFaceMood {
  const given = summary.householdContributionCents;
  const rest = summary.remainingCents;
  if (rest < 0) return 'shy';
  if (given <= 0) return 'calm';
  if (summary.expensesTotalCents > given * CONTENT_SPEND_SHARE) return 'content';
  if (rest > given * OFFERING_REST_SHARE) return 'offering';
  if (reserveTargetCents > 0 && summary.reserveCovered && summary.leisureCents >= given * RESERVE_MARGIN_SHARE) {
    return 'offering';
  }
  return 'calm';
}

/** Remplissage de la jauge d'or : reste / versements, borné à [0, 1]. */
export function goldFill(summary: MonthSummary): number {
  const given = summary.householdContributionCents;
  if (given <= 0 || summary.remainingCents <= 0) return 0;
  return Math.min(1, summary.remainingCents / given);
}

/** Couleurs de kompeitō disponibles (clés de budgetTheme.gold.konpeito). */
export const KONPEITO_COLORS = [
  'pink',
  'yellow',
  'green',
  'blue',
  'white',
  'purple',
  'yellow-2',
  'green-2',
  'blue-2',
  'purple-2',
] as const;
export type KonpeitoColor = (typeof KONPEITO_COLORS)[number];

/** Hash FNV-1a 32 bits : stable entre sessions et appareils. */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Couleur stable d'une dépense, d'après son libellé (casse et espaces ignorés). */
export function konpeitoColorFor(label: string): KonpeitoColor {
  const normalized = label.trim().toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');
  return KONPEITO_COLORS[stableHash(normalized) % KONPEITO_COLORS.length] ?? 'yellow';
}

export type SusuwatariCarrier = keyof Pick<
  BudgetTheme['susuwatari'],
  'carryPink' | 'carryYellow' | 'carryGreen' | 'carryBlueDuo' | 'jumpWhite'
>;

/** Noiraude qui porte un kompeitō de la couleur la plus proche. */
export function carrierFor(color: KonpeitoColor): SusuwatariCarrier {
  if (color.startsWith('pink')) return 'carryPink';
  if (color.startsWith('yellow')) return 'carryYellow';
  if (color.startsWith('green')) return 'carryGreen';
  if (color.startsWith('white')) return 'jumpWhite';
  return 'carryBlueDuo'; // bleu et violet
}
