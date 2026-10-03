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

const ASSIGNEES: ReadonlySet<string> = new Set(['a', 'b', 'both', 'unassigned']);
const RECURRENCES: ReadonlySet<string> = new Set(['none', 'daily', 'weekly', 'monthly']);

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validation commune création / édition (mêmes règles que validateAppState,
 * pour qu'une tâche acceptée ici se recharge toujours). Lève une RangeError.
 */
function assertTaskFields(fields: {
  title: string;
  assignee: string;
  recurrence: string;
  weeklyDay?: number | undefined;
  monthlyDay?: number | undefined;
}): void {
  if (typeof fields.title !== 'string' || fields.title.trim() === '') {
    throw new RangeError('task title must not be empty');
  }
  if (!ASSIGNEES.has(fields.assignee)) throw new RangeError('invalid task assignee');
  if (!RECURRENCES.has(fields.recurrence)) throw new RangeError('invalid task recurrence');
  if (fields.recurrence === 'weekly' && !isIntIn(fields.weeklyDay, 1, 7)) {
    throw new RangeError('weekly task requires weeklyDay in [1,7]');
  }
  if (fields.recurrence === 'monthly' && !isIntIn(fields.monthlyDay, 1, 31)) {
    throw new RangeError('monthly task requires monthlyDay in [1,31]');
  }
}

/**
 * Crée une tâche. Valide la cohérence récurrence/jour :
 * - titre non vide (espaces de bord retirés) ;
 * - assignee / récurrence connus ;
 * - weekly exige weeklyDay entier ∈ [1,7]
 * - monthly exige monthlyDay entier ∈ [1,31]
 * - none/daily n'ont pas de jour (un jour fourni est ignoré)
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
  assertTaskFields(input);
  return {
    id: input.id,
    title: input.title.trim(),
    description: input.description,
    assignee: input.assignee,
    recurrence: input.recurrence,
    weeklyDay: input.recurrence === 'weekly' ? input.weeklyDay : undefined,
    monthlyDay: input.recurrence === 'monthly' ? input.monthlyDay : undefined,
    createdAt,
  };
}

// ---------------------------------------------------------------------------
// Édition / suppression
// ---------------------------------------------------------------------------

/** Champs modifiables d'une tâche. */
export type TaskPatch = Partial<
  Pick<HouseholdTask, 'title' | 'assignee' | 'recurrence' | 'weeklyDay' | 'monthlyDay' | 'description'>
>;

/**
 * Modifie une tâche (titre, assignee, récurrence, jour de semaine / du mois,
 * description). La tâche résultante est validée comme à la création :
 * - titre non vide (espaces de bord retirés) ;
 * - assignee / récurrence connus ;
 * - weekly exige weeklyDay ∈ [1,7] (celui du patch, sinon l'ancien) ;
 * - monthly exige monthlyDay ∈ [1,31] (idem) ;
 * - les jours sans objet pour la récurrence finale sont retirés.
 * Lève une RangeError si incohérent (rien n'est modifié).
 *
 * `id` et `createdAt` ne changent jamais. Les faits Maison passés gardent
 * leur copie du titre et de l'assignee (historique fidèle) ; les crédits de la
 * forêt sont inchangés. Id inconnu ou patch sans effet → même référence.
 */
export function updateTask(tasks: HouseholdTask[], id: string, patch: TaskPatch): HouseholdTask[] {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  const current = tasks[index]!;

  const title = patch.title !== undefined ? patch.title.trim() : current.title;
  const assignee = patch.assignee ?? current.assignee;
  const recurrence = patch.recurrence ?? current.recurrence;
  const weeklyDay = patch.weeklyDay ?? current.weeklyDay;
  const monthlyDay = patch.monthlyDay ?? current.monthlyDay;
  assertTaskFields({ title, assignee, recurrence, weeklyDay, monthlyDay });

  const next: HouseholdTask = {
    id: current.id,
    title,
    description: patch.description !== undefined ? patch.description : current.description,
    assignee,
    recurrence,
    weeklyDay: recurrence === 'weekly' ? weeklyDay : undefined,
    monthlyDay: recurrence === 'monthly' ? monthlyDay : undefined,
    createdAt: current.createdAt,
  };
  if (
    next.title === current.title &&
    next.description === current.description &&
    next.assignee === current.assignee &&
    next.recurrence === current.recurrence &&
    next.weeklyDay === current.weeklyDay &&
    next.monthlyDay === current.monthlyDay
  ) {
    return tasks;
  }
  const out = tasks.slice();
  out[index] = next;
  return out;
}

/**
 * Supprime une tâche (modèle). Les faits Maison passés **restent** dans
 * l'historique et la répartition (ils portent leur propre copie du titre) ;
 * les crédits de la forêt sont conservés. Id inconnu → même référence.
 */
export function deleteTask(tasks: HouseholdTask[], id: string): HouseholdTask[] {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  const out = tasks.slice();
  out.splice(index, 1);
  return out;
}

// ---------------------------------------------------------------------------
// À venir
// ---------------------------------------------------------------------------

/** Une occurrence à venir (non cochable). */
export interface UpcomingOccurrence {
  task: HouseholdTask;
  /** Date d'échéance locale « YYYY-MM-DD ». */
  date: string;
  /** 1 = demain, 2 = après-demain… */
  daysFromNow: number;
}

/**
 * Prochaines occurrences des tâches récurrentes sur les `days` jours qui
 * **suivent** `from` (demain → from + days, bornes incluses ; aujourd'hui est
 * couvert par actionableTasksToday). Les ponctuelles (`none`) n'ont pas
 * d'occurrence future et sont exclues ; une occurrence déjà terminée est
 * omise. Tri : date croissante, puis ordre des tâches.
 * `includeDaily: false` omet les tâches quotidiennes (peu informatives dans
 * « À venir »). `days` est borné à [0, 366].
 */
export function upcomingOccurrences(
  tasks: HouseholdTask[],
  completions: ChoreCompletion[],
  from: Date,
  days: number,
  options: { includeDaily?: boolean } = {},
): UpcomingOccurrence[] {
  const includeDaily = options.includeDaily ?? true;
  const span = Math.max(0, Math.min(366, Math.floor(days)));
  const out: UpcomingOccurrence[] = [];
  for (let offset = 1; offset <= span; offset += 1) {
    const date = addDays(from, offset);
    const key = localDateKey(date);
    for (const task of tasks) {
      if (task.recurrence === 'none') continue;
      if (task.recurrence === 'daily' && !includeDaily) continue;
      if (!isDueOn(task, date)) continue;
      if (hasCompletion(completions, task.id, key)) continue;
      out.push({ task, date: key, daysFromNow: offset });
    }
  }
  return out;
}
