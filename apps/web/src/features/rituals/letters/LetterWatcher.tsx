/**
 * Lettres du cercle (V5.2), monté une fois dans l'app : calcule la lettre
 * non lue de l'autre, la marque lue (partagée entre mes appareils), montre
 * un toast « ✉ » quand une lettre arrive pendant que l'app est ouverte, et
 * porte la feuille de lecture (ouvrable de partout).
 *
 * - Invité (un seul téléphone pour deux) : aucune lettre, aucun appel.
 * - Connecté : une écoute de MA fiche `memberState/{rôle}` seulement quand
 *   l'app est visible ; la marque locale (cet appareil) couvre l'attente.
 */
import { circleWriters, nextSeenMark, unreadLetter, type Circle } from '@a2/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '../../../account/AccountContext';
import { useShell } from '../../../app/ShellContext';
import { useApp } from '../../../state/store';
import { FIREBASE_ENABLED } from '../../../sync/firebase/config';
import { loadFirebaseSession } from '../../../sync/firebase/loader';
import { useToast } from '../../../ui';
import { ritualWeek, type Names } from '../ritualText';
import { LetterSheet } from './LetterSheet';
import { laterMark, letters, readLocalSeen, useLetters, writeLocalSeen } from './letterStore';
import type { LetterChannel } from './letterTypes';
import './letters.css';

/** Sans réponse de la fiche partagée (hors ligne), on se fie à la marque locale. */
const SEEN_WAIT_MS = 2500;

function useVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export function LetterWatcher() {
  const { appState, today, me } = useApp();
  const { member } = useAccount();
  const { setModule } = useShell();
  const toast = useToast();
  const { reading, seenResets } = useLetters();
  const visible = useVisible();
  const [channel, setChannel] = useState<LetterChannel | null>(null);
  const [remoteSeen, setRemoteSeen] = useState<string | null>(null);
  const [localSeen, setLocalSeen] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  // Marque locale de ce rôle, et attente bornée de la fiche partagée.
  useEffect(() => {
    setRemoteSeen(null);
    setRemoteLoaded(false);
    setSettled(false);
    setLocalSeen(me === null ? null : readLocalSeen(me));
    if (me === null) return;
    const timer = window.setTimeout(() => setSettled(true), SEEN_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [me]);

  // Mode développeur : marque locale ramenée en arrière (lettres effacées), relue.
  useEffect(() => {
    if (seenResets > 0 && me !== null) setLocalSeen(readLocalSeen(me));
  }, [seenResets, me]);

  // Canal « lu » (chunk Firebase déjà chargé par la synchronisation).
  const uid = member?.uid ?? null;
  useEffect(() => {
    if (!FIREBASE_ENABLED || me === null || member === null || member.role !== me) return;
    let cancelled = false;
    let opened: LetterChannel | null = null;
    void loadFirebaseSession()
      .then((session) => {
        if (cancelled) return;
        opened = session.openLetters(member);
        setChannel(opened);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      opened?.dispose();
      setChannel(null);
    };
    // Le membre ne compte que par son uid et son rôle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, uid]);

  // Écoute de ma fiche, seulement app visible.
  useEffect(() => {
    if (channel === null || !visible) return;
    return channel.watchSeen((next) => {
      setRemoteSeen(next);
      setRemoteLoaded(true);
      setSettled(true);
    });
  }, [channel, visible]);

  // Lu sur cet appareil (même hors ligne) : la fiche partagée suit.
  useEffect(() => {
    if (channel === null || !remoteLoaded || localSeen === null) return;
    if (remoteSeen === null || localSeen > remoteSeen) channel.markSeen(localSeen);
  }, [channel, remoteLoaded, localSeen, remoteSeen]);

  const seen = laterMark(remoteSeen, localSeen);
  const unread = me !== null && settled ? unreadLetter(appState?.rituals, me, seen, today) : null;

  // Publiée pour l'enveloppe et la pastille.
  useEffect(() => {
    letters.setUnread(unread);
  }, [unread]);

  // Une lettre arrive (ou est complétée) pendant que l'app est ouverte : « ✉ ».
  const lastKey = useRef<string | null | undefined>(undefined);
  const key = unread === null ? null : `${unread.id}|${unread.heldAt}`;
  useEffect(() => {
    if (!settled) return;
    const before = lastKey.current;
    lastKey.current = key;
    if (before === undefined || key === null || key === before || reading !== null) return;
    toast.show({
      message: <span className="letter-toast" aria-label="Une lettre">✉</span>,
      action: { label: 'Lire', onClick: () => letters.open() },
      duration: 5000,
      priority: 'low',
    });
  }, [key, settled, reading, toast]);

  const markRead = useCallback(
    (letter: Circle) => {
      if (me === null) return;
      const mark = nextSeenMark(seen, letter);
      if (mark === seen) return;
      setLocalSeen(mark);
      writeLocalSeen(me, mark);
    },
    [me, seen],
  );

  // Ouvrir, c'est lire (sur tous mes appareils).
  useEffect(() => {
    if (reading !== null) markRead(reading);
  }, [reading, markRead]);

  // Plus de lettre à lire (invité, déconnexion) : la feuille se ferme.
  useEffect(() => {
    if (me === null) letters.close();
  }, [me]);

  if (appState === null || me === null) return null;
  const names: Names = { a: appState.budget.settings.personA.name, b: appState.budget.settings.personB.name };
  const week = reading?.weekStart ?? ritualWeek(today).weekStart;
  const canWrite = reading !== null && reading.weekStart === ritualWeek(today).weekStart && !circleWriters(appState.rituals, week).includes(me);

  return (
    <LetterSheet
      letter={reading}
      names={names}
      today={today}
      canWrite={canWrite}
      onClose={() => letters.close()}
      onWrite={() => {
        setModule('maison');
        letters.requestWrite();
      }}
    />
  );
}
