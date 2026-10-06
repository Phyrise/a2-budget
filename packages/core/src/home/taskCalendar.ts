/**
 * Tâches au calendrier (V4) : les occurrences datées des tâches Maison,
 * affichées dans le Calendrier comme des pastilles discrètes, distinctes des
 * événements, et synchronisées avec Maison (une tâche faite reste affichée,
 * barrée).
 *
 * Tâches montrées :
 * - hebdomadaires à **jour fixe** (pas les souples) : chaque `weeklyDay` ;
 * - mensuelles : chaque `monthlyDay` (ajusté au dernier jour des mois courts) ;
 * - ponctuelles, comme dans Maison : non faites, elles sont proposées chaque
 *   jour jusqu'à ce qu'elles soient faites → affichées à max(création,
 *   aujourd'hui) (« pas aujourd'hui » lu pour ce jour-là : demain elle
 *   revient) ; faites, elles restent barrées au jour où elles l'ont été
 *   (`completedAt`, jamais avant la création).
 * Jamais les quotidiennes (elles rempliraient chaque case) ni les souples
 * (pas de jour). Les occurrences récurrentes antérieures à la création de la
 * tâche ne sont pas inventées.
 *
 * Fonction pure, sans exception.
 */

import { addDays, isValidLocalDateKey, localDateKey, parseLocalDateKey } from './dates.js';
import { findOccurrenceCompletion, hasCompletion, isDueOn, isSkipped, ONCE } from './occurrences.js';
import type { ChoreCompletion, ChoreSkip, HouseholdTask } from './types.js';

/** Fenêtre maximale parcourue (jours) : au-delà, la fin est tronquée. */
export const TASK_CALENDAR_MAX_DAYS = 400;

/** Une occurrence de tâche à afficher dans le calendrier. */
export interface TaskCalendarOccurrence {
  task: HouseholdTask;
  /** Date d'affichage « YYYY-MM-DD ». */
  date: string;
  /** Identifiant d'occurrence (comme ChoreCompletion.dueDate) : « once » ou la date. */
  dueDate: string;
  /** Faite (fait Maison existant) : à afficher barrée. */
  done: boolean;
  /** Passée (« pas aujourd'hui ») : à afficher discrètement. */
  skipped: boolean;
}

function showsInCalendar(task: HouseholdTask): boolean {
  if (task.recurrence === 'daily') return false;
  if (task.recurrence === 'weekly' && task.flexible === true) return false;
  return true;
}

/** Jour d'affichage d'une ponctuelle (voir l'en-tête). */
function onceDisplay(
  task: HouseholdTask,
  completions: ChoreCompletion[],
  today: string | undefined,
): { date: string; done: boolean } {
  if (hasCompletion(completions, task.id, ONCE)) {
    const made = completions.find((c) => c.taskId === task.id && c.dueDate === ONCE);
    const at = made === undefined ? NaN : Date.parse(made.completedAt);
    const doneDay = Number.isNaN(at) ? task.createdAt : localDateKey(new Date(at));
    return { date: doneDay > task.createdAt ? doneDay : task.createdAt, done: true };
  }
  return { date: today !== undefined && today > task.createdAt ? today : task.createdAt, done: false };
}

/**
 * Occurrences des tâches dans [from, to] (bornes incluses, clés
 * « YYYY-MM-DD »), triées par date puis dans l'ordre de la liste des tâches
 * (tri stable). Intervalle invalide ou inversé → []. Fenêtre bornée à
 * TASK_CALENDAR_MAX_DAYS jours.
 *
 * Pour cocher depuis le Calendrier : `toggleHomeTask` coche l'occurrence du
 * jour (ou l'unique occurrence d'une ponctuelle, quelle que soit sa date).
 * `today` (« YYYY-MM-DD ») : jour courant, pour reporter les ponctuelles non
 * faites ; absent → affichées à leur création.
 */
export function taskOccurrencesBetween(
  tasks: readonly HouseholdTask[],
  completions: readonly ChoreCompletion[],
  skips: readonly ChoreSkip[] | undefined,
  from: string,
  to: string,
  today?: string,
): TaskCalendarOccurrence[] {
  if (!isValidLocalDateKey(from) || !isValidLocalDateKey(to) || from > to) return [];
  const shown = tasks.filter(showsInCalendar);
  if (shown.length === 0) return [];
  const list = completions as ChoreCompletion[];
  const now = today !== undefined && isValidLocalDateKey(today) ? today : undefined;
  const onceDates = new Map<string, { date: string; done: boolean }>();
  for (const task of shown) if (task.recurrence === 'none') onceDates.set(task.id, onceDisplay(task, list, now));
  const out: TaskCalendarOccurrence[] = [];
  let day = parseLocalDateKey(from);
  for (let i = 0; i < TASK_CALENDAR_MAX_DAYS; i++, day = addDays(day, 1)) {
    const date = localDateKey(day);
    if (date > to) break;
    for (const task of shown) {
      if (task.recurrence === 'none') {
        const once = onceDates.get(task.id);
        if (once === undefined || once.date !== date) continue;
        out.push({
          task,
          date,
          dueDate: ONCE,
          done: once.done,
          skipped: !once.done && isSkipped(task, skips, day),
        });
        continue;
      }
      if (date < task.createdAt || !isDueOn(task, day)) continue;
      out.push({
        task,
        date,
        dueDate: date,
        done: findOccurrenceCompletion(task, list, day) !== undefined,
        skipped: isSkipped(task, skips, day),
      });
    }
  }
  return out;
}
