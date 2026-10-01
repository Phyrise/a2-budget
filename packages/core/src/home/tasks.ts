/**
 * Tâches (Maison) : modèle à occurrences explicites.
 *
 * Une tâche récurrente génère des **occurrences** identifiées par
 * `(taskId, scheduledLocalDate)` ; une tâche ponctuelle a une unique
 * occurrence identifiée par `(taskId, once)`.
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
  HouseholdTask,
  TaskAssignee,
} from './types.js';
import {
  addDays,
  daysInMonth,
  isoWeekday,
  localDateKey,
  startOfWeek,
} from './dates.js';

/** Marque de dueDate pour une occurrence ponctuelle. */
export const ONCE = 'once';

/**
 * Clé stable d'une occurrence / crédit :
 * - ponctuelle : « ${taskId}|once »
 * - récurrente : « ${taskId}|${scheduledLocalDate} »
 */
export function creditKeyFor(task: HouseholdTask, scheduledLocalDate: string): string {
  if (task.recurrence === 'none') return `${task.id}|${ONCE}`;
  return `${task.id}|${scheduledLocalDate}`;
}

/** Décompose une clé d'occurrence en [taskId, dueDate]. */
export function splitCreditKey(creditKey: string): [string, string] {
  const idx = creditKey.lastIndexOf('|');
  if (idx <= 0) throw new RangeError(`invalid credit key: ${String(creditKey)}`);
  return [creditKey.slice(0, idx), creditKey.slice(idx + 1)];
}

/**
 * Vrai si une occurrence de la tâche est **due** cette date locale.
 * Récurrence sans dérive : weekly est ancrée sur le jour ISO, monthly sur le
 * jour du mois (ajusté au dernier jour si le mois est plus court).
 */
export function isDueOn(task: HouseholdTask, date: Date): boolean {
  switch (task.recurrence) {
    case 'none':
      return localDateKey(date) === task.createdAt;
    case 'daily':
      return true;
    case 'weekly': {
      const day = task.weeklyDay;
      if (day === undefined || day < 1 || day > 7) return false;
      return isoWeekday(date) === day;
    }
    case 'monthly': {
      const target = task.monthlyDay;
      if (target === undefined || target < 1 || target > 31) return false;
      const clamped = Math.min(target, daysInMonth(date));
      return date.getDate() === clamped;
    }
  }
}

/** Vrai si un fait Maison existe déjà pour cette occurrence. */
export function hasCompletion(
  completions: ChoreCompletion[],
  taskId: string,
  dueDate: string,
): boolean {
  return completions.some((c) => c.taskId === taskId && c.dueDate === dueDate);
}

/**
 * Vrai si la tâche est **actionnable aujourd'hui** : une occurrence due
 * aujourd'hui pas encore terminée, ou une ponctuelle pas encore terminée.
 */
export function isActionableToday(
  task: HouseholdTask,
  today: Date,
  completions: ChoreCompletion[],
): boolean {
  if (task.recurrence === 'none') {
    return !hasCompletion(completions, task.id, ONCE);
  }
  const dateKey = localDateKey(today);
  if (!isDueOn(task, today)) return false;
  return !hasCompletion(completions, task.id, dateKey);
}

/**
 * Ajoute un fait Maison pour l'occurrence (taskId, dueDate). **Idempotent** :
 * si le fait existe déjà, aucun doublon n'est créé et `added` est false.
 * Pur : ne mute jamais `completions`.
 */
export function addCompletion(
  completions: ChoreCompletion[],
  task: HouseholdTask,
  dueDate: string,
  now: Date,
  id: string,
): { completions: ChoreCompletion[]; added: boolean } {
  if (hasCompletion(completions, task.id, dueDate)) {
    return { completions, added: false };
  }
  const completion: ChoreCompletion = {
    id,
    taskId: task.id,
    taskTitle: task.title,
    assignee: task.assignee,
    dueDate,
    completedAt: now.toISOString(),
  };
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

/**
 * Répartition factuelle de la semaine courante (lundi → dimanche) : qui a fait
 * quoi, comptée sur **tous** les faits Maison de la semaine (completedAt).
 * Purement descriptive — aucune note, aucun classement.
 */
export function weeklyDistribution(
  completions: ChoreCompletion[],
  now: Date,
): { a: number; b: number; both: number; unassigned: number } {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  let a = 0;
  let b = 0;
  let both = 0;
  let unassigned = 0;
  for (const c of completions) {
    const t = new Date(c.completedAt);
    if (t >= weekStart && t < weekEnd) {
      if (c.assignee === 'a') a += 1;
      else if (c.assignee === 'b') b += 1;
      else if (c.assignee === 'both') both += 1;
      else unassigned += 1;
    }
  }
  return { a, b, both, unassigned };
}

/** Tâches actionnables aujourd'hui (pour la vue « Aujourd'hui »). */
export function actionableTasksToday(
  tasks: HouseholdTask[],
  today: Date,
  completions: ChoreCompletion[],
): HouseholdTask[] {
  return tasks.filter((t) => isActionableToday(t, today, completions));
}

/**
 * Crée une tâche. Valide la cohérence récurrence/jour :
 * - weekly exige weeklyDay ∈ [1,7]
 * - monthly exige monthlyDay ∈ [1,31]
 * - none/daily n'ont pas de jour
 * Lève une RangeError si incohérent.
 */
export function createTask(
  input: {
    id: string;
    title: string;
    description?: string;
    assignee: TaskAssignee;
    recurrence: HouseholdTask['recurrence'];
    weeklyDay?: number;
    monthlyDay?: number;
  },
  createdAt: string,
): HouseholdTask {
  if (input.title.trim() === '') {
    throw new RangeError('task title must not be empty');
  }
  if (input.recurrence === 'weekly') {
    if (input.weeklyDay === undefined || input.weeklyDay < 1 || input.weeklyDay > 7) {
      throw new RangeError('weekly task requires weeklyDay in [1,7]');
    }
  }
  if (input.recurrence === 'monthly') {
    if (input.monthlyDay === undefined || input.monthlyDay < 1 || input.monthlyDay > 31) {
      throw new RangeError('monthly task requires monthlyDay in [1,31]');
    }
  }
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    assignee: input.assignee,
    recurrence: input.recurrence,
    weeklyDay: input.recurrence === 'weekly' ? input.weeklyDay : undefined,
    monthlyDay: input.recurrence === 'monthly' ? input.monthlyDay : undefined,
    createdAt,
  };
}
