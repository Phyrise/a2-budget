/**
 * Première connexion d'un téléphone (docs/SYNC_DESIGN.md §6) : contenu du
 * foyer, puis — s'il est vide — envoi des données locales par lots.
 *
 * - `meta/migration` note qui initialise et quand (`running`, puis `done`) ;
 *   le réclamer est une transaction « créer si absent » : si les deux
 *   téléphones essaient ensemble, un seul envoie, l'autre adopte.
 * - Reprise idempotente : chaque essai relit ce qui est déjà sur le serveur
 *   et n'envoie que le reste (ids stables, même heure de migration).
 * - Exige le réseau ; hors ligne pendant l'envoi, le lot en cours attend
 *   (le SDK le garde) et l'envoi continue au retour.
 */
import type { AppState } from '@a2/core';
import { doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { COLLECTIONS, docKey, type DocKey } from '../../docs';
import { MIGRATION_DOC, householdContent, migrationBatches, parseMigrationMark, type MigrationMark } from '../../migration';
import { errorCode, type InitializeOutcome, type Member, type SyncSetup } from '../types';
import { addToBatch, collectionRef } from './convert';

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function failure(error: unknown): 'offline' | 'failed' {
  return errorCode(error) === 'unavailable' ? 'offline' : 'failed';
}

export function syncSetup(db: Firestore, member: Member): SyncSetup {
  const markRef = doc(collectionRef(db, 'meta'), MIGRATION_DOC);
  const stamp = () => ({ updatedBy: member.uid, syncedAt: serverTimestamp() });

  /** Réclame l'envoi (ou le reprend) ; null si l'autre l'a déjà fait ou le fait. */
  const claim = () =>
    runTransaction(db, async (tx): Promise<MigrationMark | null> => {
      const current = parseMigrationMark((await tx.get(markRef)).data() ?? null);
      if (current !== null && householdContent(current, member.role) !== 'resume') return null;
      if (current !== null) return current;
      const mark: MigrationMark = { status: 'running', role: member.role, at: new Date().toISOString() };
      tx.set(markRef, { ...mark, ...stamp() });
      return mark;
    });

  return {
    async inspect() {
      if (navigator.onLine === false) return 'offline';
      try {
        const snap = await getDocFromServer(markRef);
        return householdContent(parseMigrationMark(snap.data() ?? null), member.role);
      } catch (error) {
        return failure(error);
      }
    },

    async initialize(state: AppState, onProgress): Promise<InitializeOutcome> {
      if (navigator.onLine === false) return 'offline';
      try {
        const mark = await claim();
        if (mark === null) return 'taken';
        const existing = new Set<DocKey>();
        for (const name of COLLECTIONS) {
          const snap = await getDocsFromServer(collectionRef(db, name));
          for (const d of snap.docs) existing.add(docKey(name, d.id));
        }
        const batches = migrationBatches(state, { now: new Date(mark.at), role: member.role, existing, newId: newToken });
        const total = batches.reduce((n, b) => n + b.length, 0);
        let sent = 0;
        onProgress(sent, total);
        for (const group of batches) {
          const batch = writeBatch(db);
          for (const op of group) addToBatch(batch, db, op, member.uid);
          await batch.commit();
          sent += group.length;
          onProgress(sent, total);
        }
        await setDoc(markRef, { ...mark, status: 'done', doneAt: new Date().toISOString(), ...stamp() });
        return 'done';
      } catch (error) {
        return failure(error);
      }
    },
  };
}
