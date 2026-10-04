/**
 * @a2/core — API publique (CONTRAT).
 *
 * Les signatures de ce fichier sont le contrat entre les agents CORE et UI.
 * Sémantique, unités et cas limites : docs/CONTRACTS.md.
 *
 * Ce fichier ne fait que ré-exporter ; les implémentations vivent dans
 * amounts.ts, calculations.ts, income.ts, months.ts et state.ts.
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
  normalizeMonthIncome,
  sharedRates,
  hasSharedRates,
  setSharedRates,
  monthIncomeCents,
} from './income.js';

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

// ---------------------------------------------------------------------------
// Domaine « Maison / Forêt » (A² Home) — état applicatif modulaire V2,
// migration V1 → V2, tâches à occurrences explicites, forêt.
// Sémantique et cas limites : docs/DOMAIN_CONTRACTS.md.
// ---------------------------------------------------------------------------
export * from './home/index.js';
