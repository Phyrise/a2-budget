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
/** Versements − dépenses supérieur à cette part des versements : Sans-Visage offre ses pépites. */
export const OFFERING_REST_SHARE = 0.1;
/** Réserve couverte « avec de la marge » : loisirs ≥ cette part des versements. */
export const RESERVE_MARGIN_SHARE = 0.05;

/**
 * V4 : le Sans-Visage veille sur le compte commun (plus de « reste »).
 * - 'shy' : la projection de fin de mois passe sous zéro (mains vides,
 *   timide — jamais effrayant) ;
 * - 'content' : dépenses > ~95 % des versements (un peu plus rond) ;
 * - 'offering' : versements − dépenses > 10 % des versements, ou réserve
 *   couverte avec marge ;
 * - 'calm' : sinon (ou mois encore vide).
 */
export function noFaceMood(summary: MonthSummary, reserveTargetCents: number, projectionCents: number): NoFaceMood {
  const given = summary.householdContributionCents;
  const net = summary.remainingCents;
  if (projectionCents < 0) return 'shy';
  if (given <= 0) return 'calm';
  if (summary.expensesTotalCents > given * CONTENT_SPEND_SHARE) return 'content';
  if (net > given * OFFERING_REST_SHARE) return 'offering';
  if (reserveTargetCents > 0 && summary.reserveCovered && summary.leisureCents >= given * RESERVE_MARGIN_SHARE) {
    return 'offering';
  }
  return 'calm';
}

/**
 * Remplissage de la rigole d'or : solde du compte commun rapporté à un mois
 * de flux (le plus grand des versements et des dépenses), borné à [0, 1].
 * Un solde nul ou négatif laisse la rigole vide (sobre, jamais alarmante).
 */
export function balanceFill(balanceCents: number, summary: MonthSummary): number {
  if (balanceCents <= 0) return 0;
  const reference = Math.max(summary.householdContributionCents, summary.expensesTotalCents);
  if (reference <= 0) return 1;
  return Math.min(1, balanceCents / reference);
}

/** Teintes de kompeitō (clés de budgetTheme.gold.konpeito, variantes « -2 » en plus). */
export const KONPEITO_HUES = ['pink', 'yellow', 'green', 'blue', 'white', 'purple'] as const;
export type KonpeitoHue = (typeof KONPEITO_HUES)[number];
export type KonpeitoColor = KonpeitoHue | `${Exclude<KonpeitoHue, 'pink' | 'white'>}-2`;

/** Hash FNV-1a 32 bits : stable entre sessions et appareils. */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Finaliseur murmur3 : mélange les bits faibles avant le modulo. */
function mix(h: number): number {
  let x = h ^ (h >>> 16);
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/**
 * Couleur stable d'une dépense, d'après son libellé (casse et espaces
 * ignorés) : six teintes bien distinctes, puis une des deux variantes de
 * cristal quand elle existe. Le sel « susu: » répartit les libellés par
 * défaut (loyer, électricité, courses…) sur six teintes différentes.
 */
export function konpeitoColorFor(label: string): KonpeitoColor {
  const normalized = label.trim().toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');
  const h = mix(stableHash(`susu:${normalized}`));
  const hue = KONPEITO_HUES[h % KONPEITO_HUES.length] ?? 'yellow';
  if (hue === 'pink' || hue === 'white' || ((h >>> 8) & 1) === 0) return hue;
  return `${hue}-2`;
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
