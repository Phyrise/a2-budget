/**
 * Tâches : création, édition, suppression (pures, validées comme
 * validateAppState pour qu'une tâche acceptée ici se recharge toujours).
 */

import type { HouseholdTask, TaskAssignee, TaskEffort } from './types.js';

const ASSIGNEES: ReadonlySet<string> = new Set(['a', 'b', 'both', 'unassigned']);
const RECURRENCES: ReadonlySet<string> = new Set(['none', 'daily', 'weekly', 'monthly']);

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Vrai si la valeur est un effort valide (1, 2 ou 3). */
export function isTaskEffort(value: unknown): value is TaskEffort {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Validation commune création / édition. Lève une RangeError.
 */
function assertTaskFields(fields: {
  title: string;
  assignee: string;
  recurrence: string;
  weeklyDay?: number | undefined;
  monthlyDay?: number | undefined;
  effort?: number | undefined;
  rotation?: boolean | undefined;
  flexible?: boolean | undefined;
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
  if (fields.effort !== undefined && !isTaskEffort(fields.effort)) {
    throw new RangeError('task effort must be 1, 2 or 3');
  }
  if (fields.rotation === true && fields.assignee !== 'a' && fields.assignee !== 'b') {
    throw new RangeError('rotation requires assignee a or b');
  }
  if (fields.flexible === true && fields.recurrence !== 'weekly') {
    throw new RangeError('flexible requires weekly recurrence');
  }
}

/** Ajoute les champs V3 seulement s'ils sont significatifs (jamais inventés). */
function withCareFields(
  base: HouseholdTask,
  effort: TaskEffort | undefined,
  rotation: boolean | undefined,
  flexible: boolean | undefined,
): HouseholdTask {
  const out: HouseholdTask = { ...base };
  if (effort !== undefined) out.effort = effort;
  if (rotation === true) out.rotation = true;
  if (flexible === true && base.recurrence === 'weekly') out.flexible = true;
  return out;
}

/**
 * Crée une tâche. Valide la cohérence :
 * - titre non vide (espaces de bord retirés) ;
 * - assignee / récurrence connus ;
 * - weekly exige weeklyDay entier ∈ [1,7], monthly exige monthlyDay ∈ [1,31] ;
 * - none/daily n'ont pas de jour (un jour fourni est ignoré) ;
 * - V3 : effort ∈ {1,2,3} ; rotation exige assignee 'a' ou 'b' ;
 *   flexible exige weekly. `rotation`/`flexible` à false ne sont pas stockés.
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
    effort?: TaskEffort;
    rotation?: boolean;
    flexible?: boolean;
    /** V5.2 — liée à la liste de courses. */
    groceries?: boolean;
  },
  createdAt: string,
): HouseholdTask {
  assertTaskFields(input);
  const task = withCareFields(
    {
      id: input.id,
      title: input.title.trim(),
      description: input.description,
      assignee: input.assignee,
      recurrence: input.recurrence,
      weeklyDay: input.recurrence === 'weekly' ? input.weeklyDay : undefined,
      monthlyDay: input.recurrence === 'monthly' ? input.monthlyDay : undefined,
      createdAt,
    },
    input.effort,
    input.rotation,
    input.flexible,
  );
  return input.groceries === true ? { ...task, groceries: true } : task;
}

/** Champs modifiables d'une tâche. */
export type TaskPatch = Partial<
  Pick<
    HouseholdTask,
    | 'title'
    | 'assignee'
    | 'recurrence'
    | 'weeklyDay'
    | 'monthlyDay'
    | 'description'
    | 'effort'
    | 'rotation'
    | 'flexible'
    | 'groceries'
  >
>;

/**
 * Modifie une tâche. La tâche résultante est validée comme à la création :
 * - weekly exige weeklyDay ∈ [1,7] (celui du patch, sinon l'ancien) ;
 * - monthly exige monthlyDay ∈ [1,31] (idem) ;
 * - les jours sans objet pour la récurrence finale sont retirés ;
 * - V3 : `rotation: true` / `flexible: true` **explicites** et incohérents
 *   lèvent une RangeError ; hérités et devenus sans objet (assignee passé à
 *   « ensemble », récurrence quittant weekly), ils sont retirés en silence.
 * Lève une RangeError si incohérent (rien n'est modifié).
 *
 * V5.2 : `groceries` (lien Courses) est conservé sauf patch explicite.
 *
 * `id` et `createdAt` ne changent jamais. Les faits Maison passés gardent
 * leur copie du titre et de l'assignee ; les crédits de la forêt sont
 * inchangés. Id inconnu ou patch sans effet → même référence.
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
  const effort = patch.effort ?? current.effort;
  let rotation = patch.rotation ?? current.rotation;
  if (patch.rotation === undefined && rotation === true && assignee !== 'a' && assignee !== 'b') {
    rotation = undefined;
  }
  let flexible = patch.flexible ?? current.flexible;
  if (patch.flexible === undefined && flexible === true && recurrence !== 'weekly') {
    flexible = undefined;
  }
  assertTaskFields({ title, assignee, recurrence, weeklyDay, monthlyDay, effort, rotation, flexible });

  const next = withCareFields(
    {
      id: current.id,
      title,
      description: patch.description !== undefined ? patch.description : current.description,
      assignee,
      recurrence,
      weeklyDay: recurrence === 'weekly' ? weeklyDay : undefined,
      monthlyDay: recurrence === 'monthly' ? monthlyDay : undefined,
      createdAt: current.createdAt,
    },
    effort,
    rotation,
    flexible,
  );
  if ((patch.groceries ?? current.groceries) === true) next.groceries = true;
  if (
    next.title === current.title &&
    next.description === current.description &&
    next.assignee === current.assignee &&
    next.recurrence === current.recurrence &&
    next.weeklyDay === current.weeklyDay &&
    next.monthlyDay === current.monthlyDay &&
    next.effort === current.effort &&
    (next.rotation === true) === (current.rotation === true) &&
    (next.flexible === true) === (current.flexible === true) &&
    (next.groceries === true) === (current.groceries === true)
  ) {
    return tasks;
  }
  const out = tasks.slice();
  out[index] = next;
  return out;
}

/**
 * Supprime une tâche (modèle). Les faits Maison passés **restent** dans
 * l'historique et la répartition ; les crédits de la forêt sont conservés.
 * Id inconnu → même référence.
 */
export function deleteTask(tasks: HouseholdTask[], id: string): HouseholdTask[] {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  const out = tasks.slice();
  out.splice(index, 1);
  return out;
}
