/**
 * Lanternes (V3) : sessions de concentration douces (« 10 minutes de
 * rangement »), mémorisées pour le carnet. Jamais de score : une lanterne
 * allumée est un souvenir, pas une performance. Fonctions pures.
 */

import type { FocusSession, FocusState } from './types.js';
import { isDoer, isIntInRange, isIsoTimestamp } from './validationHelpers.js';

/** Nombre maximal de sessions gardées (les plus anciennes sont oubliées). */
export const FOCUS_SESSIONS_MAX = 500;
/** Durée maximale d'une session (minutes). */
export const FOCUS_MINUTES_MAX = 120;
/** Longueur maximale du libellé d'une session. */
export const FOCUS_LABEL_MAX = 80;

/**
 * Ajoute une session terminée. Idempotent sur `id` (déjà présente → même
 * référence, `added: false`). `minutes` entier 1..120, `startedAt` ISO,
 * `who` 'a' | 'b' | 'both' ; libellé nettoyé (vide → omis, ≤ 80 car.).
 * Garde les FOCUS_SESSIONS_MAX plus récentes (ordre d'ajout). Lève une
 * RangeError si la session est invalide. Pur.
 */
export function addFocusSession(
  focus: FocusState | undefined,
  session: FocusSession,
): { focus: FocusState; added: boolean } {
  const sessions = focus?.sessions ?? [];
  if (typeof session.id !== 'string' || session.id === '') throw new RangeError('focus id required');
  if (sessions.some((s) => s.id === session.id)) {
    return { focus: focus ?? { sessions }, added: false };
  }
  if (!isIsoTimestamp(session.startedAt)) throw new RangeError('focus startedAt must be ISO');
  if (!isIntInRange(session.minutes, 1, FOCUS_MINUTES_MAX)) {
    throw new RangeError('focus minutes must be an integer in [1,120]');
  }
  if (!isDoer(session.who)) throw new RangeError('invalid focus who');
  const out: FocusSession = {
    id: session.id,
    startedAt: session.startedAt,
    minutes: session.minutes,
    who: session.who,
  };
  if (typeof session.label === 'string') {
    const label = session.label.trim().replace(/\s+/g, ' ').slice(0, FOCUS_LABEL_MAX);
    if (label !== '') out.label = label;
  }
  if (typeof session.taskId === 'string' && session.taskId !== '') out.taskId = session.taskId;
  const next = [...sessions, out];
  return {
    focus: { sessions: next.length > FOCUS_SESSIONS_MAX ? next.slice(-FOCUS_SESSIONS_MAX) : next },
    added: true,
  };
}
