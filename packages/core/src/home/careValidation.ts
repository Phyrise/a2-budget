/**
 * Validation des champs V3 « Prendre soin ensemble » (tous optionnels).
 *
 * Règle de rétrocompatibilité : un champ **absent** (ou null pour les blocs)
 * n'est jamais inventé ; un champ **présent** doit avoir le type exact, sinon
 * raison stable. Les valeurs valides sont recopiées telles quelles (un JSON
 * se recharge à l'identique).
 */

import { isValidLocalDateKey } from './dates.js';
import { ONCE } from './occurrences.js';
import { isWeekStartKey } from './rituals.js';
import { FOCUS_MINUTES_MAX } from './focus.js';
import { isLanternUnlocked } from './lanterns.js';
import type {
  ChoreCompletion,
  ChoreSkip,
  Circle,
  FocusSession,
  FocusState,
  HouseholdTask,
  RitualsState,
} from './types.js';
import {
  isDoer,
  isIntInRange,
  isIsoTimestamp,
  isPerson,
  isPlainObject,
  type Fail,
  type Ok,
} from './validationHelpers.js';

type TaskCare = Pick<HouseholdTask, 'effort' | 'rotation' | 'flexible'>;

/** effort ∈ {1,2,3} ; rotation booléen (true exige a/b) ; flexible booléen (true exige weekly). */
export function validateTaskCare(
  value: Record<string, unknown>,
  assignee: string,
  recurrence: string,
): Ok<TaskCare> | Fail {
  const out: TaskCare = {};
  if (value.effort !== undefined) {
    if (value.effort !== 1 && value.effort !== 2 && value.effort !== 3) {
      return { ok: false, reason: 'task-invalid-effort' };
    }
    out.effort = value.effort;
  }
  if (value.rotation !== undefined) {
    if (typeof value.rotation !== 'boolean') return { ok: false, reason: 'task-invalid-rotation' };
    if (value.rotation && assignee !== 'a' && assignee !== 'b') {
      return { ok: false, reason: 'task-rotation-requires-person' };
    }
    out.rotation = value.rotation;
  }
  if (value.flexible !== undefined) {
    if (typeof value.flexible !== 'boolean') return { ok: false, reason: 'task-invalid-flexible' };
    if (value.flexible && recurrence !== 'weekly') {
      return { ok: false, reason: 'task-flexible-requires-weekly' };
    }
    out.flexible = value.flexible;
  }
  return { ok: true, state: out };
}

/** doneBy ∈ {'a','b','both'} s'il est présent. */
export function validateCompletionCare(
  value: Record<string, unknown>,
): Ok<Pick<ChoreCompletion, 'doneBy'>> | Fail {
  if (value.doneBy === undefined) return { ok: true, state: {} };
  if (!isDoer(value.doneBy)) return { ok: false, reason: 'completion-invalid-done-by' };
  return { ok: true, state: { doneBy: value.doneBy } };
}

/** chores.skips : ids uniques, une seule entrée par occurrence. */
export function validateSkips(value: unknown): Ok<ChoreSkip[]> | Fail {
  if (!Array.isArray(value)) return { ok: false, reason: 'skips-not-array' };
  const ids = new Set<string>();
  const occurrences = new Set<string>();
  const out: ChoreSkip[] = [];
  for (const s of value) {
    if (!isPlainObject(s)) return { ok: false, reason: 'skip-not-object' };
    if (typeof s.id !== 'string' || s.id === '') return { ok: false, reason: 'skip-invalid-id' };
    if (ids.has(s.id)) return { ok: false, reason: 'duplicate-skip-id' };
    ids.add(s.id);
    if (typeof s.taskId !== 'string' || s.taskId === '') {
      return { ok: false, reason: 'skip-invalid-task-id' };
    }
    if (typeof s.dueDate !== 'string' || (s.dueDate !== ONCE && !isValidLocalDateKey(s.dueDate))) {
      return { ok: false, reason: 'skip-invalid-due-date' };
    }
    if (!isIsoTimestamp(s.at)) return { ok: false, reason: 'skip-invalid-at' };
    const occ = `${s.taskId}|${s.dueDate}`;
    if (occurrences.has(occ)) return { ok: false, reason: 'duplicate-skip-occurrence' };
    occurrences.add(occ);
    const skip: ChoreSkip = { id: s.id, taskId: s.taskId, dueDate: s.dueDate, at: s.at };
    if (s.by !== undefined) {
      if (!isPerson(s.by)) return { ok: false, reason: 'skip-invalid-by' };
      skip.by = s.by;
    }
    out.push(skip);
  }
  return { ok: true, state: out };
}

function validateCircle(c: unknown): Ok<Circle> | Fail {
  if (!isPlainObject(c)) return { ok: false, reason: 'circle-not-object' };
  if (typeof c.id !== 'string' || c.id === '') return { ok: false, reason: 'circle-invalid-id' };
  if (!isWeekStartKey(c.weekStart)) return { ok: false, reason: 'circle-invalid-week-start' };
  if (!isIsoTimestamp(c.heldAt)) return { ok: false, reason: 'circle-invalid-held-at' };
  if (!Array.isArray(c.gratitude) || !Array.isArray(c.burdens) || !Array.isArray(c.intentions)) {
    return { ok: false, reason: 'circle-invalid-lists' };
  }
  const gratitude: Circle['gratitude'] = [];
  for (const g of c.gratitude) {
    if (!isPlainObject(g) || !isPerson(g.from) || !isPerson(g.to) || typeof g.text !== 'string') {
      return { ok: false, reason: 'circle-invalid-gratitude' };
    }
    gratitude.push({ from: g.from, to: g.to, text: g.text });
  }
  const burdens: Circle['burdens'] = [];
  for (const b of c.burdens) {
    if (!isPlainObject(b) || !isPerson(b.who) || typeof b.text !== 'string') {
      return { ok: false, reason: 'circle-invalid-burden' };
    }
    burdens.push({ who: b.who, text: b.text });
  }
  if (!c.intentions.every((i) => typeof i === 'string')) {
    return { ok: false, reason: 'circle-invalid-intention' };
  }
  return {
    ok: true,
    state: { id: c.id, weekStart: c.weekStart, heldAt: c.heldAt, gratitude, burdens, intentions: [...c.intentions] },
  };
}

/** rituals : { circles } — ids uniques, un cercle par semaine. */
export function validateRituals(value: unknown): Ok<RitualsState> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'rituals-not-object' };
  if (!Array.isArray(value.circles)) return { ok: false, reason: 'rituals-circles-not-array' };
  const ids = new Set<string>();
  const weeks = new Set<string>();
  const circles: Circle[] = [];
  for (const raw of value.circles) {
    const r = validateCircle(raw);
    if (!r.ok) return r;
    if (ids.has(r.state.id)) return { ok: false, reason: 'duplicate-circle-id' };
    if (weeks.has(r.state.weekStart)) return { ok: false, reason: 'duplicate-circle-week' };
    ids.add(r.state.id);
    weeks.add(r.state.weekStart);
    circles.push(r.state);
  }
  return { ok: true, state: { circles } };
}

/** focus : { sessions } — ids uniques, minutes 1..120, au plus 500 sessions. */
export function validateFocus(value: unknown): Ok<FocusState> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'focus-not-object' };
  if (!Array.isArray(value.sessions)) return { ok: false, reason: 'focus-sessions-not-array' };
  if (value.sessions.length > 500) return { ok: false, reason: 'focus-too-many-sessions' };
  const ids = new Set<string>();
  const sessions: FocusSession[] = [];
  for (const s of value.sessions) {
    if (!isPlainObject(s)) return { ok: false, reason: 'focus-session-not-object' };
    if (typeof s.id !== 'string' || s.id === '') return { ok: false, reason: 'focus-invalid-id' };
    if (ids.has(s.id)) return { ok: false, reason: 'duplicate-focus-id' };
    ids.add(s.id);
    if (!isIsoTimestamp(s.startedAt)) return { ok: false, reason: 'focus-invalid-started-at' };
    if (!isIntInRange(s.minutes, 1, FOCUS_MINUTES_MAX)) return { ok: false, reason: 'focus-invalid-minutes' };
    if (!isDoer(s.who)) return { ok: false, reason: 'focus-invalid-who' };
    const out: FocusSession = { id: s.id, startedAt: s.startedAt, minutes: s.minutes, who: s.who };
    if (s.label !== undefined) {
      if (typeof s.label !== 'string') return { ok: false, reason: 'focus-invalid-label' };
      out.label = s.label;
    }
    if (s.taskId !== undefined) {
      if (typeof s.taskId !== 'string') return { ok: false, reason: 'focus-invalid-task-id' };
      out.taskId = s.taskId;
    }
    if (s.completed !== undefined) {
      if (typeof s.completed !== 'boolean') return { ok: false, reason: 'focus-invalid-completed' };
      out.completed = s.completed;
    }
    sessions.push(out);
  }
  const state: FocusState = { sessions };
  // V4 — lanterne choisie : type exact exigé ; inconnue ou verrouillée → ignorée.
  if (value.selectedLantern !== undefined && value.selectedLantern !== null) {
    if (typeof value.selectedLantern !== 'string') return { ok: false, reason: 'focus-invalid-selected-lantern' };
    if (isLanternUnlocked(sessions, value.selectedLantern)) state.selectedLantern = value.selectedLantern;
  }
  return { ok: true, state };
}
