/**
 * Mode de l'app selon le compte et la copie commune (V5). Pur, testé dans
 * syncMode.test.ts.
 *
 * - local : invité, ou sans configuration — l'app d'aujourd'hui, ses données
 *   (`a2-budget:state:v1`), rien d'autre.
 * - setup : connecté avec Google, ce téléphone n'a pas encore rejoint le
 *   foyer (écran de choix : y mettre ses données, ou adopter les communes).
 * - sync : la copie commune (`a2-budget:sync:v1`), affichée tout de suite ;
 *   la synchronisation se branche dès que la session est relue.
 */
import type { MemberRole } from '../sync/allowlist';
import type { SyncCache } from '../sync/syncCache';
import type { AccountEntry } from './accountChoice';

export type SyncMode = 'local' | 'setup' | 'sync';

export function syncMode(
  account: { enabled: boolean; entry: AccountEntry | null },
  cache: Pick<SyncCache, 'role'> | null,
): SyncMode {
  if (!account.enabled || account.entry !== 'google') return 'local';
  return cache === null ? 'setup' : 'sync';
}

/** Rôle de la copie commune : celui du compte connecté dès qu'il est connu. */
export function syncRole(cache: Pick<SyncCache, 'role'>, member: { role: MemberRole } | null): MemberRole {
  return member?.role ?? cache.role;
}

/** Ce que l'on garde sur le téléphone en se déconnectant. */
export type KeepOnSignOut = 'shared' | 'local';
