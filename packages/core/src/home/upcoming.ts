/**
 * « À venir » : prochaines occurrences des tâches récurrentes (non cochables).
 */

import { addDays, isoWeekday, localDateKey } from './dates.js';
import { hasCompletion, isDueOn, isFlexibleWeekly } from './occurrences.js';
import type { ChoreCompletion, ChoreSkip, HouseholdTask } from './types.js';

/** Une occurrence à venir (non cochable). */
export interface UpcomingOccurrence {
  task: HouseholdTask;
  /**
   * Date d'échéance locale « YYYY-MM-DD ». Pour une hebdomadaire souple :
   * le lundi de la semaine concernée (à faire dans la semaine).
   */
  date: string;
  /** 1 = demain, 2 = après-demain… */
  daysFromNow: number;
}

/**
 * Prochaines occurrences des tâches récurrentes sur les `days` jours qui
 * **suivent** `from` (demain → from + days, bornes incluses ; aujourd'hui est
 * couvert par actionableTasksToday). Les ponctuelles (`none`) n'ont pas
 * d'occurrence future et sont exclues ; une occurrence déjà terminée (ou
 * passée, si `skips` est fourni) est omise. Tri : date croissante, puis ordre
 * des tâches.
 * - `includeDaily: false` omet les tâches quotidiennes.
 * - Hebdomadaire souple : une seule entrée par semaine **suivante**, datée du
 *   lundi (la semaine en cours est couverte par « Aujourd'hui »).
 * `days` est borné à [0, 366].
 */
export function upcomingOccurrences(
  tasks: HouseholdTask[],
  completions: ChoreCompletion[],
  from: Date,
  days: number,
  options: { includeDaily?: boolean; skips?: readonly ChoreSkip[] } = {},
): UpcomingOccurrence[] {
  const includeDaily = options.includeDaily ?? true;
  const skips = options.skips ?? [];
  const span = Math.max(0, Math.min(366, Math.floor(days)));
  const out: UpcomingOccurrence[] = [];
  for (let offset = 1; offset <= span; offset += 1) {
    const date = addDays(from, offset);
    const key = localDateKey(date);
    const monday = isoWeekday(date) === 1;
    for (const task of tasks) {
      if (task.recurrence === 'none') continue;
      if (task.recurrence === 'daily' && !includeDaily) continue;
      if (isFlexibleWeekly(task) && !monday) continue;
      if (!isDueOn(task, date)) continue;
      if (hasCompletion(completions, task.id, key)) continue;
      if (skips.some((s) => s.taskId === task.id && s.dueDate === key)) continue;
      out.push({ task, date: key, daysFromNow: offset });
    }
  }
  return out;
}
