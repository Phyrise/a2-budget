/**
 * « Pas aujourd'hui » (V3) : passer une occurrence sans crédit ni pénalité.
 *
 * Un passage rend l'occurrence non actionnable (isActionableToday avec
 * `skips`), ne donne aucun crédit à la forêt et ne change ni la vitalité ni
 * le streak (advanceDay est inchangé : passer équivaut, pour la forêt, à ne
 * rien faire — sans aucune trace d'échec). Réversible (unskipOccurrence).
 *
 * Fonctions pures, idempotentes sur l'occurrence (taskId, dueDate).
 */

import type { ChoreSkip } from './types.js';

/** Nombre maximal de passages conservés (les plus anciens sont oubliés). */
export const SKIPS_MAX = 500;

/**
 * Ajoute un passage pour (taskId, dueDate). Déjà présent → même référence,
 * `added: false`. Pur. Au-delà de SKIPS_MAX, les plus anciens sont retirés.
 */
export function skipOccurrence(
  skips: readonly ChoreSkip[] | undefined,
  input: ChoreSkip,
): { skips: ChoreSkip[]; added: boolean } {
  const list = skips ?? [];
  if (list.some((s) => s.taskId === input.taskId && s.dueDate === input.dueDate)) {
    return { skips: list as ChoreSkip[], added: false };
  }
  const skip: ChoreSkip = {
    id: input.id,
    taskId: input.taskId,
    dueDate: input.dueDate,
    at: input.at,
  };
  if (input.by !== undefined) skip.by = input.by;
  const next = [...list, skip];
  return { skips: next.length > SKIPS_MAX ? next.slice(-SKIPS_MAX) : next, added: true };
}

/**
 * Retire le passage de (taskId, dueDate). Absent → même référence,
 * `removed: false`. Pur.
 */
export function unskipOccurrence(
  skips: readonly ChoreSkip[] | undefined,
  taskId: string,
  dueDate: string,
): { skips: ChoreSkip[]; removed: boolean } {
  const list = (skips ?? []) as ChoreSkip[];
  const index = list.findIndex((s) => s.taskId === taskId && s.dueDate === dueDate);
  if (index === -1) return { skips: list, removed: false };
  const next = list.slice();
  next.splice(index, 1);
  return { skips: next, removed: true };
}
