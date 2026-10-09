/** Libellés Maison (présentation uniquement). */
import type { HouseholdTask, TaskAssignee } from '@a2/core';
import type { Mood } from '../../world/types';
import { WEEKDAYS, timeOfDay } from '../../ui';

export function recurrenceLabel(task: Pick<HouseholdTask, 'recurrence' | 'weeklyDay' | 'monthlyDay' | 'flexible' | 'groceries'>): string {
  if (task.groceries === true) return 'Quand il faut'; // V5.3 : Courses, à tout moment.
  switch (task.recurrence) {
    case 'none':
      return 'Une fois';
    case 'daily':
      return 'Chaque jour';
    case 'weekly': {
      if (task.flexible === true) return 'Cette semaine';
      const day = WEEKDAYS.find((d) => d.iso === task.weeklyDay);
      return day ? `Chaque ${day.long}` : 'Chaque semaine';
    }
    case 'monthly':
      return task.monthlyDay === 1 ? 'Le 1er du mois' : `Le ${task.monthlyDay ?? '?'} du mois`;
  }
}

export function assigneeName(assignee: TaskAssignee, names: { a: string; b: string }): string {
  if (assignee === 'a') return names.a;
  if (assignee === 'b') return names.b;
  if (assignee === 'both') return 'Ensemble';
  return 'Libre';
}

/** « d’AL », « de Jiji » : élision devant une voyelle ou un h. */
export function ofName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöûüœæ]/iu.test(name) ? `d’${name}` : `de ${name}`;
}

/** « Tour d’AL » (tâche en tour à tour). */
export function turnLabel(name: string): string {
  return `Tour ${ofName(name)}`;
}

const WHEN: Record<ReturnType<typeof timeOfDay>, string> = {
  matin: 'ce matin',
  'apres-midi': 'cet après-midi',
  soir: 'ce soir',
  nuit: 'cette nuit',
};

const MOOD_BASE: Record<Mood, string> = {
  quiet: 'La forêt est silencieuse',
  peaceful: 'La forêt est paisible',
  lively: 'La forêt s’anime',
  flourishing: 'La forêt resplendit',
};

/** Phrase d'humeur qualitative (jamais de nombre). */
export function moodPhrase(mood: Mood, paused: boolean, now: Date): string {
  if (paused) return 'La forêt dort';
  return `${MOOD_BASE[mood]} ${WHEN[timeOfDay(now)]}`;
}
