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
import { addCompletion, creditKeyFor, isDueOn, ONCE, removeCompletion } from './tasks.js';
import type { ChoreCompletion, ForestState, HouseholdTask } from './types.js';

/** Sous-état nécessaire à une bascule de tâche. */
export interface ChoresAndForest {
  chores: { tasks: HouseholdTask[]; completions: ChoreCompletion[] };
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
}

/**
 * Coche / décoche l'occurrence du jour d'une tâche (ou l'unique occurrence
 * d'une ponctuelle).
 *
 * - Cocher : ajoute le fait Maison (`completionId` fourni), accorde le crédit
 *   si possible (pause, cap, idempotence : voir grantCredit), puis met à jour
 *   streak, événements rares et déblocages si un crédit a été accordé.
 * - Décocher : retire le fait et met le crédit en tombstone (la croissance ne
 *   diminue jamais ; recocher ne redonne pas de crédit).
 * - La forêt est d'abord avancée au jour courant (advanceDay, idempotent).
 * - Tâche inconnue ou récurrente non due aujourd'hui → aucun changement.
 */
export function toggleTaskToday<S extends ChoresAndForest>(
  state: S,
  taskId: string,
  now: Date,
  completionId: string,
): ToggleTaskResult<S> {
  const task = state.chores.tasks.find((t) => t.id === taskId);
  if (task === undefined || (task.recurrence !== 'none' && !isDueOn(task, now))) {
    return { state, completed: false, completionId: null };
  }
  const day = localDateKey(now);
  const dueDate = task.recurrence === 'none' ? ONCE : day;
  const key = creditKeyFor(task, dueDate);
  const forest = advanceDay(state.forest, day);
  const existing = state.chores.completions.find(
    (c) => c.taskId === task.id && c.dueDate === dueDate,
  );

  if (existing !== undefined) {
    const removed = removeCompletion(state.chores.completions, task.id, dueDate);
    return {
      state: {
        ...state,
        chores: { ...state.chores, completions: removed.completions },
        forest: tombstoneCredit(forest, key).forest,
      },
      completed: false,
      completionId: existing.id,
    };
  }

  const added = addCompletion(state.chores.completions, task, dueDate, now, completionId);
  if (!added.added) return { state, completed: true, completionId: null };
  const credit = grantCredit(forest, key, day);
  let nextForest = credit.forest;
  if (credit.granted) {
    nextForest = updateStreak(nextForest, day);
    nextForest = evaluateRareEvents(nextForest, forest.currentStreak, nextForest.currentStreak).forest;
    nextForest = evaluateUnlocks(nextForest);
  }
  return {
    state: {
      ...state,
      chores: { ...state.chores, completions: added.completions },
      forest: nextForest,
    },
    completed: true,
    completionId,
  };
}
