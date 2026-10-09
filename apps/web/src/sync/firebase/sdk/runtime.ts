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
 * - Remise à zéro (mode développeur, ../../reset.ts) : le document du foyer
 *   est écouté ; un compteur qui bouge est signalé (`watchReset`) ; avant de
 *   tout relire, on attend la fin du vidage ; rien d'avant `resetAt`.
 */
import type { AppState } from '@a2/core';
import { getDocFromCache, getDocFromServer, onSnapshot, Timestamp, type DocumentSnapshot, type Firestore } from 'firebase/firestore';
import { HOUSEHOLD_ID } from '../../allowlist';
import { HOUSEHOLD_SCHEMA } from '../../household';
import { resetInfoOf, resetPending, resetSignal, type HouseholdEpochs, type ResetInfo, type ResetSignal } from '../../reset';
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

/** Ce que le document du foyer dit de la remise à zéro (heure du serveur en ms). */
function resetInfo(snap: DocumentSnapshot): ResetInfo {
  const data = snap.data({ serverTimestamps: 'estimate' });
  const at: unknown = data?.resetAt;
  return resetInfoOf(data, at instanceof Timestamp ? at.toMillis() : undefined);
}

async function householdCached(db: Firestore): Promise<{ schema: number; info: ResetInfo } | null> {
  try {
    const snap = await getDocFromCache(householdRef(db));
    const schema: unknown = snap.data()?.schema;
    return snap.exists() ? { schema: typeof schema === 'number' ? schema : HOUSEHOLD_SCHEMA, info: resetInfo(snap) } : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  // Compteurs de remise à zéro connus (null : copie d'avant, on adopte ceux du serveur).
  let epochs: HouseholdEpochs | null =
    cache?.resetEpoch === undefined ? null : { reset: cache.resetEpoch, letters: cache.lettersEpoch ?? 0 };
  const resetListeners = new Set<(signal: ResetSignal) => void>();
  let missed: ResetSignal | null = null;
  let stopHome: (() => void) | null = null;
  /** Le foyer vu du serveur : compteurs adoptés, signal s'ils ont bougé. Vrai si tout est à remettre à zéro. */
  const observe = (info: ResetInfo): boolean => {
    const signal = resetSignal(epochs, info);
    epochs = { reset: info.reset, letters: info.letters };
    saveSoon();
    if (signal === null) return false;
    if (resetListeners.size === 0) missed = signal;
    for (const listener of resetListeners) listener(signal);
    return signal.kind === 'all';
  };

  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    const state = core?.state;
    if (state === null || state === undefined) return;
    const known = epochs === null ? {} : { resetEpoch: epochs.reset, lettersEpoch: epochs.letters };
    writeSyncCache({ version: 1, householdId: HOUSEHOLD_ID, role: member.role, state, cursors, syncedAt, schema: HOUSEHOLD_SCHEMA, ...known });
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
      if (disposed) return;
      const home = await householdCached(db);
      const full = needsFullResync(cache, { now: Date.now(), schema: home?.schema ?? -1, cacheAlive: home !== null });
      try {
        transport.floor = home?.info.resetAt ?? 0;
        if (full) {
          await untilOnline();
          const snap = await getDocFromServer(householdRef(db)); // gardé en cache : témoin d'un cache vivant
          const info = resetInfo(snap);
          if (disposed) return;
          // Vidage en cours (remise à zéro) : on attend qu'il finisse avant de tout relire.
          if (resetPending(info, Date.now())) {
            await sleep(1_500);
            continue;
          }
          if (observe(info)) return; // remis à zéro : l'appelant repart d'une copie vide
          transport.floor = info.resetAt;
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
    // Le foyer, écouté : une remise à zéro faite ailleurs (ou d'ici) arrive par lui.
    stopHome = onSnapshot(
      householdRef(db),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache && !snap.metadata.hasPendingWrites && snap.exists()) observe(resetInfo(snap));
      },
      () => undefined,
    );
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
    watchReset(listener) {
      resetListeners.add(listener);
      if (missed !== null) {
        const signal = missed;
        missed = null;
        listener(signal);
      }
      return () => {
        resetListeners.delete(listener);
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
      stopHome?.();
      core?.dispose();
      transport.dispose();
      stateListeners.clear();
      statusListeners.clear();
      resetListeners.clear();
    },
  };
}
