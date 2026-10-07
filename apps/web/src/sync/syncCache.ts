/**
 * Copie locale du mode synchronisé (docs/SYNC_DESIGN.md §4.1) : dernier état
 * projeté (premier affichage instantané) et curseur des écouteurs delta,
 * sous une clé DISTINCTE. La clé locale `a2-budget:state:v1` (mode invité,
 * données d'aujourd'hui) n'est jamais écrite par la synchronisation.
 *
 * Fonctions pures (lecture / écriture du texte) ; l'accès à localStorage
 * viendra avec le transport Firestore.
 */

import { validateAppState, type AppState, type Role } from '@a2/core';
import { isPlainRecord } from './docs';

export const SYNC_STORAGE_KEY = 'a2-budget:sync:v1';

export interface SyncCache {
  version: 1;
  /** Foyer (id fixe pour l'instant). */
  householdId: string;
  role: Role;
  /** Dernier état projeté. */
  state: AppState;
  /** Plus grand `syncedAt` reçu du serveur (jamais d'une écriture en attente), ou null. */
  cursor: number | null;
}

export function serializeSyncCache(cache: SyncCache): string {
  return JSON.stringify(cache);
}

/** Texte → copie valide, ou null (absente, illisible, état invalide : on resynchronise). */
export function parseSyncCache(text: string | null): SyncCache | null {
  if (text === null) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isPlainRecord(raw) || raw.version !== 1) return null;
    if (typeof raw.householdId !== 'string' || raw.householdId === '') return null;
    if (raw.role !== 'a' && raw.role !== 'b') return null;
    const cursor = raw.cursor === null || (typeof raw.cursor === 'number' && Number.isFinite(raw.cursor)) ? raw.cursor : null;
    const state = validateAppState(raw.state);
    if (!state.ok) return null;
    return { version: 1, householdId: raw.householdId, role: raw.role, state: state.state, cursor };
  } catch {
    return null;
  }
}
