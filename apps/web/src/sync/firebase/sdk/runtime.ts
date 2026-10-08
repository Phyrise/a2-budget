/**
 * Synchronisation en marche (docs/SYNC_DESIGN.md §3–4) : transport Firestore
 * + moteur (SyncCore), copie locale `a2-budget:sync:v1` tenue à jour,
 * statut pour l'indicateur discret.
 *
 * - Démarrage depuis le cache du SDK ; tout relire du serveur seulement si
 *   `needsFullResync` (jamais relu, cache vidé, 25 jours, modèle changé).
 *   Hors ligne alors : on attend le réseau, la copie locale reste affichée.
 * - Les écouteurs sont relancés (curseurs à jour) après une longue absence :
 *   au-delà de 30 minutes, Firestore relirait tout le résultat.
 */
import type { AppState } from '@a2/core';
import { getDocFromCache, getDocFromServer, type Firestore } from 'firebase/firestore';
import { HOUSEHOLD_ID } from '../../allowlist';
import { HOUSEHOLD_SCHEMA } from '../../household';
import { needsFullResync, writeSyncCache, type SyncCache } from '../../syncCache';
import { SyncCore } from '../../syncCore';
import { errorCode, type Member, type SyncRuntime, type SyncStatus } from '../types';
import { householdRef } from './convert';
import { FirestoreTransport } from './transport';

/** Au-delà, les écouteurs sont relancés depuis les curseurs (reprise Firestore : 30 min). */
const RELISTEN_AFTER_MS = 25 * 60_000;
const SAVE_DELAY_MS = 400;

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function householdCached(db: Firestore): Promise<{ schema: number } | null> {
  try {
    const snap = await getDocFromCache(householdRef(db));
    const schema: unknown = snap.data()?.schema;
    return snap.exists() ? { schema: typeof schema === 'number' ? schema : HOUSEHOLD_SCHEMA } : null;
  } catch {
    return null;
  }
}

function untilOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (online()) return resolve();
    window.addEventListener('online', () => resolve(), { once: true });
  });
}

export function openRuntime(db: Firestore, member: Member, cache: SyncCache | null, selectedMonth: string): SyncRuntime {
  let disposed = false;
  let core: SyncCore | null = null;
  let syncedAt = cache?.syncedAt ?? null;
  let cursors: SyncCache['cursors'] = { ...(cache?.cursors ?? {}) };
  const stateListeners = new Set<(state: AppState) => void>();
  const statusListeners = new Set<(status: SyncStatus) => void>();
  let lastStatus: SyncStatus | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    const state = core?.state;
    if (state === null || state === undefined) return;
    writeSyncCache({ version: 1, householdId: HOUSEHOLD_ID, role: member.role, state, cursors, syncedAt, schema: HOUSEHOLD_SCHEMA });
  };
  const saveSoon = () => {
    saveTimer ??= setTimeout(save, SAVE_DELAY_MS);
  };

  const transport = new FirestoreTransport(db, member.uid, cursors, {
    onCursors: (next) => {
      cursors = next;
      saveSoon();
    },
    onInSync: () => {
      syncedAt = Date.now();
      saveSoon();
    },
    onActivity: () => emitStatus(),
  });

  const status = (): SyncStatus => {
    if (transport.failure !== null) return 'error';
    if (!online()) return 'offline';
    return core === null || transport.pending > 0 || !transport.upToDate ? 'syncing' : 'synced';
  };
  function emitStatus(): void {
    const next = status();
    if (next === lastStatus) return;
    lastStatus = next;
    for (const listener of statusListeners) listener(next);
  }

  const ready = (async () => {
    for (;;) {
      const home = await householdCached(db);
      const full = needsFullResync(cache, { now: Date.now(), schema: home?.schema ?? -1, cacheAlive: home !== null });
      try {
        if (full) {
          await untilOnline();
          await getDocFromServer(householdRef(db)); // gardé en cache : témoin d'un cache vivant
        }
        if (disposed) return;
        await transport.start(full);
        if (full) syncedAt = Date.now(); // tout vient d'être relu du serveur
        break;
      } catch (error) {
        if (disposed) return;
        // Refus des règles : inutile d'insister (statut « en pause », l'écran de choix le dit).
        if (errorCode(error) === 'permission-denied') {
          transport.failure = 'lecture refusée';
          emitStatus();
          throw error;
        }
        emitStatus();
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
    }
    if (disposed) return;
    core = new SyncCore(transport, {
      role: member.role,
      selectedMonth,
      onState: (state) => {
        saveSoon();
        for (const listener of stateListeners) listener(state);
      },
    });
    save();
    emitStatus();
  })();
  void ready.catch(() => undefined); // l'appelant qui attend la vue reçoit le refus ; personne d'autre

  // Retour du réseau, retour sur l'app après une longue absence : écouteurs relancés depuis les curseurs.
  const wake = () => {
    emitStatus();
    if (core !== null && Date.now() - transport.listeningSince > RELISTEN_AFTER_MS) transport.listen();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') wake();
    else save();
  };
  window.addEventListener('online', wake);
  window.addEventListener('offline', emitStatus);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    role: member.role,
    ready,
    get state() {
      return core?.state ?? null;
    },
    subscribe(listener) {
      stateListeners.add(listener);
      const current = core?.state;
      if (current !== null && current !== undefined) listener(current);
      return () => {
        stateListeners.delete(listener);
      };
    },
    commit(prev, next) {
      core?.commit(prev, next);
    },
    refresh() {
      core?.refresh();
    },
    canUndo(collection, taskId, dueDate) {
      return core?.canUndo(collection, taskId, dueDate) ?? true;
    },
    watchStatus(listener) {
      statusListeners.add(listener);
      listener(status());
      return () => {
        statusListeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      save();
      disposed = true;
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', emitStatus);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
      core?.dispose();
      transport.dispose();
      stateListeners.clear();
      statusListeners.clear();
    },
  };
}
