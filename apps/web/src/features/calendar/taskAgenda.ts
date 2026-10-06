/**
 * Tâches de la maison dans le Calendrier (V4, présentation) : occurrences
 * datées fournies par @a2/core (`taskOccurrencesBetween` : hebdomadaires à
 * jour fixe, mensuelles, ponctuelles à leur date ; jamais les quotidiennes
 * ni les souples), enrichies de « qui » et de « cochable ici ».
 *
 * Règles de cochage (celles de Maison, `toggleHomeTask`) : seule
 * l'occurrence du jour d'une tâche récurrente se coche, et une ponctuelle
 * quelle que soit sa date ; une occurrence passée (« pas aujourd'hui »)
 * attend d'être remise depuis Maison. Le reste est en lecture : une tâche
 * faite reste affichée, barrée — jamais de dette visible, rien ne rougit.
 */
import {
  ONCE,
  findOccurrenceCompletion,
  nextAssignee,
  parseLocalDateKey,
  taskOccurrencesBetween,
  whoDid,
  type AppState,
  type CalendarOccurrence,
  type HouseholdTask,
  type TaskAssignee,
} from '@a2/core';

export interface TaskItem {
  key: string;
  task: HouseholdTask;
  /** Jour d'affichage « YYYY-MM-DD ». */
  date: string;
  done: boolean;
  skipped: boolean;
  /** Fait : qui l'a fait ; sinon : qui est prévu (tour à tour compris). */
  who: TaskAssignee;
  /** Cochable (ou décochable) depuis le Calendrier. */
  checkable: boolean;
}

/** Occurrences des tâches entre `from` et `to` (bornes incluses). */
export function taskItemsBetween(state: AppState | null, from: string, to: string, todayKey: string): TaskItem[] {
  if (!state) return [];
  const { tasks, completions, skips } = state.chores;
  return taskOccurrencesBetween(tasks, completions, skips, from, to).map((o) => {
    let who: TaskAssignee = o.task.assignee;
    if (o.done) {
      const made =
        o.dueDate === ONCE
          ? completions.find((c) => c.taskId === o.task.id && c.dueDate === ONCE)
          : findOccurrenceCompletion(o.task, completions, parseLocalDateKey(o.date));
      if (made) who = whoDid(made);
    } else if (o.task.rotation === true) {
      who = nextAssignee(o.task, completions);
    }
    const onceTask = o.task.recurrence === 'none';
    return {
      key: `${o.task.id}-${o.date}`,
      task: o.task,
      date: o.date,
      done: o.done,
      skipped: o.skipped && !o.done,
      who,
      checkable: !(o.skipped && !o.done) && (onceTask || o.date === todayKey),
    };
  });
}

/** Regroupe par jour (ordre croissant des clés). */
export function byDate<T extends { date: string }>(list: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const day = map.get(item.date);
    if (day) day.push(item);
    else map.set(item.date, [item]);
  }
  return map;
}

/** Un jour de l'agenda : ses événements puis ses tâches. */
export interface AgendaDay {
  date: string;
  events: CalendarOccurrence[];
  tasks: TaskItem[];
}

/** Fusionne événements et tâches en jours triés (« À venir », aperçu du mois). */
export function agendaDays(events: readonly CalendarOccurrence[], tasks: readonly TaskItem[]): AgendaDay[] {
  const days = new Map<string, AgendaDay>();
  const at = (date: string) => {
    let day = days.get(date);
    if (!day) {
      day = { date, events: [], tasks: [] };
      days.set(date, day);
    }
    return day;
  };
  for (const e of events) at(e.date).events.push(e);
  for (const t of tasks) at(t.date).tasks.push(t);
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** « 1 tâche », « 3 tâches ». */
export function tasksCount(n: number): string {
  return `${n} tâche${n > 1 ? 's' : ''}`;
}
