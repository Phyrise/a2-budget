/**
 * @a2/core — API publique (CONTRAT).
 *
 * Les signatures de ce fichier sont le contrat entre les agents CORE et UI.
 * Sémantique, unités et cas limites : docs/CONTRACTS.md.
 *
 * STATUT : stubs de contrat. Chaque fonction lève une erreur tant que l'agent
 * CORE n'a pas fourni l'implémentation. Le typecheck est la porte
 * d'intégration ; ne pas appeler ces fonctions dans un chemin qui doit
 * fonctionner avant le merge de CORE.
 */

import type {
  ContributionBreakdown,
  MonthRecord,
  MonthSummary,
  PersistedState,
  PersonSettings,
  Settings,
} from './types.js';

export * from './types.js';

/**
 * Montant maximal accepté : 1 milliard d'euros en centimes.
 * Garde tous les produits intermédiaires (cents × bps) sous Number.MAX_SAFE_INTEGER.
 */
export const MAX_AMOUNT_CENTS = 100_000_000_000;

/** Taux maximal accepté : 100 % en points de base. */
export const MAX_RATE_BPS = 10_000;

/** Résultat de l'analyse d'une saisie d' montant. */
export type ParseAmountResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'too-many-decimals' | 'out-of-range' };

// ---------------------------------------------------------------------------
// Calculs
// ---------------------------------------------------------------------------

/**
 * Contribution d'une personne pour un revenu donné.
 *
 *   baseIncomeCents           = min(salaryCents, person.baseSalaryCents)
 *   variableIncomeCents       = max(0, salaryCents − person.baseSalaryCents)
 *   baseContributionCents     = roundHalfUp(baseIncomeCents × person.baseRateBps / 10000)
 *   variableContributionCents = roundHalfUp(variableIncomeCents × person.variableRateBps / 10000)
 *   contributionCents         = baseContributionCents + variableContributionCents
 *
 * Chaque tranche est arrondie séparément au centime (demi-centime vers le haut)
 * avant l'addition. Pour des entiers non négatifs sûrs :
 * roundHalfUp(n / 10000) === floor((n + 5000) / 10000).
 *
 * Lève une erreur sur entrée invalide (négatif, non entier, hors plage).
 */
export function computeContributionBreakdown(
  salaryCents: number,
  person: PersonSettings,
): ContributionBreakdown {
  throw new Error('not implemented: computeContributionBreakdown (CORE)');
}

/**
 * Chiffres agrégés d'un mois : contributions A/B, total commun, total des
 * dépenses, reste (peut être négatif), loisirs après réserve, couverture de
 * la réserve.
 */
export function computeMonthSummary(record: MonthRecord): MonthSummary {
  throw new Error('not implemented: computeMonthSummary (CORE)');
}

// ---------------------------------------------------------------------------
// Montants : analyse et formatage
// ---------------------------------------------------------------------------

/**
 * Analyse déterministe d'une saisie utilisateur vers des centimes.
 *
 * Accepte les notations fr-FR et en-US : « 1 234,56 », « 1234.56 »,
 * « 1 234,56 € », espaces français habituels lors d'un collage.
 * Rejette (sans tronquer silencieusement) : chaîne vide, saisie ambiguë,
 * plus de deux décimales, valeur négative, valeur > MAX_AMOUNT_CENTS.
 * Un zéro saisi explicitement est valide.
 */
export function parseAmountInput(raw: string): ParseAmountResult {
  throw new Error('not implemented: parseAmountInput (CORE)');
}

/**
 * Formate des centimes en EUR fr-FR : 123456 → « 1 234,56 € ».
 * Basé sur Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).
 */
export function formatCents(cents: number): string {
  throw new Error('not implemented: formatCents (CORE)');
}

// ---------------------------------------------------------------------------
// Mois
// ---------------------------------------------------------------------------

/** Mois courant « YYYY-MM » dans le fuseau local de l'utilisateur (jamais UTC). */
export function currentMonthKey(now: Date = new Date()): string {
  throw new Error('not implemented: currentMonthKey (CORE)');
}

/** Vrai pour une clé « YYYY-MM » bien formée avec un mois calendrier valide. */
export function isValidMonthKey(key: string): boolean {
  throw new Error('not implemented: isValidMonthKey (CORE)');
}

/** Comparaison chronologique de deux clés de mois. */
export function compareMonthKeys(a: string, b: string): number {
  throw new Error('not implemented: compareMonthKeys (CORE)');
}

/** Libellé français : « 2026-10 » → « Octobre 2026 ». */
export function monthKeyToLabel(key: string): string {
  throw new Error('not implemented: monthKeyToLabel (CORE)');
}

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

/**
 * Réglages par défaut :
 * - A : base 2200 €, taux 40 % / 20 %
 * - B : base 3000 €, taux 40 % / 20 %
 * - Dépenses récurrentes : loyer + charges 1300 €, électricité 100 €,
 *   courses 400 €, internet 30 €, assurance 15 €, autres 0 €
 * - Réserve par défaut : 0 €
 */
export function defaultSettings(): Settings {
  throw new Error('not implemented: defaultSettings (CORE)');
}

/**
 * Crée l'enregistrement d'un nouveau mois à partir des réglages courants :
 * copie des deux personnes, salaires préremplis avec les salaires de base
 * (prévision, à ajuster), copie des dépenses récurrentes, réserve par défaut.
 */
export function createMonthRecord(monthKey: string, settings: Settings): MonthRecord {
  throw new Error('not implemented: createMonthRecord (CORE)');
}

/** État initial : réglages par défaut, aucun mois, mois sélectionné = mois courant local. */
export function emptyState(): PersistedState {
  throw new Error('not implemented: emptyState (CORE)');
}

/**
 * Retourne un nouvel état où `monthKey` existe (créé depuis les réglages si
 * absent) et est sélectionné. Pur : ne mute jamais l'entrée.
 */
export function ensureMonth(state: PersistedState, monthKey: string): PersistedState {
  throw new Error('not implemented: ensureMonth (CORE)');
}

/**
 * Action explicite « Appliquer au mois affiché » : remplace dans le mois les
 * copies des personnes, les dépenses et la cible de réserve par les réglages
 * courants. Les salaires saisis dans le mois sont conservés.
 * Sans effet si le mois n'existe pas.
 */
export function applySettingsToMonth(
  state: PersistedState,
  monthKey: string,
): PersistedState {
  throw new Error('not implemented: applySettingsToMonth (CORE)');
}

/**
 * Validation à l'exécution d'un état persisté/importé : version du schéma,
 * types, entiers, plages, clés de mois, identifiants, relations.
 * Retourne l'état validé ou une raison stable. Ne lève jamais d'exception.
 */
export function validatePersistedState(
  value: unknown,
): { ok: true; state: PersistedState } | { ok: false; reason: string } {
  throw new Error('not implemented: validatePersistedState (CORE)');
}
