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
 * - Remise à zéro (mode développeur, sync/reset.ts) : signalée par le
 *   foyer, elle arrête la synchronisation, efface la copie et les mémoires
 *   locales, puis remonte le store sur une copie vide (aucune écriture
 *   d'avant ne repart) ; tout est relu une fois le foyer vidé.
 */
import { currentMonthKey } from '@a2/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { keepSharedCopyLocally } from '../state/localCopies';
import { FIREBASE_ENABLED } from '../sync/firebase/config';
import { loadFirebaseSession } from '../sync/firebase/loader';
import type { Member, ResetOutcome, SyncRuntime, SyncSetup, SyncStatus } from '../sync/firebase/types';
import { rewindLocalSeen } from '../features/rituals/letters/letterReset';
import { wipeLocalMemories } from '../state/localMemories';
import { freshCacheAfterReset, type ResetSignal } from '../sync/reset';
import { readSyncCache, writeSyncCache, type SyncCache } from '../sync/syncCache';
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
  /** Mode développeur : vider le foyer commun (les deux téléphones repartent de zéro). */
  resetHousehold: () => Promise<ResetOutcome>;
  /** Mode développeur : lettres de la semaine effacées → « lu » remis chez les deux. */
  signalLettersCleared: () => Promise<boolean>;
}

const LOCAL_SYNC: SyncValue = {
  mode: 'local',
  link: null,
  status: null,
  hasSharedCopy: false,
  setup: () => Promise.resolve(null),
  join: () => Promise.resolve(false),
  signOut: () => undefined,
  resetHousehold: () => Promise.resolve('failed'),
  signalLettersCleared: () => Promise.resolve(false),
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
  // Remise à zéro : un nouveau lien (store remonté sur la copie vide).
  const [generation, setGeneration] = useState(0);
  const running = useRef<{ uid: string; runtime: SyncRuntime } | null>(null);
  const memberRef = useRef<Member | null>(member);
  memberRef.current = member;
  const mode = syncMode(account, cache);
  const role = cache === null ? null : syncRole(cache, member);

  // Le lien est créé une fois par entrée en mode synchronisé (et par rôle).
  const link = useMemo(
    () => (mode === 'sync' && cache !== null && role !== null ? new SyncLink(role, cache.state) : null),
    // La copie ne sert qu'au premier affichage : elle n'est pas une dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, role, generation],
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

  /** Ma marque « lu » des lettres ramenée au début de la semaine (ici et sur mes autres appareils). */
  const rewindLetters = useCallback((m: Member | null) => {
    const mark = rewindLocalSeen(m?.role ?? null);
    if (m === null) return;
    void loadFirebaseSession()
      .then((session) => {
        const channel = session.openLetters(m);
        channel.markSeen(mark);
        channel.dispose();
      })
      .catch(() => undefined);
  }, []);

  /** Le foyer a été remis à zéro (d'ici ou d'ailleurs) : rien d'avant ne doit repartir. */
  const onReset = useCallback(
    (signal: ResetSignal) => {
      const m = memberRef.current;
      if (signal.kind === 'letters') {
        rewindLetters(m);
        return;
      }
      const current = readSyncCache();
      const who = m?.role ?? current?.role;
      if (who === undefined) return;
      stop(); // plus aucune écriture de l'ancienne copie
      wipeLocalMemories();
      const fresh = freshCacheAfterReset(who, signal.epochs);
      writeSyncCache(fresh);
      setCache(fresh);
      setGeneration((g) => g + 1);
      rewindLetters(m);
    },
    [stop, rewindLetters],
  );

  // Copie commune + membre connu : la synchronisation se branche au store.
  const uid = member?.uid ?? null;
  useEffect(() => {
    const m = memberRef.current;
    if (mode !== 'sync' || link === null || m === null) return;
    let cancelled = false;
    let stopStatus: () => void = () => undefined;
    let stopReset: () => void = () => undefined;
    void runtimeFor(m)
      .then(async (runtime) => {
        if (cancelled) return;
        stopStatus = runtime.watchStatus((next) => {
          if (!cancelled) setStatus(next);
        });
        stopReset = runtime.watchReset((signal) => {
          if (!cancelled) onReset(signal);
        });
        await runtime.ready;
        if (!cancelled) link.attach(runtime);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stopStatus();
      stopReset();
      link.detach();
    };
  }, [mode, link, uid, runtimeFor, onReset]);

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

  const resetHousehold = useCallback(async (): Promise<ResetOutcome> => {
    const m = memberRef.current;
    if (m === null) return 'failed';
    const session = await loadFirebaseSession();
    return session.resetHousehold(m);
  }, []);

  const signalLettersCleared = useCallback(async () => {
    const m = memberRef.current;
    if (m === null) return false;
    try {
      const session = await loadFirebaseSession();
      await session.bumpLetters(m);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<SyncValue>(
    () => ({
      mode,
      link,
      status: mode === 'sync' ? status : null,
      hasSharedCopy: cache !== null,
      setup,
      join,
      signOut,
      resetHousehold,
      signalLettersCleared,
    }),
    [mode, link, status, cache, setup, join, signOut, resetHousehold, signalLettersCleared],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function LocalSyncProvider({ children }: { children: ReactNode }) {
  return <SyncContext.Provider value={LOCAL_SYNC}>{children}</SyncContext.Provider>;
}

/** Choisi au build : sans configuration, aucun code de synchronisation n'est inclus. */
export const SyncProvider = FIREBASE_ENABLED ? FirebaseSyncProvider : LocalSyncProvider;
