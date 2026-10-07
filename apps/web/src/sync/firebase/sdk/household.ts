/**
 * Premier passage d'un membre : crée `households/a2home` s'il n'existe pas
 * (le premier membre connecté le crée, il n'y a rien à rejoindre) et sa
 * fiche `memberState/{rôle}`. Transaction « créer si absent » : deux
 * téléphones qui arrivent ensemble n'écrasent rien. Exige le réseau.
 */
import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { HOUSEHOLD_ID } from '../../allowlist';
import { memberDocUpdate, newHouseholdDoc, type MemberDoc } from '../../household';
import { errorCode, type HouseholdOutcome, type Member } from '../types';

export async function ensureHousehold(db: Firestore, member: Member, now = new Date()): Promise<HouseholdOutcome> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const home = doc(db, 'households', HOUSEHOLD_ID);
  const mine = doc(home, 'memberState', member.role);
  try {
    await runTransaction(db, async (tx) => {
      const [homeSnap, mineSnap] = await Promise.all([tx.get(home), tx.get(mine)]);
      const stamp = { updatedBy: member.uid, syncedAt: serverTimestamp() };
      if (!homeSnap.exists()) tx.set(home, { ...newHouseholdDoc(member.role, now), ...stamp });
      const existing = mineSnap.exists() ? (mineSnap.data() as Partial<MemberDoc>) : null;
      const update = memberDocUpdate(existing, member.uid, now);
      if (update !== null) tx.set(mine, { ...update, ...stamp }, { merge: true });
    });
    return 'ready';
  } catch (error) {
    return errorCode(error) === 'unavailable' ? 'offline' : 'failed';
  }
}
