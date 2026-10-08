/**
 * V5.2 — lien Courses ↔ Maison. Une tâche Maison marquée `groceries` est
 * « la tâche courses » : Maison y montre les articles restants, Courses
 * rappelle sa prochaine échéance et la complète (même geste que Maison,
 * `toggleTaskToday`) quand le panier est vidé.
 *
 * Fonctions pures, sans exception.
 */

import { isActionableToday } from './tasks.js';
import { upcomingOccurrences } from './upcoming.js';
import type { ChoreCompletion, ChoreSkip, GroceryItem, HouseholdTask } from './types.js';

/** Horizon de recherche de la prochaine échéance (jours). */
export const GROCERY_TASK_LOOKAHEAD_DAYS = 62;

/** La tâche liée aux courses (la première, s'il y en avait plusieurs). */
export function groceryTaskOf(tasks: readonly HouseholdTask[]): HouseholdTask | undefined {
  return tasks.find((t) => t.groceries === true);
}

/** Articles encore à prendre (pas dans le panier). */
export function groceriesLeft(items: readonly GroceryItem[]): number {
  let n = 0;
  for (const item of items) if (!item.done) n += 1;
  return n;
}

/** Où en est la tâche courses. */
export type GroceryTaskStatus =
  /** Occurrence ouverte aujourd'hui (cette semaine pour une souple) : à compléter. */
  | { kind: 'open' }
  /** Rien d'ouvert aujourd'hui ; prochaine échéance « YYYY-MM-DD » (lundi pour une souple). */
  | { kind: 'next'; date: string; daysFromNow: number }
  /** Rien d'ouvert ni à venir (ponctuelle faite, ou au-delà de l'horizon). */
  | { kind: 'none' };

export function groceryTaskStatus(
  task: HouseholdTask,
  completions: readonly ChoreCompletion[],
  skips: readonly ChoreSkip[] | undefined,
  now: Date,
): GroceryTaskStatus {
  const list = completions as ChoreCompletion[];
  if (isActionableToday(task, now, list, skips)) return { kind: 'open' };
  const next = upcomingOccurrences([task], list, now, GROCERY_TASK_LOOKAHEAD_DAYS, skips ? { skips } : {})[0];
  return next ? { kind: 'next', date: next.date, daysFromNow: next.daysFromNow } : { kind: 'none' };
}
