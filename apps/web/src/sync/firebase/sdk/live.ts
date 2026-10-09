/**
 * Canal « en direct » (V5.1, chunk Firebase) : présence de l'autre, coucous
 * et bocal de kompeitō partagé. Contrat : presence/liveTypes.ts.
 *
 * - Présence : `memberState/{mon rôle}` reçoit { tab, visible, at } (fusion,
 *   heure du serveur) ; on écoute seulement la fiche de l'autre. L'appelant
 *   arrête l'écoute quand l'app est cachée (aucune lecture en arrière-plan).
 * - V5.7 — compagnon : `memberState/{mon rôle}.companion` (fusion, comme la
 *   présence : aucun autre champ touché) ; celui de l'autre arrive avec sa
 *   présence, le mien est lu une fois (presence/companionChoices.ts).
 * - Bocal : chaque rôle écrit SON document `play/{rôle}` en incréments
 *   (`increment`) ; on écoute les deux. La migration unique de l'état local
 *   passe par une transaction (marque `migrated`), qui garde les gestes
 *   déjà comptés avant elle.
 * - Hors ligne : les écritures attendent dans la file du SDK.
 */
import {
  doc,
  getDocFromCache,
  getDocFromServer,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  waitForPendingWrites,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { LiveChannel, PlayCounts, PlayDocs } from '../../../presence/liveTypes';
import { parsePresence, partnerOf } from '../../../presence/presenceModel';
import { HOUSEHOLD_ID } from '../../allowlist';
import type { Member } from '../types';
import { fromFirestore } from './convert';

const PLAY_FIELDS = ['given', 'spent', 'caught', 'golden'] as const;

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function playOf(data: DocumentData | undefined): (PlayCounts & { migrated: boolean }) | undefined {
  if (data === undefined) return undefined;
  return { given: count(data.given), spent: count(data.spent), caught: count(data.caught), golden: count(data.golden), migrated: data.migrated === true };
}

/** Heures du serveur en millisecondes (estimées pour les écritures en attente). */
function presenceData(data: DocumentData | undefined): Record<string, unknown> | null {
  if (data === undefined) return null;
  const plain = fromFirestore(data);
  const ms = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : v);
  return { ...plain, at: ms(plain.at), pokeAt: ms(plain.pokeAt) };
}

export function openLive(db: Firestore, member: Member): LiveChannel {
  const home = doc(db, 'households', HOUSEHOLD_ID);
  const mine = doc(home, 'memberState', member.role);
  const theirs = doc(home, 'memberState', partnerOf(member.role));
  const myPlay = doc(home, 'play', member.role);
  const stamp = () => ({ updatedBy: member.uid, syncedAt: serverTimestamp() });
  const stops = new Set<() => void>();
  let disposed = false;
  const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

  const track = (stop: () => void) => {
    stops.add(stop);
    return () => {
      stop();
      stops.delete(stop);
    };
  };

  return {
    role: member.role,

    publish(tab, visible) {
      if (disposed) return;
      quiet(setDoc(mine, { tab, visible, at: serverTimestamp(), ...stamp() }, { merge: true }));
    },

    poke() {
      if (disposed) return;
      quiet(setDoc(mine, { pokeAt: serverTimestamp(), ...stamp() }, { merge: true }));
    },

    watchPartner(listener) {
      return track(
        onSnapshot(
          theirs,
          { includeMetadataChanges: false },
          (snap) => {
            const data = snap.data({ serverTimestamps: 'estimate' });
            listener(parsePresence(presenceData(data)), data?.companion);
          },
          () => listener(null, undefined),
        ),
      );
    },

    async readMyCompanion() {
      // Du serveur, après mes écritures en attente : tant qu'une fusion de
      // présence attend, le SDK rend une fiche réduite à ses champs (vu sur
      // l'émulateur : ni uid ni compagnon). Une fiche sans `uid` n'est donc
      // jamais prise pour la vérité du serveur (pas de reprise sur elle).
      // Hors ligne, l'attente dure jusqu'au retour du réseau (l'affichage vit
      // de la copie locale) ; le cache ne sert que si la lecture échoue.
      try {
        await waitForPendingWrites(db);
        const data = (await getDocFromServer(mine)).data();
        return { companion: data?.companion, fromServer: typeof data?.uid === 'string' };
      } catch {
        try {
          return { companion: (await getDocFromCache(mine)).data()?.companion, fromServer: false };
        } catch {
          return null;
        }
      }
    },

    setCompanion(id) {
      if (disposed) return;
      quiet(setDoc(mine, { companion: id, ...stamp() }, { merge: true }));
    },

    watchPlay(listener) {
      const docs: PlayDocs = {};
      const confirmed = { a: false, b: false };
      const stopOne = (role: 'a' | 'b') =>
        onSnapshot(
          doc(home, 'play', role),
          { includeMetadataChanges: true },
          (snap) => {
            const value = playOf(snap.data());
            if (value === undefined) delete docs[role];
            else docs[role] = value;
            confirmed[role] ||= !snap.metadata.fromCache;
            listener({ ...docs }, confirmed.a && confirmed.b);
          },
          () => undefined,
        );
      const a = stopOne('a');
      const b = stopOne('b');
      return track(() => {
        a();
        b();
      });
    },

    addPlay(delta) {
      if (disposed) return;
      const fields: Record<string, unknown> = {};
      for (const f of PLAY_FIELDS) {
        const n = count(delta[f]);
        if (n > 0) fields[f] = increment(n);
      }
      if (Object.keys(fields).length === 0) return;
      quiet(setDoc(myPlay, { ...fields, ...stamp() }, { merge: true }));
    },

    async migratePlay(local) {
      if (disposed) return;
      await runTransaction(db, async (tx) => {
        const [snap, house] = await Promise.all([tx.get(myPlay), tx.get(home)]);
        const current = playOf(snap.data());
        if (current?.migrated) return;
        // Foyer déjà remis à zéro (mode développeur) : l'ancien bocal local ne revient jamais.
        const fresh = typeof house.data()?.resetEpoch === 'number';
        const next: Record<string, unknown> = { migrated: true, ...stamp() };
        // Gestes déjà comptés (écrits avant la migration) + état local d'avant.
        for (const f of PLAY_FIELDS) next[f] = (current?.[f] ?? 0) + (fresh ? 0 : count(local[f]));
        tx.set(myPlay, next, { merge: true });
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const stop of stops) stop();
      stops.clear();
    },
  };
}
