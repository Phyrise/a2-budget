/**
 * @a2/core — domaine « Maison / Forêt » (A² Home).
 *
 * Ce domaine est séparé du budget : il compose l'état applicatif modulaire
 * V2 (AppState), fournit la migration V1 → V2, le modèle de tâches à
 * occurrences explicites (édition, suppression, « À venir »), l'état de la
 * forêt dérivé des complétions et la liste de courses commune.
 *
 * Sémantique, unités et cas limites : docs/DOMAIN_CONTRACTS.md.
 */

export type {
  AppState,
  BurdenNote,
  ChoreCompletion,
  ChoreDoer,
  ChoreSkip,
  ChoresState,
  Circle,
  FocusSession,
  FocusState,
  GratitudeNote,
  RitualsState,
  TaskEffort,
  CreditKey,
  CreditLedger,
  CreditRecord,
  ForestState,
  GroceriesState,
  GroceryAuthor,
  GroceryCategory,
  GroceryCategoryMemory,
  GroceryItem,
  GroceryPurchase,
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
  ANYTIME_SEPARATOR,
  anytimeDueDate,
  dueDay,
  isAnytimeDueDate,
  isAnytimeTask,
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
  updateTask,
  deleteTask,
  upcomingOccurrences,
  isTaskEffort,
  isFlexibleWeekly,
  weekStartKey,
  occurrenceDateFor,
  skipDateFor,
  findOccurrenceCompletion,
  isSkipped,
  whoDid,
  nextAssignee,
  completionsOfWeek,
} from './tasks.js';
export type { TaskPatch, UpcomingOccurrence } from './tasks.js';

export { toggleTaskToday, undoCompletion } from './choreActions.js';
export type { ChoresAndForest, ToggleTaskResult } from './choreActions.js';

// V3 « Prendre soin ensemble » — passages, équilibre, rituels, lanternes.
export { SKIPS_MAX, skipOccurrence, unskipOccurrence } from './skips.js';
export {
  BALANCE_QUIET_BELOW,
  BALANCE_TOLERANCE,
  weeklyBalance,
  rebalanceSuggestions,
} from './balance.js';
export type { BalanceVerdict, WeeklyBalance, RebalanceSuggestion } from './balance.js';
export {
  CIRCLE_TEXT_MAX,
  CIRCLES_MAX,
  isWeekStartKey,
  saveCircle,
  circleForWeek,
  pastParticiplePhrase,
  gratitudeSuggestions,
} from './rituals.js';
export {
  normalizeCircle,
  trimCircles,
  circlePartId,
  saveCirclePart,
  weekRecords,
  mergeWeek,
  weeklyCircles,
  circleWriters,
  circlePart,
  letterHasWords,
  unreadLetter,
  nextSeenMark,
} from './circleParts.js';
export {
  FOCUS_SESSIONS_MAX,
  FOCUS_MINUTES_MAX,
  FOCUS_LABEL_MAX,
  addFocusSession,
} from './focus.js';

export {
  GROCERY_CATEGORIES,
  GROCERY_HISTORY_MAX,
  GROCERY_LABEL_MAX,
  isGroceryCategory,
  groceryCategoryLabel,
  categorizeGrocery,
  groceryCategoryOf,
  normalizeGroceryLabel,
  normalizeGroceryQuantity,
  parseGroceryInput,
  groceryKey,
  addGroceryItem,
  toggleGroceryItem,
  removeGroceryItem,
  restoreGroceryItem,
  updateGroceryItem,
  clearDoneGroceries,
  clearedGroceries,
  undoClearGroceries,
  recentGroceryPurchases,
  grocerySuggestions,
  groupGroceryItems,
  rememberedCategory,
} from './groceries.js';
export {
  GROCERY_MEMORY_MAX,
  rememberGroceryCategory,
  forgetGroceryCategory,
  validateGroceryMemory,
} from './groceryMemory.js';
export type { ClearedGrocery, GroceryItemPatch, GrocerySuggestion, GroceryGroup } from './groceries.js';

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

// V3.2 — calendrier commun, progression et objectif de la semaine de la forêt.
export type {
  ActiveCalendarKind,
  CalendarEvent,
  CalendarEventKind,
  CalendarOccurrence,
  CalendarState,
  CalendarWho,
} from './calendarTypes.js';
export {
  CALENDAR_EVENTS_MAX,
  CALENDAR_TITLE_MAX,
  CALENDAR_PLACE_MAX,
  CALENDAR_NOTE_MAX,
  CALENDAR_KINDS,
  ACTIVE_CALENDAR_KINDS,
  activeCalendarKind,
  isCalendarKind,
  isCalendarWho,
  isTimeKey,
  validateCalendar,
  validateCalendarEvent,
  addEvent,
  updateEvent,
  removeEvent,
  restoreEvent,
} from './calendar.js';
export type {
  CalendarEventDraft,
  CalendarEventPatch,
  CalendarResult,
  RemovedCalendarEvent,
} from './calendar.js';
export { compareOccurrences, eventsBetween, eventsOn, nextEvents } from './calendarOccurrences.js';
export {
  WEEKLY_GOAL_TARGET,
  WEEKLY_GOAL_LEVELS,
  forestProgress,
  weeklyCareGoal,
} from './forestProgress.js';
export type {
  ForestProgress,
  WeeklyCareGoal,
  WeeklyGoalLevel,
  WeeklyGoalOptions,
  WeeklyGoalTrend,
} from './forestProgress.js';

// V4 — tâches au calendrier, lanternes de pierre.
export { TASK_CALENDAR_MAX_DAYS, taskOccurrencesBetween } from './taskCalendar.js';
export type { TaskCalendarOccurrence } from './taskCalendar.js';
export {
  LANTERNS,
  DEFAULT_LANTERN_ID,
  isLanternId,
  unlockedLanterns,
  isLanternUnlocked,
  nextLantern,
  activeLantern,
  selectLantern,
  completedFocusCount,
} from './lanterns.js';
export type { LanternDef } from './lanterns.js';

// V4.3 — anniversaires (couple chaque mois, A et B chaque année), événements virtuels.
export {
  DEFAULT_ANNIVERSARIES,
  defaultAnniversaries,
  isMonthDay,
  validateAnniversaries,
  withAnniversaries,
  coupleDayIn,
  fetesOn,
  isCoupleDay,
  nextAnniversary,
  coupleDaysBetween,
  monthDayLabel,
  coupleDayLabel,
  parseMonthDay,
  parseCoupleDay,
  isAnniversaryEventId,
  anniversaryEvents,
  withAnniversaryEvents,
} from './anniversaries.js';
export type { Anniversaries, FeteKind, MonthDay } from './anniversaries.js';

export {
  migrateV1toV2,
  emptyAppState,
  validateAppState,
  migrateState,
} from './appState.js';

// V5.1 — quêtes communes (à deux, le même jour).
export {
  QUEST_GIFT,
  QUEST_KINDS,
  QUEST_SPOTS,
  QUEST_TAB,
  QUESTS_MAX,
  addQuest,
  devQuest,
  doneQuests,
  helpQuest,
  isQuestDone,
  questDaysBetween,
  questOfDay,
  questStatus,
  questWeekdays,
  scheduledQuest,
  validateQuests,
} from './quests.js';
export type { QuestKind, QuestRole, QuestStatus, QuestTab, QuestsState, SharedQuest } from './quests.js';
// V5.2 — lien Courses ↔ Maison.
export { groceryRunDue, groceryTaskOf, groceriesLeft, lastGroceryRun } from './groceryTask.js';
export type { GroceryRun } from './groceryTask.js';
