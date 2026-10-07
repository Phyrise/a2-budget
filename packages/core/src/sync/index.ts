/**
 * @a2/core — synchronisation à deux (V5), partie domaine : faits annulables,
 * rejeu déterministe de la forêt, jalons monotones, mois en maps, rangs
 * d'ordre. Aucune dépendance réseau : le pont (apps/web/src/sync) s'appuie
 * dessus. Conception : docs/SYNC_DESIGN.md §2, §3, §10.
 */

export type {
  CompletionFact,
  FactUndo,
  FocusFact,
  ForestEventFact,
  PurchaseFact,
  Role,
  SkipFact,
  UndoInput,
} from './facts.js';
export {
  completionFact,
  dedupeFacts,
  isLive,
  liveCompletions,
  liveFacts,
  liveFactsOfOccurrence,
  liveSkips,
  mergeFact,
  undoFact,
} from './facts.js';

export type { ForestCheckpoint, ReplayFacts, ReplayStep } from './replay.js';
export {
  buildCheckpoint,
  checkpointDayFor,
  checkpointsToKeep,
  forestTimeline,
  latestCheckpoint,
  replayForest,
} from './replay.js';

export type { ForestMilestones } from './milestones.js';
export {
  applyMilestones,
  emptyMilestones,
  mergeMilestones,
  milestonesAtLeast,
  milestonesOf,
  raisesMilestones,
  validateMilestones,
} from './milestones.js';

export type { ExpenseEntry, ExpenseMap, MonthDoc, SettingsDoc } from './monthMaps.js';
export {
  expensesFromMap,
  expensesToMap,
  monthFromDoc,
  monthToDoc,
  settingsFromDoc,
  settingsToDoc,
} from './monthMaps.js';

export type { Ordered } from './order.js';
export { allocateOrders, compareOrdered, sortByOrder } from './order.js';
