/**
 * Données locales (invité) et synchronisation (V5) : elles ne sont JAMAIS
 * perdues (docs/SYNC_DESIGN.md §6).
 *
 * - Avant la première synchronisation : copie brute de `a2-budget:state:v1`
 *   dans `a2-budget:backup-pre-sync` (une fois), et export JSON proposé.
 * - La synchronisation n'écrit jamais `a2-budget:state:v1` (sa copie vit
 *   sous `a2-budget:sync:v1`) : en se déconnectant, on retrouve ses
 *   données d'avant telles quelles.
 * - Se déconnecter en gardant la copie commune : les données d'avant sont
 *   d'abord mises de côté (`a2-budget:backup-before-switch`), puis la copie
 *   commune devient les données locales.
 *
 * Seuls ces trois accès touchent les clés de données hors du store.
 */
import { migrateState, type AppState } from '@a2/core';
import { STORAGE_KEY } from './storage';

export const BACKUP_PRE_SYNC_KEY = 'a2-budget:backup-pre-sync';
export const BACKUP_BEFORE_SWITCH_KEY = 'a2-budget:backup-before-switch';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Copie de sécurité des données locales avant la première synchronisation (une seule fois). */
export function backupBeforeSync(): void {
  const raw = read(STORAGE_KEY);
  if (raw !== null && read(BACKUP_PRE_SYNC_KEY) === null) write(BACKUP_PRE_SYNC_KEY, raw);
}

/** Données locales actuelles (invité), lisibles et valides, ou null. */
export function readLocalState(): AppState | null {
  const raw = read(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const check = migrateState(JSON.parse(raw) as unknown);
    return check.ok ? check.state : null;
  } catch {
    return null;
  }
}

/**
 * La copie commune devient les données locales (déconnexion). Les données
 * d'avant sont mises de côté d'abord ; si ce n'est pas possible, rien ne
 * change (faux).
 */
export function keepSharedCopyLocally(state: AppState): boolean {
  const before = read(STORAGE_KEY);
  if (before !== null && before !== read(BACKUP_PRE_SYNC_KEY) && !write(BACKUP_BEFORE_SWITCH_KEY, before)) return false;
  return write(STORAGE_KEY, JSON.stringify(state));
}
