/**
 * @a2/core — API publique (CONTRAT).
 *
 * Les signatures de ce fichier sont le contrat entre les agents CORE et UI.
 * Sémantique, unités et cas limites : docs/CONTRACTS.md.
 *
 * Ce fichier ne fait que ré-exporter ; les implémentations vivent dans
 * amounts.ts, calculations.ts, months.ts et state.ts.
 */

export * from './types.js';

export {
  MAX_AMOUNT_CENTS,
  MAX_RATE_BPS,
  parseAmountInput,
  formatCents,
} from './amounts.js';
export type { ParseAmountResult } from './amounts.js';

export { computeContributionBreakdown, computeMonthSummary } from './calculations.js';

export {
  currentMonthKey,
  isValidMonthKey,
  compareMonthKeys,
  monthKeyToLabel,
} from './months.js';

export {
  defaultSettings,
  createMonthRecord,
  emptyState,
  ensureMonth,
  applySettingsToMonth,
  validatePersistedState,
} from './state.js';
