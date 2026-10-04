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
  /**
   * Salaire habituel, en centimes (ex. 2200 € = 220000). Préremplit le
   * salaire d'un nouveau mois ; ne sert plus de seuil de calcul (V3.1).
   */
  baseSalaryCents: number;
  /**
   * Taux appliqué au salaire du mois, en bps (40 % = 4000). Commun au couple :
   * écrit pour les deux personnes par `setSharedRates` (A fait foi à la lecture).
   */
  baseRateBps: number;
  /** Taux appliqué aux compléments (heures sup, astreintes, gardes), en bps (20 % = 2000). Commun au couple. */
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
   * Salaire de la personne A pour ce mois, en centimes, entièrement au taux
   * de base. Prérempli avec le salaire habituel, à ajuster.
   */
  salaryACents: number;
  /** Salaire de la personne B pour ce mois, en centimes (mêmes règles). */
  salaryBCents: number;
  /**
   * Compléments de la personne A pour ce mois (heures sup, astreintes,
   * gardes — souvent payés le mois suivant), en centimes, au taux au-delà.
   * 0 à la création d'un mois. Absent dans les données d'avant V3.1 :
   * `normalizeMonthIncome` les reconstitue sans changer les contributions.
   */
  bonusACents: number;
  /** Compléments de la personne B pour ce mois (mêmes règles). */
  bonusBCents: number;
  /** Dépenses propres au mois (copiées des dépenses récurrentes à la création). */
  expenses: Expense[];
  /**
   * Réserve que le couple souhaite mettre de côté CE MOIS, en centimes.
   * Ce n'est pas un solde bancaire existant. 0 = pas de réserve.
   */
  reserveTargetCents: number;
}

/**
 * Mois tel qu'il peut se présenter à l'entrée (stockage, import, fixtures) :
 * les compléments peuvent être absents (ancien modèle à seuil, avant V3.1).
 * À normaliser avec `normalizeMonthIncome` ; les validateurs le font.
 */
export type MonthRecordInput = Omit<MonthRecord, 'bonusACents' | 'bonusBCents'> &
  Partial<Pick<MonthRecord, 'bonusACents' | 'bonusBCents'>>;

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

/**
 * État persisté tel qu'il peut se présenter à l'entrée (V1 ancien modèle :
 * mois sans compléments). `validatePersistedState` le normalise.
 */
export type PersistedStateInput = Omit<PersistedState, 'months'> & {
  months: MonthRecordInput[];
};

/** Taux communs du couple, en bps. */
export interface SharedRates {
  /** Taux appliqué aux salaires. */
  baseRateBps: number;
  /** Taux appliqué aux compléments. */
  variableRateBps: number;
}

/** Détail du calcul de la contribution d'une personne pour un mois. */
export interface ContributionBreakdown {
  /** Salaire du mois (entièrement au taux de base). */
  baseIncomeCents: number;
  /** Compléments du mois (heures sup, astreintes, gardes), au taux au-delà. */
  variableIncomeCents: number;
  /** baseIncomeCents + variableIncomeCents : revenu total du mois. */
  incomeCents: number;
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
  /** Détail du calcul de A (salaire, compléments, tranches). */
  breakdownA: ContributionBreakdown;
  /** Détail du calcul de B. */
  breakdownB: ContributionBreakdown;
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
