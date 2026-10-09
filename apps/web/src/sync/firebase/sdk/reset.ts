/**
 * Remise à zéro du foyer, côté serveur (mode développeur, reset.ts,
 * docs/SYNC_DESIGN.md §22). Exige le réseau.
 *
 * 1. Le SIGNAL d'abord : `resetEpoch + 1`, `resetAt` (heure du serveur),
 *    `resetBy` (UID), `resetting: true` sur le document du foyer. Les
 *    téléphones qui le voient arrêtent leur synchronisation et attendent.
 * 2. Le vidage : chaque collection relue sur le serveur, supprimée par lots
 *    de 400 (règles : seulement par l'auteur du signal, pendant 10 min).
 *    Le foyer, les fiches `memberState` (appartenance) et l'abonnement
 *    push restent.
 * 3. `resetting: false` : les téléphones relisent tout (foyer vide).
 */
import {
  collection,
  getDocsFromServer,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { HOUSEHOLD_ID } from '../../allowlist';
import { RESET_COLLECTIONS, chunks } from '../../reset';
import { errorCode, type Member, type ResetOutcome } from '../types';
import { householdRef } from './convert';

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function resetHousehold(db: Firestore, member: Member): Promise<ResetOutcome> {
  if (offline()) return 'offline';
  const home = householdRef(db);
  const stamp = () => ({ updatedBy: member.uid, syncedAt: serverTimestamp() });
  try {
    await updateDoc(home, { resetEpoch: increment(1), resetAt: serverTimestamp(), resetBy: member.uid, resetting: true, ...stamp() });
    for (const name of RESET_COLLECTIONS) {
      const snap = await getDocsFromServer(collection(db, 'households', HOUSEHOLD_ID, name));
      for (const part of chunks(snap.docs)) {
        const batch = writeBatch(db);
        for (const d of part) batch.delete(d.ref);
        await batch.commit();
      }
    }
    await updateDoc(home, { resetting: false, ...stamp() });
    return 'done';
  } catch (error) {
    console.warn('A² Home — remise à zéro interrompue', errorCode(error) ?? error);
    return errorCode(error) === 'unavailable' ? 'offline' : 'failed';
  }
}

/** Lettres de la semaine effacées : le signal pour les deux téléphones (« lu » remis). */
export async function bumpLetters(db: Firestore, member: Member): Promise<void> {
  await updateDoc(householdRef(db), { lettersEpoch: increment(1), updatedBy: member.uid, syncedAt: serverTimestamp() });
}

