/**
 * Tâches (Maison) : modèle à occurrences explicites.
 *
 * Une tâche récurrente génère des **occurrences** identifiées par
 * `(taskId, dueDate)` (voir occurrences.ts) ; une tâche ponctuelle a une
 * unique occurrence identifiée par `(taskId, once)`.
 *
 * - Terminer une occurrence est **idempotent** : une seconde complétion du
 *   même événement est un no-op.
 * - L'annulation est **cohérente** : elle retire exactement le fait Maison de
 *   cette occurrence (et, côté forêt, met le crédit en tombstone).
 * - La répartition factuelle compte **tous** les faits Maison, indépendamment
 *   des crédits de la forêt.
 *
 * Fonctions pures : ne mutent jamais leurs entrées.
 */

import type {
  ChoreCompletion,
  ChoreDoer,
  ChoreSkip,
  HouseholdTask,
  TaskAssignee,
} from './types.js';
import { addDays, startOfWeek } from './dates.js';
import {
  findOccurrenceCompletion,
  hasCompletion,
  isDueOn,
  isSkipped,
} from './occurrences.js';

export {
  ONCE,
  creditKeyFor,
  splitCreditKey,
  isDueOn,
  hasCompletion,
  isFlexibleWeekly,
  weekStartKey,
  occurrenceDateFor,
  skipDateFor,
  findOccurrenceCompletion,
  isSkipped,
} from './occurrences.js';
export { createTask, updateTask, deleteTask, isTaskEffort } from './taskEdit.js';
export type { TaskPatch } from './taskEdit.js';
export { upcomingOccurrences } from './upcoming.js';
export type { UpcomingOccurrence } from './upcoming.js';

/** Qui a réellement fait une occurrence : `doneBy ?? assignee`. */
export function whoDid(completion: ChoreCompletion): TaskAssignee {
  return completion.doneBy ?? completion.assignee;
}

/**
 * Vrai si la tâche est **actionnable aujourd'hui** : une occurrence due
 * aujourd'hui pas encore terminée (pour une hebdomadaire souple : pas encore
 * faite cette semaine), ou une ponctuelle pas encore terminée — et, si
 * `skips` est fourni, pas passée (« pas aujourd'hui »).
 */
export function isActionableToday(
  task: HouseholdTask,
  today: Date,
  completions: ChoreCompletion[],
  skips?: readonly ChoreSkip[],
): boolean {
  if (task.recurrence !== 'none' && !isDueOn(task, today)) return false;
  if (findOccurrenceCompletion(task, completions, today) !== undefined) return false;
  return !isSkipped(task, skips, today);
}

/**
 * À qui revient la **prochaine** occurrence :
 * - tâche en tour à tour (`rotation`, assignee 'a'/'b') : l'opposé de la
 *   personne qui avait le tour au plus récent fait de cette tâche (par
 *   completedAt). Ce « tour » vaut `doneBy ?? assignee` quand c'est 'a' ou
 *   'b' ; pour un fait « à deux », c'est l'`assignee` enregistré (la
 *   personne dont c'était le tour) : le tour tourne quand même. Sans fait
 *   exploitable, `task.assignee` (la personne qui commence) ;
 * - autres tâches : `task.assignee`.
 */
export function nextAssignee(task: HouseholdTask, completions: ChoreCompletion[]): TaskAssignee {
  if (task.rotation !== true || (task.assignee !== 'a' && task.assignee !== 'b')) {
    return task.assignee;
  }
  let last: ChoreCompletion | undefined;
  let lastOwner: 'a' | 'b' | undefined;
  for (const c of completions) {
    if (c.taskId !== task.id) continue;
    const owner = turnOwner(c);
    if (owner === undefined) continue;
    if (last === undefined || c.completedAt >= last.completedAt) {
      last = c;
      lastOwner = owner;
    }
  }
  if (lastOwner === undefined) return task.assignee;
  return lastOwner === 'a' ? 'b' : 'a';
}

/** Personne dont c'était le tour pour ce fait ('a' / 'b'), si connue. */
function turnOwner(c: ChoreCompletion): 'a' | 'b' | undefined {
  const who = whoDid(c);
  if (who === 'a' || who === 'b') return who;
  if (c.assignee === 'a' || c.assignee === 'b') return c.assignee;
  return undefined;
}

/**
 * Ajoute un fait Maison pour l'occurrence (taskId, dueDate). **Idempotent** :
 * si le fait existe déjà, aucun doublon n'est créé et `added` est false.
 * `assignee` du fait = nextAssignee (= task.assignee hors tour à tour).
 * `doneBy` (V3) n'est enregistré que s'il diffère de cet assignee.
 * Pur : ne mute jamais `completions`.
 */
export function addCompletion(
  completions: ChoreCompletion[],
  task: HouseholdTask,
  dueDate: string,
  now: Date,
  id: string,
  doneBy?: ChoreDoer,
): { completions: ChoreCompletion[]; added: boolean } {
  if (hasCompletion(completions, task.id, dueDate)) {
    return { completions, added: false };
  }
  const assignee = nextAssignee(task, completions);
  const completion: ChoreCompletion = {
    id,
    taskId: task.id,
    taskTitle: task.title,
    assignee,
    dueDate,
    completedAt: now.toISOString(),
  };
  if (doneBy !== undefined && doneBy !== assignee) completion.doneBy = doneBy;
  return { completions: [...completions, completion], added: true };
}

/**
 * Retire le fait Maison de l'occurrence (taskId, dueDate). **Idempotent** :
 * si le fait n'existe pas, `removed` est false. Pur.
 */
export function removeCompletion(
  completions: ChoreCompletion[],
  taskId: string,
  dueDate: string,
): { completions: ChoreCompletion[]; removed: boolean } {
  const index = completions.findIndex(
    (c) => c.taskId === taskId && c.dueDate === dueDate,
  );
  if (index === -1) return { completions, removed: false };
  const next = completions.slice();
  next.splice(index, 1);
  return { completions: next, removed: true };
}

/** Faits Maison dont completedAt tombe dans la semaine (lun → dim) de `now`. */
export function completionsOfWeek(completions: ChoreCompletion[], now: Date): ChoreCompletion[] {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  return completions.filter((c) => {
    const t = new Date(c.completedAt);
    return t >= weekStart && t < weekEnd;
  });
}

/**
 * Répartition factuelle de la semaine courante (lundi → dimanche) : qui a fait
 * quoi (`doneBy ?? assignee`), comptée sur **tous** les faits Maison de la
 * semaine (completedAt). Purement descriptive — aucune note, aucun classement.
 */
export function weeklyDistribution(
  completions: ChoreCompletion[],
  now: Date,
): { a: number; b: number; both: number; unassigned: number } {
  let a = 0;
  let b = 0;
  let both = 0;
  let unassigned = 0;
  for (const c of completionsOfWeek(completions, now)) {
    const who = whoDid(c);
    if (who === 'a') a += 1;
    else if (who === 'b') b += 1;
    else if (who === 'both') both += 1;
    else unassigned += 1;
  }
  return { a, b, both, unassigned };
}

/** Tâches actionnables aujourd'hui (pour la vue « Aujourd'hui »). */
export function actionableTasksToday(
  tasks: HouseholdTask[],
  today: Date,
  completions: ChoreCompletion[],
  skips?: readonly ChoreSkip[],
): HouseholdTask[] {
  return tasks.filter((t) => isActionableToday(t, today, completions, skips));
}
