/**
 * Lien Courses ↔ Maison. Une tâche Maison marquée `groceries` est « la tâche
 * courses » : Maison y montre les articles restants, Courses la complète
 * (même geste que Maison, `toggleTaskToday`) quand le panier est vidé.
 *
 * V5.3 : elle est PERMANENTE (« à tout moment », voir isAnytimeTask) —
 * jamais d'échéance ni de case au Calendrier, jamais « faite pour la
 * semaine » ; on la fait autant de fois qu'on veut, deux fois le même jour
 * compris. Seul repère : la dernière fois (lastGroceryRun).
 *
 * V5.4 : faite, elle quitte « à faire » (voir groceryRunDue) et revient
 * dès qu'un article est ajouté après la dernière fois.
 *
 * Fonctions pures, sans exception.
 */

import { localDateKey } from './dates.js';
import { whoDid } from './tasks.js';
import type { ChoreCompletion, GroceryItem, HouseholdTask, TaskAssignee } from './types.js';

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

/** La dernière fois que les courses ont été faites. */
export interface GroceryRun {
  completionId: string;
  /** Horodatage ISO. */
  at: string;
  who: TaskAssignee;
}

/** Dernier fait de la tâche (plus récent `completedAt`, puis id), ou undefined. */
export function lastGroceryRun(task: HouseholdTask, completions: readonly ChoreCompletion[]): GroceryRun | undefined {
  let last: ChoreCompletion | undefined;
  for (const c of completions) {
    if (c.taskId !== task.id) continue;
    if (last === undefined || c.completedAt > last.completedAt || (c.completedAt === last.completedAt && c.id > last.id)) last = c;
  }
  return last === undefined ? undefined : { completionId: last.id, at: last.completedAt, who: whoDid(last) };
}

/**
 * V5.4 — la tâche Courses est-elle « à faire » ? Oui si elle n'a jamais été
 * faite, si un article a été ajouté après la dernière fois (même le jour
 * même : deux courses dans la journée), ou si la dernière fois date d'avant
 * aujourd'hui et qu'il reste des articles à prendre. Sinon (faite, rien de
 * nouveau) elle n'apparaît que dans « Fait aujourd'hui ».
 */
export function groceryRunDue(
  task: HouseholdTask,
  completions: readonly ChoreCompletion[],
  items: readonly GroceryItem[],
  now: Date,
): boolean {
  const last = lastGroceryRun(task, completions);
  if (last === undefined) return true;
  const lastMs = Date.parse(last.at);
  for (const item of items) {
    if (item.addedAt !== undefined && Date.parse(item.addedAt) > lastMs) return true;
  }
  return localDateKey(new Date(last.at)) < localDateKey(now) && groceriesLeft(items) > 0;
}
