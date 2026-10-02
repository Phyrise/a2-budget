/**
 * @a2/core — domaine « Maison / Forêt » (A² Home).
 *
 * Ce domaine est séparé du budget : il compose l'état applicatif modulaire
 * V2 (AppState), fournit la migration V1 → V2, le modèle de tâches à
 * occurrences explicites, et l'état de la forêt dérivé des complétions.
 *
 * Sémantique, unités et cas limites : docs/DOMAIN_CONTRACTS.md.
 */

export type {
  AppState,
  ChoreCompletion,
  CreditKey,
  CreditLedger,
  CreditRecord,
  ForestState,
  GroceryItem,
  HouseholdTask,
  PauseInterval,
  Person,
  TaskAssignee,
  TaskRecurrence,
  VitalityState,
} from './types.js';

export {
  localDateKey,
  isoWeekday,
  daysInMonth,
  addDays,
  startOfWeek,
  parseLocalDateKey,
  isValidLocalDateKey,
  compareLocalDateKeys,
} from './dates.js';

export {
  ONCE,
  creditKeyFor,
  splitCreditKey,
  isDueOn,
  hasCompletion,
  isActionableToday,
  addCompletion,
  removeCompletion,
  weeklyDistribution,
  actionableTasksToday,
  createTask,
} from './tasks.js';

export {
  VITALITY_MAX,
  VITALITY_PER_CREDIT,
  DAILY_CREDIT_CAP,
  DAILY_DECAY,
  INACTIVITY_GRACE_DAYS,
  GUARDIAN_STREAK,
  VITALITY_STATE_THRESHOLDS,
  GROWTH_THRESHOLDS,
  CREATURES,
  ENVIRONMENTS,
  emptyForest,
  vitalityState,
  creditsGrantedOn,
  grantCredit,
  tombstoneCredit,
  isDayPaused,
  isGapFullyPaused,
  updateStreak,
  advanceDay,
  growthStageFor,
  evaluateUnlocks,
  evaluateRareEvents,
  pauseForest,
  resumeForest,
} from './forest.js';

export {
  migrateV1toV2,
  emptyAppState,
  validateAppState,
  migrateState,
} from './appState.js';
