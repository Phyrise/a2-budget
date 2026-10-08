/**
 * Lettres du cercle (V5.2, chunk Firebase) : la marque « lu » de mes
 * appareils, dans `memberState/{mon rôle}.circleSeen` (fusion : les autres
 * champs de la fiche — uid, présence… — ne sont pas touchés). Contrat :
 * features/rituals/letters/letterTypes.ts.
 *
 * Une seule écoute (ma fiche), arrêtée par l'appelant quand l'app est
 * cachée. Hors ligne : l'écriture attend dans la file du SDK.
 */
import { doc, onSnapshot, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { SEEN_FIELD, type LetterChannel } from '../../../features/rituals/letters/letterTypes';
import { HOUSEHOLD_ID } from '../../allowlist';
import type { Member } from '../types';

export function openLetters(db: Firestore, member: Member): LetterChannel {
  const mine = doc(db, 'households', HOUSEHOLD_ID, 'memberState', member.role);
  const stops = new Set<() => void>();
  let disposed = false;
  return {
    watchSeen(listener) {
      const stop = onSnapshot(
        mine,
        (snap) => {
          const seen: unknown = snap.data()?.[SEEN_FIELD];
          listener(typeof seen === 'string' ? seen : null);
        },
        () => undefined,
      );
      stops.add(stop);
      return () => {
        stop();
        stops.delete(stop);
      };
    },
    markSeen(mark) {
      if (disposed) return;
      void setDoc(mine, { [SEEN_FIELD]: mark, updatedBy: member.uid, syncedAt: serverTimestamp() }, { merge: true }).catch(
        () => undefined,
      );
    },
    dispose() {
      disposed = true;
      for (const stop of stops) stop();
      stops.clear();
    },
  };
}
