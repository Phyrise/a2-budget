/**
 * Copie locale du mode synchronisé (docs/SYNC_DESIGN.md §4.1–4.2) : dernier
 * état projeté (premier affichage instantané, avant même que le SDK soit
 * chargé) et curseurs des écouteurs delta, sous une clé DISTINCTE. La clé
 * locale `a2-budget:state:v1` (invité, données d'avant) n'est jamais écrite
 * par la synchronisation.
 *
 * Présente = ce téléphone a rejoint le foyer (plus d'écran de choix).
 */

import { validateAppState, type AppState, type Role } from '@a2/core';
import { COLLECTIONS, isPlainRecord, type CollectionName } from './docs';

export const SYNC_STORAGE_KEY = 'a2-budget:sync:v1';

/** Chevauchement des écouteurs delta (application idempotente : sans risque). */
export const CURSOR_OVERLAP_MS = 2 * 60_000;
/** Au-delà, tout relire (les suppressions douces sont purgées à 30 jours). */
export const FULL_RESYNC_AFTER_MS = 25 * 86_400_000;

export interface SyncCache {
  version: 1;
  /** Foyer (id fixe pour l'instant). */
  householdId: string;
  role: Role;
  /** Dernier état projeté. */
  state: AppState;
  /** Par collection : plus grand `syncedAt` reçu du serveur (ms), jamais d'une écriture en attente. */
  cursors: Partial<Record<CollectionName, number>>;
  /** Dernier passage complet à jour avec le serveur (ms, horloge du téléphone), ou null. */
  syncedAt: number | null;
  /** Version du modèle du foyer vue à ce passage. */
  schema: number;
  /** Remise à zéro (mode développeur, reset.ts) : compteurs du foyer vus ; absents = à adopter. */
  resetEpoch?: number;
  lettersEpoch?: number;
}

export function serializeSyncCache(cache: SyncCache): string {
  return JSON.stringify(cache);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Texte → copie valide, ou null (absente, illisible, état invalide : on resynchronise). */
export function parseSyncCache(text: string | null): SyncCache | null {
  if (text === null) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isPlainRecord(raw) || raw.version !== 1) return null;
    if (typeof raw.householdId !== 'string' || raw.householdId === '') return null;
    if (raw.role !== 'a' && raw.role !== 'b') return null;
    const state = validateAppState(raw.state);
    if (!state.ok) return null;
    const cursors: Partial<Record<CollectionName, number>> = {};
    if (isPlainRecord(raw.cursors)) {
      for (const c of COLLECTIONS) if (finite(raw.cursors[c])) cursors[c] = raw.cursors[c];
    }
    return {
      version: 1,
      householdId: raw.householdId,
      role: raw.role,
      state: state.state,
      cursors,
      syncedAt: finite(raw.syncedAt) ? raw.syncedAt : null,
      schema: finite(raw.schema) ? raw.schema : 0,
      ...(finite(raw.resetEpoch) ? { resetEpoch: raw.resetEpoch } : {}),
      ...(finite(raw.lettersEpoch) ? { lettersEpoch: raw.lettersEpoch } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Tout relire depuis le serveur ? Oui si rien n'a jamais été relu, si le
 * dernier passage complet date de plus de 25 jours, si le modèle du foyer a
 * changé, ou si le cache du SDK a été vidé (`cacheAlive` faux). Pur.
 */
export function needsFullResync(
  cache: Pick<SyncCache, 'syncedAt' | 'schema' | 'cursors'> | null,
  ctx: { now: number; schema: number; cacheAlive: boolean },
): boolean {
  if (cache === null || cache.syncedAt === null || !ctx.cacheAlive) return true;
  if (cache.schema !== ctx.schema) return true;
  return ctx.now - cache.syncedAt > FULL_RESYNC_AFTER_MS;
}

/** Début de l'écoute delta d'une collection : son curseur moins le chevauchement (0 : tout). Pur. */
export function listenFrom(cursors: SyncCache['cursors'], collection: CollectionName): number {
  const cursor = cursors[collection];
  return cursor === undefined ? 0 : Math.max(0, cursor - CURSOR_OVERLAP_MS);
}

/** Curseur avancé par des documents reçus du serveur (heures `syncedAt`, ms). Pur. */
export function advanceCursor(cursor: number | undefined, syncedAts: readonly number[]): number | undefined {
  let out = cursor;
  for (const t of syncedAts) if (finite(t) && (out === undefined || t > out)) out = t;
  return out;
}

/** La copie de ce téléphone, ou null. */
export function readSyncCache(): SyncCache | null {
  try {
    return parseSyncCache(window.localStorage.getItem(SYNC_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Écrit la copie ; faux si le stockage la refuse (plein, désactivé). */
export function writeSyncCache(cache: SyncCache): boolean {
  try {
    window.localStorage.setItem(SYNC_STORAGE_KEY, serializeSyncCache(cache));
    return true;
  } catch {
    return false;
  }
}
