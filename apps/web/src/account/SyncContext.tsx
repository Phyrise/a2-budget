/**
 * Synchronisation du téléphone (V5) : le mode de l'app (syncMode.ts), le
 * lien du store, la synchronisation en marche et son statut.
 *
 * - Sans configuration Firebase : valeur locale fixe, aucun code Firebase.
 * - Invité : mode local, Firebase jamais chargé (comme AccountContext).
 * - Copie commune : le store l'affiche tout de suite (SyncLink) ; la
 *   synchronisation (chunk Firebase, loader.ts) se branche dès que la
 *   session est relue et sa vue chargée.
 * - Se déconnecter : retour au mode local avec, au choix, la copie commune
 *   ou les données d'avant (state/localCopies.ts : rien n'est perdu).
 */
import { currentMonthKey } from '@a2/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { keepSharedCopyLocally } from '../state/localCopies';
import { FIREBASE_ENABLED } from '../sync/firebase/config';
import { loadFirebaseSession } from '../sync/firebase/loader';
import type { Member, SyncRuntime, SyncSetup, SyncStatus } from '../sync/firebase/types';
import { readSyncCache, type SyncCache } from '../sync/syncCache';
import { SyncLink } from '../sync/syncLink';
import { useAccount } from './AccountContext';
import { syncMode, syncRole, type KeepOnSignOut, type SyncMode } from './syncMode';

export interface SyncValue {
  mode: SyncMode;
  /** Copie commune : le lien du store (null en mode local ou au choix). */
  link: SyncLink | null;
  /** Statut pour l'indicateur (null hors synchronisation, ou pas encore branchée). */
  status: SyncStatus | null;
  /** Ce téléphone a une copie commune (choix à la déconnexion). */
  hasSharedCopy: boolean;
  /** Première connexion : contenu du foyer et envoi (chunk Firebase). */
  setup: () => Promise<SyncSetup | null>;
  /** Rejoindre le foyer : tout relire, puis la copie commune s'affiche. Faux si impossible. */
  join: () => Promise<boolean>;
  /** Se déconnecter en gardant, sur ce téléphone, la copie commune ou les données d'avant. */
  signOut: (keep: KeepOnSignOut) => void;
}

const LOCAL_SYNC: SyncValue = {
  mode: 'local',
  link: null,
  status: null,
  hasSharedCopy: false,
  setup: () => Promise.resolve(null),
  join: () => Promise.resolve(false),
  signOut: () => undefined,
};

const SyncContext = createContext<SyncValue>(LOCAL_SYNC);

export function useSync(): SyncValue {
  return useContext(SyncContext);
}

function FirebaseSyncProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const { member, continueAsGuest } = account;
  const [cache, setCache] = useState<SyncCache | null>(() => readSyncCache());
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const running = useRef<{ uid: string; runtime: SyncRuntime } | null>(null);
  const memberRef = useRef<Member | null>(member);
  memberRef.current = member;
  const mode = syncMode(account, cache);
  const role = cache === null ? null : syncRole(cache, member);

  // Le lien est créé une fois par entrée en mode synchronisé (et par rôle).
  const link = useMemo(
    () => (mode === 'sync' && cache !== null && role !== null ? new SyncLink(role, cache.state) : null),
    // La copie ne sert qu'au premier affichage : elle n'est pas une dépendance.
    [mode, role],
  );

  const stop = useCallback(() => {
    running.current?.runtime.dispose();
    running.current = null;
    setStatus(null);
  }, []);

  /** La synchronisation de ce membre (ouverte une fois). */
  const runtimeFor = useCallback(async (m: Member): Promise<SyncRuntime> => {
    const session = await loadFirebaseSession();
    if (running.current?.uid === m.uid) return running.current.runtime;
    running.current?.runtime.dispose();
    const fresh = readSyncCache();
    const runtime = session.openSync(m, fresh, fresh?.state.budget.selectedMonth ?? currentMonthKey(new Date()));
    running.current = { uid: m.uid, runtime };
    return runtime;
  }, []);

  // Copie commune + membre connu : la synchronisation se branche au store.
  const uid = member?.uid ?? null;
  useEffect(() => {
    const m = memberRef.current;
    if (mode !== 'sync' || link === null || m === null) return;
    let cancelled = false;
    let stopStatus: () => void = () => undefined;
    void runtimeFor(m)
      .then(async (runtime) => {
        stopStatus = runtime.watchStatus((next) => {
          if (!cancelled) setStatus(next);
        });
        await runtime.ready;
        if (!cancelled) link.attach(runtime);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stopStatus();
      link.detach();
    };
  }, [mode, link, uid, runtimeFor]);

  // Retour au mode local (invité, refus, déconnexion) : la synchronisation s'arrête.
  useEffect(() => {
    if (mode === 'local') stop();
  }, [mode, stop]);

  const setup = useCallback(async () => {
    const m = memberRef.current;
    if (m === null) return null;
    const session = await loadFirebaseSession();
    return session.setup(m);
  }, []);

  const join = useCallback(async () => {
    const m = memberRef.current;
    if (m === null) return false;
    try {
      const runtime = await runtimeFor(m);
      await runtime.ready;
      const fresh = readSyncCache();
      if (fresh === null) return false;
      setCache(fresh);
      return true;
    } catch {
      return false;
    }
  }, [runtimeFor]);

  const signOut = useCallback(
    (keep: KeepOnSignOut) => {
      stop(); // la copie commune est enregistrée une dernière fois
      const copy = readSyncCache();
      if (keep === 'shared' && copy !== null) keepSharedCopyLocally(copy.state);
      setCache(copy);
      continueAsGuest();
    },
    [stop, continueAsGuest],
  );

  const value = useMemo<SyncValue>(
    () => ({ mode, link, status: mode === 'sync' ? status : null, hasSharedCopy: cache !== null, setup, join, signOut }),
    [mode, link, status, cache, setup, join, signOut],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function LocalSyncProvider({ children }: { children: ReactNode }) {
  return <SyncContext.Provider value={LOCAL_SYNC}>{children}</SyncContext.Provider>;
}

/** Choisi au build : sans configuration, aucun code de synchronisation n'est inclus. */
export const SyncProvider = FIREBASE_ENABLED ? FirebaseSyncProvider : LocalSyncProvider;
