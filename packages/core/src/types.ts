/**
 * Types partagés du domaine A² Budget.
 *
 * UNITÉS :
 * - Tous les montants sont des **centimes d'euro entiers** (2200 € = 220000).
 * - Tous les taux sont des **points de base entiers** (40 % = 4000, 20 % = 2000,
 *   33,33 % = 3333). Plage valide : 0 à 10000.
 */

/** Paramètres d'une personne (copiés dans chaque mois). */
export interface PersonSettings {
  /** Identifiant stable, ex. "a" ou "b". */
  id: string;
  /** Nom affiché, modifiable. */
  name: string;
  /** Salaire de référence, en centimes (ex. 2200 € = 220000). */
  baseSalaryCents: number;
  /** Taux appliqué au revenu jusqu'au salaire de base, en bps (40 % = 4000). */
  baseRateBps: number;
  /** Taux appliqué au revenu au-delà du salaire de base, en bps (20 % = 2000). */
  variableRateBps: number;
}

/** Une dépense commune. */
export interface Expense {
  /** Identifiant stable, unique dans la liste qui contient la dépense. */
  id: string;
  label: string;
  amountCents: number;
}

/**
 * Un mois du budget commun.
 *
 * Chaque mois conserve **sa propre copie** des règles : modifier les réglages
 * plus tard ne doit jamais recalculer silencieusement les mois existants.
 */
export interface MonthRecord {
  /** Clé du mois "YYYY-MM", déterminée dans le fuseau local de l'utilisateur. */
  monthKey: string;
  /** Copie des paramètres de la personne A pour ce mois. */
  personA: PersonSettings;
  /** Copie des paramètres de la personne B pour ce mois. */
  personB: PersonSettings;
  /**
   * Revenu de la personne A pour ce mois, en centimes. Prévisionnel :
   * prérempli avec le salaire de base, à ajuster par l'utilisateur.
   */
  salaryACents: number;
  /** Revenu de la personne B pour ce mois, en centimes (mêmes règles). */
  salaryBCents: number;
  /** Dépenses propres au mois (copiées des dépenses récurrentes à la création). */
  expenses: Expense[];
  /**
   * Réserve que le couple souhaite mettre de côté CE MOIS, en centimes.
   * Ce n'est pas un solde bancaire existant. 0 = pas de réserve.
   */
  reserveTargetCents: number;
}

/** Réglages par défaut, appliqués aux mois nouvellement créés. */
export interface Settings {
  /** Paramètres par défaut de la personne A. */
  personA: PersonSettings;
  /** Paramètres par défaut de la personne B. */
  personB: PersonSettings;
  /** Dépenses récurrentes, copiées dans les mois nouvellement créés. */
  recurringExpenses: Expense[];
  /** Réserve mensuelle par défaut, appliquée aux mois nouvellement créés. */
  defaultReserveTargetCents: number;
}

/** État persisté (localStorage en V1). */
export interface PersistedState {
  schemaVersion: 1;
  settings: Settings;
  /** Tous les mois existants, dans un ordre quelconque (l'UI trie par monthKey). */
  months: MonthRecord[];
  /** Mois sélectionné, "YYYY-MM". */
  selectedMonth: string;
}

/** Détail du calcul de la contribution d'une personne pour un revenu donné. */
export interface ContributionBreakdown {
  /** min(salaire, salaire de base). */
  baseIncomeCents: number;
  /** max(0, salaire − salaire de base). */
  variableIncomeCents: number;
  /** roundHalfUp(baseIncomeCents × baseRateBps / 10000). */
  baseContributionCents: number;
  /** roundHalfUp(variableIncomeCents × variableRateBps / 10000). */
  variableContributionCents: number;
  /** baseContributionCents + variableContributionCents. */
  contributionCents: number;
}

/** Chiffres agrégés d'un mois. */
export interface MonthSummary {
  contributionACents: number;
  contributionBCents: number;
  /** contributionACents + contributionBCents. */
  householdContributionCents: number;
  /** Somme des dépenses du mois. */
  expensesTotalCents: number;
  /** householdContributionCents − expensesTotalCents. Peut être négatif :
   *  un déficit s'affiche, il n'est jamais masqué. */
  remainingCents: number;
  /** max(0, remainingCents − reserveTargetCents). */
  leisureCents: number;
  /** true si la réserve est couverte (vrai par convention si réserve = 0). */
  reserveCovered: boolean;
  /** max(0, reserveTargetCents − remainingCents) : part de la réserve non couverte. */
  reserveShortfallCents: number;
}
