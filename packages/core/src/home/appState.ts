/**
 * État applicatif modulaire (V2) + migration V1 → V2 + validation.
 *
 * SÉCURITÉ DES DONNÉES (priorité absolue) :
 * - La migration V1 → V2 est **pure** et **testée** : elle conserve
 *   exactement les montants, taux, noms et mois du budget (réserve comprise,
 *   même si elle n'est plus affichée).
 * - On ne **greffe jamais** les domaines Maison/Forêt sur `schemaVersion: 1`
 *   : le validateur V1 supprimerait leurs champs au rechargement. Les nouveaux
 *   champs n'existent qu'en V2.
 * - Les données corrompues ou d'une version inconnue (ex. 3) ne sont jamais
 *   écrasées silencieusement : la migration échoue avec une raison stable et
 *   le contenu brut est conservé (mode récupération, géré par le store).
 *
 * Le budget est **profondément identique** : la validation V2 réutilise la
 * validation V1 existante (testée) pour la partie budget.
 */

import { currentMonthKey } from '../months.js';
import { defaultSettings, validatePersistedState } from '../state.js';
import type { PersistedState } from '../types.js';
import { isValidLocalDateKey } from './dates.js';
import { emptyForest, VITALITY_MAX } from './forest.js';
import { ONCE } from './tasks.js';
import type {
  AppState,
  ChoreCompletion,
  CreditLedger,
  ForestState,
  GroceryItem,
  HouseholdTask,
  PauseInterval,
  Person,
  TaskAssignee,
  TaskRecurrence,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers de validation (locaux)
// ---------------------------------------------------------------------------

type Ok<T> = { ok: true; state: T };
type Fail = { ok: false; reason: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isAssignee(value: unknown): value is TaskAssignee {
  return value === 'a' || value === 'b' || value === 'both' || value === 'unassigned';
}

function isRecurrence(value: unknown): value is TaskRecurrence {
  return value === 'none' || value === 'daily' || value === 'weekly' || value === 'monthly';
}

// ---------------------------------------------------------------------------
// Migration V1 → V2
// ---------------------------------------------------------------------------

/**
 * Migration pure V1 → V2. Conserve **exactement** le budget (settings, mois,
 * mois sélectionné, réserve comprise) et initialise les domaines Maison/Forêt/
 * Courses à vide. Les personnes du foyer sont dérivées des réglages budget.
 * Ne lève jamais d'exception sur un état V1 déjà validé.
 */
export function migrateV1toV2(v1: PersistedState): AppState {
  return {
    schemaVersion: 2,
    household: {
      people: [
        { id: v1.settings.personA.id, name: v1.settings.personA.name },
        { id: v1.settings.personB.id, name: v1.settings.personB.name },
      ],
    },
    budget: {
      settings: v1.settings,
      months: v1.months,
      selectedMonth: v1.selectedMonth,
    },
    chores: { tasks: [], completions: [] },
    forest: emptyForest(),
    groceries: { items: [] },
  };
}

/** État applicatif V2 neuf (premier lancement). */
export function emptyAppState(): AppState {
  const settings = defaultSettings();
  return {
    schemaVersion: 2,
    household: {
      people: [
        { id: settings.personA.id, name: settings.personA.name },
        { id: settings.personB.id, name: settings.personB.name },
      ],
    },
    budget: {
      settings,
      months: [],
      selectedMonth: currentMonthKey(),
    },
    chores: { tasks: [], completions: [] },
    forest: emptyForest(),
    groceries: { items: [] },
  };
}

// ---------------------------------------------------------------------------
// Validation V2
// ---------------------------------------------------------------------------

function validateHousehold(
  value: unknown,
): Ok<{ people: Person[] }> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'household-not-object' };
  if (!Array.isArray(value.people)) {
    return { ok: false, reason: 'household-people-not-array' };
  }
  const people: Person[] = [];
  for (const p of value.people) {
    if (!isPlainObject(p)) return { ok: false, reason: 'person-not-object' };
    if (typeof p.id !== 'string' || p.id.length === 0) {
      return { ok: false, reason: 'person-invalid-id' };
    }
    if (typeof p.name !== 'string') return { ok: false, reason: 'person-invalid-name' };
    people.push({ id: p.id, name: p.name });
  }
  return { ok: true, state: { people } };
}

function validateTask(value: unknown): Ok<HouseholdTask> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'task-not-object' };
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return { ok: false, reason: 'task-invalid-id' };
  }
  if (typeof value.title !== 'string' || value.title.length === 0) {
    return { ok: false, reason: 'task-invalid-title' };
  }
  if (!isAssignee(value.assignee)) return { ok: false, reason: 'task-invalid-assignee' };
  if (!isRecurrence(value.recurrence)) {
    return { ok: false, reason: 'task-invalid-recurrence' };
  }
  if (typeof value.createdAt !== 'string' || !isValidLocalDateKey(value.createdAt)) {
    return { ok: false, reason: 'task-invalid-created-at' };
  }
  let weeklyDay: number | undefined;
  let monthlyDay: number | undefined;
  if (value.recurrence === 'weekly') {
    if (!isIntInRange(value.weeklyDay, 1, 7)) {
      return { ok: false, reason: 'task-invalid-weekly-day' };
    }
    weeklyDay = value.weeklyDay;
  }
  if (value.recurrence === 'monthly') {
    if (!isIntInRange(value.monthlyDay, 1, 31)) {
      return { ok: false, reason: 'task-invalid-monthly-day' };
    }
    monthlyDay = value.monthlyDay;
  }
  return {
    ok: true,
    state: {
      id: value.id,
      title: value.title,
      description: typeof value.description === 'string' ? value.description : undefined,
      assignee: value.assignee,
      recurrence: value.recurrence,
      weeklyDay,
      monthlyDay,
      createdAt: value.createdAt,
    },
  };
}

function validateTasks(value: unknown): Ok<HouseholdTask[]> | Fail {
  if (!Array.isArray(value)) return { ok: false, reason: 'tasks-not-array' };
  const seen = new Set<string>();
  const out: HouseholdTask[] = [];
  for (const t of value) {
    const r = validateTask(t);
    if (!r.ok) return r;
    if (seen.has(r.state.id)) return { ok: false, reason: 'duplicate-task-id' };
    seen.add(r.state.id);
    out.push(r.state);
  }
  return { ok: true, state: out };
}

function validateCompletions(value: unknown): Ok<ChoreCompletion[]> | Fail {
  if (!Array.isArray(value)) return { ok: false, reason: 'completions-not-array' };
  const seen = new Set<string>();
  const out: ChoreCompletion[] = [];
  for (const c of value) {
    if (!isPlainObject(c)) return { ok: false, reason: 'completion-not-object' };
    if (typeof c.id !== 'string' || c.id.length === 0) {
      return { ok: false, reason: 'completion-invalid-id' };
    }
    if (typeof c.taskId !== 'string' || c.taskId.length === 0) {
      return { ok: false, reason: 'completion-invalid-task-id' };
    }
    if (typeof c.taskTitle !== 'string') {
      return { ok: false, reason: 'completion-invalid-title' };
    }
    if (!isAssignee(c.assignee)) return { ok: false, reason: 'completion-invalid-assignee' };
    if (
      typeof c.dueDate !== 'string' ||
      (c.dueDate !== ONCE && !isValidLocalDateKey(c.dueDate))
    ) {
      return { ok: false, reason: 'completion-invalid-due-date' };
    }
    if (typeof c.completedAt !== 'string' || Number.isNaN(Date.parse(c.completedAt))) {
      return { ok: false, reason: 'completion-invalid-completed-at' };
    }
    const occKey = `${c.taskId}|${c.dueDate}`;
    if (seen.has(occKey)) return { ok: false, reason: 'duplicate-completion-occurrence' };
    seen.add(occKey);
    out.push({
      id: c.id,
      taskId: c.taskId,
      taskTitle: c.taskTitle,
      assignee: c.assignee,
      dueDate: c.dueDate,
      completedAt: c.completedAt,
    });
  }
  return { ok: true, state: out };
}

function validateChores(
  value: unknown,
): Ok<{ tasks: HouseholdTask[]; completions: ChoreCompletion[] }> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'chores-not-object' };
  const tasks = validateTasks(value.tasks);
  if (!tasks.ok) return tasks;
  const completions = validateCompletions(value.completions);
  if (!completions.ok) return completions;
  return { ok: true, state: { tasks: tasks.state, completions: completions.state } };
}

function validatePauses(value: unknown): Ok<PauseInterval[]> | Fail {
  if (!Array.isArray(value)) return { ok: false, reason: 'forest-pauses-not-array' };
  const out: PauseInterval[] = [];
  for (const p of value) {
    if (!isPlainObject(p)) return { ok: false, reason: 'pause-not-object' };
    if (typeof p.start !== 'string' || !isValidLocalDateKey(p.start)) {
      return { ok: false, reason: 'pause-invalid-start' };
    }
    if (p.end !== null && (typeof p.end !== 'string' || !isValidLocalDateKey(p.end))) {
      return { ok: false, reason: 'pause-invalid-end' };
    }
    out.push({ start: p.start, end: p.end });
  }
  return { ok: true, state: out };
}

function validateCreditLedger(value: unknown): Ok<CreditLedger> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'forest-ledger-not-object' };
  const out: CreditLedger = {};
  for (const [key, record] of Object.entries(value)) {
    if (!isPlainObject(record)) return { ok: false, reason: 'credit-not-object' };
    if (typeof record.grantedOn !== 'string' || !isValidLocalDateKey(record.grantedOn)) {
      return { ok: false, reason: 'credit-invalid-granted-on' };
    }
    if (record.status !== 'active' && record.status !== 'tombstoned') {
      return { ok: false, reason: 'credit-invalid-status' };
    }
    out[key] = { grantedOn: record.grantedOn, status: record.status };
  }
  return { ok: true, state: out };
}

function validateForest(value: unknown): Ok<ForestState> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'forest-not-object' };
  if (!isIntInRange(value.vitality, 0, VITALITY_MAX)) {
    return { ok: false, reason: 'forest-invalid-vitality' };
  }
  if (!isIntInRange(value.lifetimeCare, 0, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, reason: 'forest-invalid-lifetime-care' };
  }
  if (!isIntInRange(value.currentStreak, 0, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, reason: 'forest-invalid-current-streak' };
  }
  if (!isIntInRange(value.longestStreak, 0, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, reason: 'forest-invalid-longest-streak' };
  }
  if (
    value.lastMeaningfulActionDate !== null &&
    (typeof value.lastMeaningfulActionDate !== 'string' ||
      !isValidLocalDateKey(value.lastMeaningfulActionDate))
  ) {
    return { ok: false, reason: 'forest-invalid-last-action-date' };
  }
  if (!isIntInRange(value.growthStage, 1, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, reason: 'forest-invalid-growth-stage' };
  }
  if (!isStringArray(value.unlockedCreatureIds)) {
    return { ok: false, reason: 'forest-invalid-creatures' };
  }
  if (!isStringArray(value.unlockedEnvironmentIds)) {
    return { ok: false, reason: 'forest-invalid-environments' };
  }
  if (value.lastRareEvent !== null && typeof value.lastRareEvent !== 'string') {
    return { ok: false, reason: 'forest-invalid-rare-event' };
  }
  if (typeof value.paused !== 'boolean') return { ok: false, reason: 'forest-invalid-paused' };
  if (
    value.pausedAt !== null &&
    (typeof value.pausedAt !== 'string' || !isValidLocalDateKey(value.pausedAt))
  ) {
    return { ok: false, reason: 'forest-invalid-paused-at' };
  }
  const pauses = validatePauses(value.pauses);
  if (!pauses.ok) return pauses;
  const creditLedger = validateCreditLedger(value.creditLedger);
  if (!creditLedger.ok) return creditLedger;
  if (
    value.lastProcessedDay !== null &&
    (typeof value.lastProcessedDay !== 'string' || !isValidLocalDateKey(value.lastProcessedDay))
  ) {
    return { ok: false, reason: 'forest-invalid-processed-day' };
  }
  return {
    ok: true,
    state: {
      vitality: value.vitality,
      lifetimeCare: value.lifetimeCare,
      currentStreak: value.currentStreak,
      longestStreak: value.longestStreak,
      lastMeaningfulActionDate: value.lastMeaningfulActionDate,
      growthStage: value.growthStage,
      unlockedCreatureIds: value.unlockedCreatureIds,
      unlockedEnvironmentIds: value.unlockedEnvironmentIds,
      lastRareEvent: value.lastRareEvent,
      paused: value.paused,
      pausedAt: value.pausedAt,
      pauses: pauses.state,
      creditLedger: creditLedger.state,
      lastProcessedDay: value.lastProcessedDay,
    },
  };
}

function validateGroceries(value: unknown): Ok<{ items: GroceryItem[] }> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'groceries-not-object' };
  if (!Array.isArray(value.items)) return { ok: false, reason: 'groceries-items-not-array' };
  const seen = new Set<string>();
  const items: GroceryItem[] = [];
  for (const item of value.items) {
    if (!isPlainObject(item)) return { ok: false, reason: 'grocery-not-object' };
    if (typeof item.id !== 'string' || item.id.length === 0) {
      return { ok: false, reason: 'grocery-invalid-id' };
    }
    if (typeof item.label !== 'string') return { ok: false, reason: 'grocery-invalid-label' };
    if (typeof item.done !== 'boolean') return { ok: false, reason: 'grocery-invalid-done' };
    if (seen.has(item.id)) return { ok: false, reason: 'duplicate-grocery-id' };
    seen.add(item.id);
    items.push({ id: item.id, label: item.label, done: item.done });
  }
  return { ok: true, state: { items } };
}

/**
 * Validation à l'exécution d'un état applicatif V2. Réutilise la validation
 * V1 (testée) pour la partie budget. Ne lève jamais d'exception.
 */
export function validateAppState(
  value: unknown,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  try {
    if (!isPlainObject(value)) return { ok: false, reason: 'not-an-object' };
    if (value.schemaVersion !== 2) return { ok: false, reason: 'unknown-schema-version' };

    const budget = validatePersistedState({
      schemaVersion: 1,
      settings: isPlainObject(value.budget) ? value.budget.settings : undefined,
      months: isPlainObject(value.budget) ? value.budget.months : undefined,
      selectedMonth: isPlainObject(value.budget) ? value.budget.selectedMonth : undefined,
    });
    if (!budget.ok) return { ok: false, reason: `budget-${budget.reason}` };

    const household = validateHousehold(value.household);
    if (!household.ok) return household;
    const chores = validateChores(value.chores);
    if (!chores.ok) return chores;
    const forest = validateForest(value.forest);
    if (!forest.ok) return forest;
    const groceries = validateGroceries(value.groceries);
    if (!groceries.ok) return groceries;

    return {
      ok: true,
      state: {
        schemaVersion: 2,
        household: household.state,
        budget: {
          settings: budget.state.settings,
          months: budget.state.months,
          selectedMonth: budget.state.selectedMonth,
        },
        chores: chores.state,
        forest: forest.state,
        groceries: groceries.state,
      },
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

// ---------------------------------------------------------------------------
// Dispatch de versions (entrée unique du chargement)
// ---------------------------------------------------------------------------

/**
 * Charge et migre un état persisté vers l'état applicatif V2.
 * - `schemaVersion: 1` → validation V1 → migration pure vers V2.
 * - `schemaVersion: 2` → validation V2.
 * - autre / illisible → échec avec raison stable (le store conserve le contenu
 *   brut et bascule en mode récupération ; jamais d'écrasement silencieux).
 * Ne lève jamais d'exception.
 */
export function migrateState(
  value: unknown,
): { ok: true; state: AppState } | { ok: false; reason: string } {
  try {
    if (!isPlainObject(value)) return { ok: false, reason: 'not-an-object' };
    const version = value.schemaVersion;
    if (version === 1) {
      const v1 = validatePersistedState(value);
      if (!v1.ok) return { ok: false, reason: v1.reason };
      return { ok: true, state: migrateV1toV2(v1.state) };
    }
    if (version === 2) {
      return validateAppState(value);
    }
    return { ok: false, reason: 'unknown-schema-version' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
