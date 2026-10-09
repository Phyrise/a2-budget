/**
 * Remise à zéro du foyer (mode développeur, docs/SYNC_DESIGN.md §22). Pur,
 * sans Firebase : le signal, le plancher, la copie vide.
 *
 * - Le document du foyer porte deux compteurs : `resetEpoch` (tout remettre
 *   à zéro) et `lettersEpoch` (lettres de la semaine effacées). Un compteur
 *   qui bouge, vu du serveur, est le SIGNAL : on ne déduit jamais une remise
 *   à zéro de documents qui disparaissent.
 * - `resetAt` (heure du serveur) = plancher : tout document plus ancien est
 *   d'avant la remise à zéro et n'est plus jamais montré (le cache du SDK
 *   peut encore en garder).
 * - `resetting` : la personne qui remet à zéro est en train de vider le
 *   foyer ; les téléphones attendent la fin avant de tout relire.
 */
import { emptyAppState } from '@a2/core';
import { HOUSEHOLD_ID } from './allowlist';
import { HOUSEHOLD_SCHEMA } from './household';
import type { MemberRole } from './allowlist';
import type { SyncCache } from './syncCache';

/** Compteurs connus de ce téléphone (absents : pas encore vus, on les adopte). */
export interface HouseholdEpochs {
  reset: number;
  letters: number;
}

/** Ce que le document du foyer dit de la remise à zéro. */
export interface ResetInfo extends HouseholdEpochs {
  /** Heure du serveur (ms) de la dernière remise à zéro complète, 0 si jamais. */
  resetAt: number;
  /** Vidage en cours. */
  resetting: boolean;
}

export type ResetKind = 'all' | 'letters';

export interface ResetSignal {
  kind: ResetKind;
  epochs: HouseholdEpochs;
}

/** Au-delà, un vidage resté « en cours » (téléphone fermé en route) n'est plus attendu. */
export const RESET_WAIT_MS = 3 * 60_000;

const int = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

/** Document du foyer (heures déjà en ms) → infos de remise à zéro. */
export function resetInfoOf(data: Record<string, unknown> | undefined, resetAtMs?: number): ResetInfo {
  return {
    reset: int(data?.resetEpoch),
    letters: int(data?.lettersEpoch),
    resetAt: typeof resetAtMs === 'number' && Number.isFinite(resetAtMs) ? resetAtMs : 0,
    resetting: data?.resetting === true,
  };
}

/**
 * Le foyer vu du serveur dit-il qu'il faut tout remettre à zéro (ou effacer
 * les lettres) ? `known` absent : premier passage, on adopte sans rien
 * effacer.
 */
export function resetSignal(known: Partial<HouseholdEpochs> | null, seen: HouseholdEpochs): ResetSignal | null {
  if (known?.reset === undefined) return null;
  const epochs = { reset: seen.reset, letters: seen.letters };
  if (seen.reset !== known.reset) return { kind: 'all', epochs };
  if (known.letters !== undefined && seen.letters !== known.letters) return { kind: 'letters', epochs };
  return null;
}

/** Faut-il encore attendre la fin du vidage avant de tout relire ? */
export function resetPending(info: ResetInfo, now: number): boolean {
  return info.resetting && now - info.resetAt < RESET_WAIT_MS;
}

/**
 * Un document reste-t-il dans la vue ? Non s'il est d'avant le plancher
 * (`syncedAt` du serveur). Une écriture en attente (heure estimée) reste.
 */
export function aboveFloor(syncedAt: number | undefined, pending: boolean, floor: number): boolean {
  if (floor <= 0 || pending) return true;
  return syncedAt === undefined || syncedAt >= floor;
}

/**
 * La copie locale après une remise à zéro : état vide (comme au premier
 * jour), aucun curseur, jamais relu (tout relire au démarrage).
 */
export function freshCacheAfterReset(role: MemberRole, epochs: HouseholdEpochs): SyncCache {
  return {
    version: 1,
    householdId: HOUSEHOLD_ID,
    role,
    state: emptyAppState(),
    cursors: {},
    syncedAt: null,
    schema: HOUSEHOLD_SCHEMA,
    resetEpoch: epochs.reset,
    lettersEpoch: epochs.letters,
  };
}

/** Collections vidées par « Tout remettre à zéro » (le foyer, les fiches et l'abonnement push restent). */
export const RESET_COLLECTIONS = [
  'tasks',
  'completions',
  'skips',
  'forestEvents',
  'focusSessions',
  'groceries',
  'groceryHistory',
  'events',
  'months',
  'balanceCorrections',
  'circles',
  'settings',
  'checkpoints',
  'meta',
  'quests',
  'activity',
  'play',
] as const;

/** Suppressions par lots (sobre en quotas, sous la limite de 500 d'un lot). */
export const RESET_BATCH = 400;

/** Découpe en lots de `size`. Pur. */
export function chunks<T>(items: readonly T[], size = RESET_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
