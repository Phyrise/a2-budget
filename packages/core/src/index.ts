/**
 * @a2/core — API publique (CONTRAT).
 *
 * Les signatures de ce fichier sont le contrat entre les agents CORE et UI.
 * Sémantique, unités et cas limites : docs/CONTRACTS.md.
 *
 * Ce fichier ne fait que ré-exporter ; les implémentations vivent dans
 * amounts.ts, calculations.ts, income.ts, months.ts, state.ts, (V4)
 * euros.ts, payments.ts, accountBalance.ts et (V4.2) sharedRules.ts.
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

// V4 — euros entiers (affichage et saisie), paiements du mois, solde du
// compte commun (report automatique + « Recaler sur le compte »).
export {
  roundToEuroCents,
  formatEuros,
  parseEurosInput,
  eurosToCents,
  splitRounded,
  roundEurosConsistent,
} from './euros.js';
export type { ParseEurosResult } from './euros.js';

export {
  isTransferPaid,
  isExpensePaid,
  setTransferPaid,
  setExpensePaid,
  prunePaidExpenses,
  paidTotals,
} from './payments.js';

export {
  BALANCE_NOTE_MAX,
  BALANCE_CORRECTIONS_MAX,
  monthNetCents,
  openingBalance,
  currentBalanceEstimate,
  endOfMonthProjection,
  openingFromCurrentBalance,
  isBalanceCents,
  recordBalanceCorrection,
  removeBalanceCorrection,
  balanceCorrectionFor,
  validateBudgetBalance,
  restoreBalanceCorrection,
  anchorBalance,
  balanceStatus,
  BALANCE_ANCHOR_NOTE,
} from './accountBalance.js';
export type { BalanceSource } from './accountBalance.js';
export { monthFlows, paidFlows } from './monthFlows.js';
export type { MonthFlows } from './monthFlows.js';

export {
  normalizeMonthIncome,
  sharedRates,
  hasSharedRates,
  setSharedRates,
  monthIncomeCents,
} from './income.js';

// V4.2 — taux globaux (réglages + mois courant et suivants), réserve retirée.
export { applySharedRates, alignBudgetRules } from './sharedRules.js';

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
