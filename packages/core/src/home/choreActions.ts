/**
 * Actions composées Maison + Forêt (pures), utilisées par le store.
 *
 * Elles réunissent les briques testées (tasks.ts, forest.ts) dans l'ordre
 * exact attendu, pour que le store n'ait plus de logique de domaine et que la
 * sémantique crédits / tombstones soit testée ici.
 */

import { localDateKey } from './dates.js';
import {
  advanceDay,
  evaluateRareEvents,
  evaluateUnlocks,
  grantCredit,
  tombstoneCredit,
  updateStreak,
} from './forest.js';
import {
  addCompletion,
  creditKeyFor,
  findOccurrenceCompletion,
  isDueOn,
  isFlexibleWeekly,
  isSkipped,
  occurrenceDateFor,
  removeCompletion,
  whoDid,
} from './tasks.js';
import type {
  ChoreCompletion,
  ChoreDoer,
  ChoreSkip,
  ForestState,
  HouseholdTask,
  TaskAssignee,
} from './types.js';

/** Sous-état nécessaire à une bascule de tâche. */
export interface ChoresAndForest {
  chores: { tasks: HouseholdTask[]; completions: ChoreCompletion[]; skips?: ChoreSkip[] };
  forest: ForestState;
}

/** Résultat d'une bascule de tâche. */
export interface ToggleTaskResult<S extends ChoresAndForest> {
  /** Nouvel état (même référence si rien n'a changé). */
  state: S;
  /** Vrai si l'occurrence du jour est désormais terminée. */
  completed: boolean;
  /**
   * Id du fait Maison créé (completed = true) ou retiré (completed = false) ;
   * null si rien n'a changé (tâche inconnue ou non due aujourd'hui).
   */
  completionId: string | null;
  /**
   * V3 — qui a fait l'occurrence cochée ou décochée (`doneBy ?? assignee` du
   * fait) ; absent si rien n'a changé (forme V2 du résultat conservée).
   */
  doneBy?: TaskAssignee;
}

/**
 * Coche / décoche l'occurrence du jour d'une tâche (ou l'unique occurrence
 * d'une ponctuelle ; pour une hebdomadaire souple, l'occurrence de la semaine).
 *
 * - Cocher : ajoute le fait Maison (`completionId` fourni, `opts.doneBy`
 *   facultatif — défaut : nextAssignee), accorde le crédit si possible (pause,
 *   cap, idempotence : voir grantCredit), puis met à jour streak, événements
 *   rares et déblocages si un crédit a été accordé. Le crédit ne dépend
 *   jamais de doneBy ni de l'effort.
 * - Décocher : retire le fait et met le crédit en tombstone (la croissance ne
 *   diminue jamais ; recocher ne redonne pas de crédit).
 * - La forêt est d'abord avancée au jour courant (advanceDay, idempotent).
 * - Tâche inconnue, récurrente non due aujourd'hui, ou occurrence passée
 *   (« pas aujourd'hui ») non faite → aucun changement.
 */
export function toggleTaskToday<S extends ChoresAndForest>(
  state: S,
  taskId: string,
  now: Date,
  completionId: string,
  opts: { doneBy?: ChoreDoer } = {},
): ToggleTaskResult<S> {
  const unchanged: ToggleTaskResult<S> = { state, completed: false, completionId: null };
  const task = state.chores.tasks.find((t) => t.id === taskId);
  if (task === undefined || (task.recurrence !== 'none' && !isDueOn(task, now))) {
    return unchanged;
  }
  const day = localDateKey(now);
  const existing = findOccurrenceCompletion(task, state.chores.completions, now);

  if (existing !== undefined) {
    const forest = advanceDay(state.forest, day);
    const key = isFlexibleWeekly(task)
      ? `${task.id}|${existing.dueDate}`
      : creditKeyFor(task, existing.dueDate);
    const removed = removeCompletion(state.chores.completions, task.id, existing.dueDate);
    return {
      state: {
        ...state,
        chores: { ...state.chores, completions: removed.completions },
        forest: tombstoneCredit(forest, key).forest,
      },
      completed: false,
      completionId: existing.id,
      doneBy: whoDid(existing),
    };
  }

  if (isSkipped(task, state.chores.skips, now)) return unchanged;
  const forest = advanceDay(state.forest, day);
  const dueDate = occurrenceDateFor(task, now);
  const key = creditKeyFor(task, dueDate);
  const added = addCompletion(
    state.chores.completions,
    task,
    dueDate,
    now,
    completionId,
    opts.doneBy,
  );
  if (!added.added) return { state, completed: true, completionId: null };
  const credit = grantCredit(forest, key, day);
  let nextForest = credit.forest;
  if (credit.granted) {
    nextForest = updateStreak(nextForest, day);
    nextForest = evaluateRareEvents(nextForest, forest.currentStreak, nextForest.currentStreak).forest;
    nextForest = evaluateUnlocks(nextForest);
  }
  const created = added.completions[added.completions.length - 1]!;
  return {
    state: {
      ...state,
      chores: { ...state.chores, completions: added.completions },
      forest: nextForest,
    },
    completed: true,
    completionId,
    doneBy: whoDid(created),
  };
}
