/**
 * « En direct » (V5.1, mode connecté seulement) : où est l'autre, coucous,
 * et bocal de kompeitō partagé branché sur le magasin du jeu.
 *
 * - Invité, ou sans configuration : valeur fixe « éteinte », Firebase n'est
 *   jamais chargé d'ici.
 * - Ce téléphone publie son onglet à chaque changement, `visible: false`
 *   quand l'app passe en arrière-plan, et un battement toutes les 60 s tant
 *   qu'elle est visible. Cachée : ni écriture ni écoute.
 * - Monté sous ShellProvider (l'onglet affiché).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount } from '../account/AccountContext';
import { useSync } from '../account/SyncContext';
import type { ModuleId } from '../app/prefs';
import { useShell } from '../app/ShellContext';
import { localPlayBackend, setPlayBackend } from '../creatures/play';
import { sharedPlayBackend } from '../creatures/play/shared';
import type { MemberRole } from '../sync/allowlist';
import { FIREBASE_ENABLED } from '../sync/firebase/config';
import { loadFirebaseSession } from '../sync/firebase/loader';
import type { LiveChannel } from './liveTypes';
import { HEARTBEAT_MS, canPoke, freshPoke, hereTab, partnerOf, type PresenceInfo } from './presenceModel';

export interface LiveValue {
  /** Mon rôle (null : pas connecté). */
  me: MemberRole | null;
  /** Rôle de l'autre (null : pas connecté). */
  partner: MemberRole | null;
  /** Onglet où se trouve l'autre, s'il est là (null : absent). */
  partnerTab: ModuleId | null;
  /** Envoie un coucou ; faux si trop tôt (anti-rafale 5 s) ou hors connexion. */
  poke: () => boolean;
  /** Coucous reçus (change à chaque nouveau coucou). */
  pokesReceived: number;
}

const OFF: LiveValue = { me: null, partner: null, partnerTab: null, poke: () => false, pokesReceived: 0 };
const LiveContext = createContext<LiveValue>(OFF);

export function useLive(): LiveValue {
  return useContext(LiveContext);
}

/** Recalcul de « là / absent » (le signe vieillit sans nouvel envoi). */
const TICK_MS = 15_000;

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

function FirebaseLiveProvider({ children }: { children: ReactNode }) {
  const { mode } = useSync();
  const { member } = useAccount();
  const { module } = useShell();
  const visible = usePageVisible();
  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [presence, setPresence] = useState<PresenceInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pokesReceived, setPokesReceived] = useState(0);
  const moduleRef = useRef(module);
  moduleRef.current = module;
  const lastSent = useRef<number | null>(null);
  const lastSeen = useRef(0);

  // Ouverture du canal (connecté, copie commune) ; bocal partagé branché.
  const uid = member?.uid ?? null;
  const memberRef = useRef(member);
  memberRef.current = member;
  useEffect(() => {
    const m = memberRef.current;
    if (mode !== 'sync' || m === null) return;
    let cancelled = false;
    let open: LiveChannel | null = null;
    void loadFirebaseSession()
      .then((session) => {
        if (cancelled) return;
        open = session.openLive(m);
        setPlayBackend(sharedPlayBackend(open, localPlayBackend.load()));
        setChannel(open);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (open !== null) {
        open.publish(moduleRef.current, false);
        open.dispose();
        setPlayBackend(localPlayBackend);
      }
      setChannel(null);
      setPresence(null);
    };
  }, [mode, uid]);

  // Mon onglet : à chaque changement, à la mise en arrière-plan, battement de 60 s si visible.
  useEffect(() => {
    if (channel === null) return;
    channel.publish(module, visible);
    if (!visible) return;
    const beat = window.setInterval(() => channel.publish(moduleRef.current, true), HEARTBEAT_MS);
    return () => window.clearInterval(beat);
  }, [channel, module, visible]);

  // La fiche de l'autre, écoutée seulement quand l'app est visible.
  useEffect(() => {
    if (channel === null || !visible) return;
    const stop = channel.watchPartner((p) => {
      setPresence(p);
      setNow(Date.now());
      if (p !== null && freshPoke(lastSeen.current, p.pokeAt, Date.now())) {
        lastSeen.current = p.pokeAt ?? 0;
        setPokesReceived((n) => n + 1);
      }
    });
    const tick = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      stop();
      window.clearInterval(tick);
    };
  }, [channel, visible]);

  const poke = useCallback(() => {
    const t = Date.now();
    if (channel === null || !canPoke(lastSent.current, t)) return false;
    lastSent.current = t;
    channel.poke();
    return true;
  }, [channel]);

  const me = channel?.role ?? null;
  const partnerTab = visible ? hereTab(presence, now) : null;
  const value = useMemo<LiveValue>(
    () => ({ me, partner: me === null ? null : partnerOf(me), partnerTab, poke, pokesReceived }),
    [me, partnerTab, poke, pokesReceived],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

function OffLiveProvider({ children }: { children: ReactNode }) {
  return <LiveContext.Provider value={OFF}>{children}</LiveContext.Provider>;
}

/** Choisi au build : sans configuration, rien de tout cela n'est inclus. */
export const LiveProvider = FIREBASE_ENABLED ? FirebaseLiveProvider : OffLiveProvider;
