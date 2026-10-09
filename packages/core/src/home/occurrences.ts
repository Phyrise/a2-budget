/**
 * Occurrences de tâches : identification, échéance, faits et passages.
 *
 * Une occurrence est identifiée par `(taskId, dueDate)` :
 * - ponctuelle : dueDate = « once » ;
 * - hebdomadaire souple (V3) : dueDate = lundi de la semaine ISO ;
 * - autres récurrentes : dueDate = date locale de l'échéance.
 *
 * Fonctions pures, sans dépendance vers tasks.ts (pas de cycle).
 */

import { addDays, daysInMonth, isoWeekday, localDateKey, parseLocalDateKey, startOfWeek } from './dates.js';
import type { ChoreCompletion, ChoreSkip, HouseholdTask } from './types.js';

/** Marque de dueDate pour une occurrence ponctuelle. */
export const ONCE = 'once';

/**
 * V5.3 — tâche « à tout moment » (la tâche Courses, `groceries`) : jamais
 * d'échéance, jamais « faite pour la semaine » ; on la fait autant de fois
 * qu'on veut, même deux fois le même jour. Chaque fois est sa propre
 * occurrence : dueDate = « YYYY-MM-DD~<id du fait> » (voir anytimeDueDate),
 * pour que deux faits du même jour ne se fusionnent jamais (invité comme
 * synchronisé). Une tâche Courses de V5.2 le devient sans migration : sa
 * récurrence enregistrée est simplement ignorée ; ses anciens faits (datés)
 * restent dans l'historique.
 */
export function isAnytimeTask(task: HouseholdTask): boolean {
  return task.groceries === true;
}

/** Séparateur jour / id d'une occurrence « à tout moment ». */
export const ANYTIME_SEPARATOR = '~';

const ANYTIME_DUE = /^(\d{4}-\d{2}-\d{2})~[A-Za-z0-9_-]{1,80}$/;

/** dueDate d'un fait « à tout moment » : jour local + id (caractères sûrs seulement). */
export function anytimeDueDate(day: string, completionId: string): string {
  const safe = completionId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'x';
  return `${day}${ANYTIME_SEPARATOR}${safe}`;
}

/** Vrai si `dueDate` a la forme « YYYY-MM-DD~id » (sans vérifier le jour). */
export function isAnytimeDueDate(dueDate: string): boolean {
  return ANYTIME_DUE.test(dueDate);
}

/** Jour « YYYY-MM-DD » d'une dueDate (la dueDate elle-même hors « à tout moment »). */
export function dueDay(dueDate: string): string {
  const m = ANYTIME_DUE.exec(dueDate);
  return m ? m[1]! : dueDate;
}

/** Vrai si la tâche est une hebdomadaire souple (V3). */
export function isFlexibleWeekly(task: HouseholdTask): boolean {
  return task.recurrence === 'weekly' && task.flexible === true;
}

/** Clé « YYYY-MM-DD » du lundi de la semaine ISO contenant `date`. */
export function weekStartKey(date: Date): string {
  return localDateKey(startOfWeek(date));
}

/**
 * dueDate de l'occurrence de la tâche **couvrant** `date` : « once » pour une
 * ponctuelle, lundi de la semaine pour une hebdomadaire souple, sinon la date
 * locale elle-même. Ne dit pas si la tâche est due ce jour-là (voir isDueOn).
 */
export function occurrenceDateFor(task: HouseholdTask, date: Date): string {
  if (task.recurrence === 'none') return ONCE;
  if (isFlexibleWeekly(task)) return weekStartKey(date);
  return localDateKey(date);
}

/**
 * dueDate d'un « pas aujourd'hui » posé le jour `date` : comme
 * occurrenceDateFor, sauf pour une ponctuelle (date du jour : elle revient
 * demain au lieu de disparaître).
 */
export function skipDateFor(task: HouseholdTask, date: Date): string {
  if (task.recurrence === 'none') return localDateKey(date);
  return occurrenceDateFor(task, date);
}

/**
 * Clé stable d'une occurrence / crédit :
 * - ponctuelle : « ${taskId}|once »
 * - hebdomadaire souple : « ${taskId}|${lundi de la semaine de la date} »
 * - récurrente : « ${taskId}|${scheduledLocalDate} »
 */
export function creditKeyFor(task: HouseholdTask, scheduledLocalDate: string): string {
  if (isAnytimeDueDate(scheduledLocalDate)) return `${task.id}|${scheduledLocalDate}`;
  if (task.recurrence === 'none') return `${task.id}|${ONCE}`;
  if (isFlexibleWeekly(task) && scheduledLocalDate !== ONCE) {
    try {
      return `${task.id}|${weekStartKey(parseLocalDateKey(scheduledLocalDate))}`;
    } catch {
      return `${task.id}|${scheduledLocalDate}`;
    }
  }
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
 * jour du mois (ajusté au dernier jour si le mois est plus court). Une
 * hebdomadaire souple est due **chaque jour** de la semaine (tant qu'elle
 * n'est pas faite : voir isActionableToday).
 */
export function isDueOn(task: HouseholdTask, date: Date): boolean {
  if (isAnytimeTask(task)) return true;
  switch (task.recurrence) {
    case 'none':
      return localDateKey(date) === task.createdAt;
    case 'daily':
      return true;
    case 'weekly': {
      const day = task.weeklyDay;
      if (day === undefined || day < 1 || day > 7) return false;
      if (task.flexible === true) return true;
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
 * Fait Maison de l'occurrence couvrant `date`, ou undefined. Pour une
 * hebdomadaire souple, tout fait daté dans la semaine compte (y compris un
 * fait enregistré quand la tâche était encore à jour fixe). Pour une
 * hebdomadaire à jour fixe, le fait daté du lundi de la semaine (enregistré
 * quand elle était souple) compte aussi : pas de double fait ni de double
 * crédit après un passage souple → fixe.
 */
export function findOccurrenceCompletion(
  task: HouseholdTask,
  completions: ChoreCompletion[],
  date: Date,
): ChoreCompletion | undefined {
  // « À tout moment » : rien n'est jamais « déjà fait ».
  if (isAnytimeTask(task)) return undefined;
  if (isFlexibleWeekly(task)) {
    const start = startOfWeek(date);
    const monday = localDateKey(start);
    const sunday = localDateKey(addDays(start, 6));
    return completions.find(
      (c) => c.taskId === task.id && c.dueDate !== ONCE && c.dueDate >= monday && c.dueDate <= sunday,
    );
  }
  const dueDate = occurrenceDateFor(task, date);
  const exact = completions.find((c) => c.taskId === task.id && c.dueDate === dueDate);
  if (exact !== undefined || task.recurrence !== 'weekly') return exact;
  // Hebdomadaire repassée en jour fixe : le fait de la semaine enregistré
  // quand elle était souple (daté du lundi) couvre encore la semaine.
  const monday = weekStartKey(date);
  return completions.find((c) => c.taskId === task.id && c.dueDate === monday);
}

/** Vrai si l'occurrence couvrant `date` a été passée (« pas aujourd'hui »). */
export function isSkipped(
  task: HouseholdTask,
  skips: readonly ChoreSkip[] | undefined,
  date: Date,
): boolean {
  if (skips === undefined || skips.length === 0 || isAnytimeTask(task)) return false;
  const dueDate = skipDateFor(task, date);
  // Hebdomadaire repassée en jour fixe : un « pas cette semaine » posé quand
  // elle était souple (daté du lundi) vaut encore pour la semaine.
  const monday = task.recurrence === 'weekly' ? weekStartKey(date) : dueDate;
  return skips.some((s) => s.taskId === task.id && (s.dueDate === dueDate || s.dueDate === monday));
}
