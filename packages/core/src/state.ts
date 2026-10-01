/**
 * État : réglages par défaut, création de mois, transitions pures et
 * validation à l'exécution de l'état persisté/importé.
 */

import { MAX_AMOUNT_CENTS, MAX_RATE_BPS } from './amounts.js';
import { currentMonthKey, isValidMonthKey } from './months.js';
import type {
  Expense,
  MonthRecord,
  PersistedState,
  PersonSettings,
  Settings,
} from './types.js';

// ---------------------------------------------------------------------------
// Valeurs par défaut
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
  return {
    personA: {
      id: 'a',
      name: 'AL',
      baseSalaryCents: 220_000,
      baseRateBps: 4000,
      variableRateBps: 2000,
    },
    personB: {
      id: 'b',
      name: 'AC',
      baseSalaryCents: 300_000,
      baseRateBps: 4000,
      variableRateBps: 2000,
    },
    recurringExpenses: [
      { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
      { id: 'electricity', label: 'Électricité', amountCents: 10_000 },
      { id: 'groceries', label: 'Courses', amountCents: 40_000 },
      { id: 'internet', label: 'Internet', amountCents: 3_000 },
      { id: 'insurance', label: 'Assurance', amountCents: 1_500 },
      { id: 'other', label: 'Autres', amountCents: 0 },
    ],
    defaultReserveTargetCents: 0,
  };
}

// ---------------------------------------------------------------------------
// Mois
// ---------------------------------------------------------------------------

/**
 * Crée l'enregistrement d'un nouveau mois à partir des réglages courants :
 * copie des deux personnes, salaires préremplis avec les salaires de base
 * (prévision, à ajuster), copie des dépenses récurrentes (mêmes ids),
 * réserve par défaut.
 */
export function createMonthRecord(monthKey: string, settings: Settings): MonthRecord {
  if (!isValidMonthKey(monthKey)) {
    throw new RangeError(`invalid month key: ${String(monthKey)}`);
  }
  return {
    monthKey,
    personA: { ...settings.personA },
    personB: { ...settings.personB },
    salaryACents: settings.personA.baseSalaryCents,
    salaryBCents: settings.personB.baseSalaryCents,
    expenses: settings.recurringExpenses.map((e) => ({ ...e })),
    reserveTargetCents: settings.defaultReserveTargetCents,
  };
}

/** État initial : réglages par défaut, aucun mois, mois sélectionné = mois courant local. */
export function emptyState(): PersistedState {
  return {
    schemaVersion: 1,
    settings: defaultSettings(),
    months: [],
    selectedMonth: currentMonthKey(),
  };
}

/**
 * Retourne un nouvel état où `monthKey` existe (créé depuis les réglages si
 * absent) et est sélectionné. Pur : ne mute jamais l'entrée.
 */
export function ensureMonth(state: PersistedState, monthKey: string): PersistedState {
  if (!isValidMonthKey(monthKey)) {
    throw new RangeError(`invalid month key: ${String(monthKey)}`);
  }
  const existing = state.months.find((m) => m.monthKey === monthKey);
  if (existing !== undefined) {
    if (state.selectedMonth === monthKey) return state;
    return { ...state, selectedMonth: monthKey };
  }
  return {
    ...state,
    months: [...state.months, createMonthRecord(monthKey, state.settings)],
    selectedMonth: monthKey,
  };
}

/**
 * Action explicite « Appliquer au mois affiché » : remplace dans le mois les
 * copies des personnes, les dépenses et la cible de réserve par les réglages
 * courants. Les salaires saisis dans le mois sont conservés.
 * Sans effet si le mois n'existe pas. Pur : ne mute jamais l'entrée.
 */
export function applySettingsToMonth(
  state: PersistedState,
  monthKey: string,
): PersistedState {
  const index = state.months.findIndex((m) => m.monthKey === monthKey);
  if (index === -1) return state;

  const month = state.months[index]!;
  const updated: MonthRecord = {
    ...month,
    personA: { ...state.settings.personA },
    personB: { ...state.settings.personB },
    expenses: state.settings.recurringExpenses.map((e) => ({ ...e })),
    reserveTargetCents: state.settings.defaultReserveTargetCents,
  };
  const months = state.months.slice();
  months[index] = updated;
  return { ...state, months };
}

// ---------------------------------------------------------------------------
// Validation à l'exécution
// ---------------------------------------------------------------------------

type Ok<T> = { ok: true; state: T };
type Fail = { ok: false; reason: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAmountCents(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_AMOUNT_CENTS
  );
}

function isRateBps(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_RATE_BPS
  );
}

function validatePerson(value: unknown): Ok<PersonSettings> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'person-not-object' };
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return { ok: false, reason: 'person-invalid-id' };
  }
  if (typeof value.name !== 'string') return { ok: false, reason: 'person-invalid-name' };
  if (!isAmountCents(value.baseSalaryCents)) {
    return { ok: false, reason: 'person-invalid-base-salary' };
  }
  if (!isRateBps(value.baseRateBps)) return { ok: false, reason: 'person-invalid-base-rate' };
  if (!isRateBps(value.variableRateBps)) {
    return { ok: false, reason: 'person-invalid-variable-rate' };
  }
  return {
    ok: true,
    state: {
      id: value.id,
      name: value.name,
      baseSalaryCents: value.baseSalaryCents,
      baseRateBps: value.baseRateBps,
      variableRateBps: value.variableRateBps,
    },
  };
}

function validateExpense(value: unknown): Ok<Expense> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'expense-not-object' };
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return { ok: false, reason: 'expense-invalid-id' };
  }
  if (typeof value.label !== 'string') return { ok: false, reason: 'expense-invalid-label' };
  if (!isAmountCents(value.amountCents)) return { ok: false, reason: 'expense-invalid-amount' };
  return { ok: true, state: { id: value.id, label: value.label, amountCents: value.amountCents } };
}

function validateExpenseList(
  value: unknown,
  duplicateReason: string,
): Ok<Expense[]> | Fail {
  if (!Array.isArray(value)) return { ok: false, reason: 'expenses-not-array' };
  const seen = new Set<string>();
  const out: Expense[] = [];
  for (const item of value) {
    const r = validateExpense(item);
    if (!r.ok) return r;
    if (seen.has(r.state.id)) return { ok: false, reason: duplicateReason };
    seen.add(r.state.id);
    out.push(r.state);
  }
  return { ok: true, state: out };
}

function validateSettings(value: unknown): Ok<Settings> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'settings-not-object' };
  const personA = validatePerson(value.personA);
  if (!personA.ok) return personA;
  const personB = validatePerson(value.personB);
  if (!personB.ok) return personB;
  const recurringExpenses = validateExpenseList(
    value.recurringExpenses,
    'settings-duplicate-expense-id',
  );
  if (!recurringExpenses.ok) return recurringExpenses;
  if (!isAmountCents(value.defaultReserveTargetCents)) {
    return { ok: false, reason: 'settings-invalid-reserve' };
  }
  return {
    ok: true,
    state: {
      personA: personA.state,
      personB: personB.state,
      recurringExpenses: recurringExpenses.state,
      defaultReserveTargetCents: value.defaultReserveTargetCents,
    },
  };
}

function validateMonthRecord(value: unknown): Ok<MonthRecord> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'month-not-object' };
  if (typeof value.monthKey !== 'string' || !isValidMonthKey(value.monthKey)) {
    return { ok: false, reason: 'month-invalid-key' };
  }
  const personA = validatePerson(value.personA);
  if (!personA.ok) return personA;
  const personB = validatePerson(value.personB);
  if (!personB.ok) return personB;
  if (!isAmountCents(value.salaryACents)) return { ok: false, reason: 'month-invalid-salary-a' };
  if (!isAmountCents(value.salaryBCents)) return { ok: false, reason: 'month-invalid-salary-b' };
  const expenses = validateExpenseList(value.expenses, 'month-duplicate-expense-id');
  if (!expenses.ok) return expenses;
  if (!isAmountCents(value.reserveTargetCents)) {
    return { ok: false, reason: 'month-invalid-reserve' };
  }
  return {
    ok: true,
    state: {
      monthKey: value.monthKey,
      personA: personA.state,
      personB: personB.state,
      salaryACents: value.salaryACents,
      salaryBCents: value.salaryBCents,
      expenses: expenses.state,
      reserveTargetCents: value.reserveTargetCents,
    },
  };
}

/**
 * Validation à l'exécution d'un état persisté/importé : version du schéma,
 * types, entiers, plages, clés de mois, identifiants (uniques dans chaque
 * liste), relations. Retourne l'état validé ou une raison stable.
 * Ne lève jamais d'exception.
 */
export function validatePersistedState(
  value: unknown,
): { ok: true; state: PersistedState } | { ok: false; reason: string } {
  try {
    if (!isPlainObject(value)) return { ok: false, reason: 'not-an-object' };
    if (value.schemaVersion !== 1) return { ok: false, reason: 'unknown-schema-version' };

    const settings = validateSettings(value.settings);
    if (!settings.ok) return settings;

    if (!Array.isArray(value.months)) return { ok: false, reason: 'months-not-array' };
    const seenMonths = new Set<string>();
    const months: MonthRecord[] = [];
    for (const item of value.months) {
      const r = validateMonthRecord(item);
      if (!r.ok) return r;
      if (seenMonths.has(r.state.monthKey)) {
        return { ok: false, reason: 'duplicate-month-key' };
      }
      seenMonths.add(r.state.monthKey);
      months.push(r.state);
    }

    if (typeof value.selectedMonth !== 'string' || !isValidMonthKey(value.selectedMonth)) {
      return { ok: false, reason: 'invalid-selected-month' };
    }

    return {
      ok: true,
      state: {
        schemaVersion: 1,
        settings: settings.state,
        months,
        selectedMonth: value.selectedMonth,
      },
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
