/**
 * Documents du pont (JSON) ⇄ Firestore (docs/SYNC_DESIGN.md §2.1, §5).
 *
 * - Lecture : `syncedAt` (heure du serveur) en millisecondes (curseur),
 *   les autres heures Firestore (`deletedAt`) en texte ISO.
 * - Écriture : chaque document porte `updatedBy` (UID) et `syncedAt`
 *   (heure du serveur) ; un fait créé porte `createdBy` ; une suppression
 *   douce prend l'heure du serveur ; les champs sont écrits chemin par
 *   chemin (`FieldPath` : les clés peuvent contenir « . »).
 */
import {
  collection,
  deleteField,
  doc,
  FieldPath,
  serverTimestamp,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { HOUSEHOLD_ID } from '../../allowlist';
import {
  clean,
  FACT_COLLECTIONS,
  isDeleteField,
  isPlainRecord,
  type CollectionName,
  type DocData,
  type FieldWrite,
  type WriteOp,
} from '../../docs';

export function householdRef(db: Firestore): DocumentReference {
  return doc(db, 'households', HOUSEHOLD_ID);
}

export function collectionRef(db: Firestore, name: CollectionName): CollectionReference {
  return collection(db, 'households', HOUSEHOLD_ID, name);
}

function plain(value: unknown, field: string | null): unknown {
  if (value instanceof Timestamp) return field === 'syncedAt' ? value.toMillis() : value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((v) => plain(v, null));
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = plain(v, null);
    return out;
  }
  return value;
}

/** Données lues (heures estimées pour les écritures en attente) → document du pont. */
export function fromFirestore(data: DocumentData): DocData {
  const out: DocData = {};
  for (const [k, v] of Object.entries(data)) out[k] = plain(v, k);
  return out;
}

/** `syncedAt` d'un document lu, en ms (ou undefined). */
export function syncedAtOf(data: DocumentData): number | undefined {
  const t: unknown = data.syncedAt;
  return t instanceof Timestamp ? t.toMillis() : undefined;
}

function fieldValue(path: readonly string[], value: unknown): unknown {
  if (isDeleteField(value)) return deleteField();
  if (path.length === 1 && path[0] === 'deletedAt') return serverTimestamp(); // règles : heure du serveur
  return clean(value);
}

/** Champs « chemin → valeur » en objet imbriqué (écriture fusionnée d'un document unique). */
function nested(fields: readonly FieldWrite[]): DocumentData {
  const out: DocumentData = {};
  for (const [path, value] of fields) {
    let node = out;
    path.forEach((segment, i) => {
      if (i === path.length - 1) node[segment] = fieldValue(path, value);
      else node = (node[segment] = isPlainRecord(node[segment]) ? node[segment] : {}) as DocumentData;
    });
  }
  return out;
}

/** Ajoute une écriture du pont au lot Firestore. */
export function addToBatch(batch: WriteBatch, db: Firestore, op: WriteOp, uid: string): void {
  const ref = doc(collectionRef(db, op.collection), op.id);
  const stamp = { updatedBy: uid, syncedAt: serverTimestamp() };
  switch (op.kind) {
    case 'create': {
      const author = FACT_COLLECTIONS.includes(op.collection) ? { createdBy: uid } : {};
      batch.set(ref, { ...clean(op.data), ...author, ...stamp });
      return;
    }
    case 'set':
    case 'raise':
      batch.set(ref, { ...clean(op.data), ...stamp });
      return;
    case 'merge':
      batch.set(ref, { ...nested(op.fields), ...stamp }, { merge: true });
      return;
    case 'update': {
      const rest: unknown[] = [];
      for (const [path, value] of op.fields.slice(1)) rest.push(new FieldPath(...path), fieldValue(path, value));
      rest.push('updatedBy', uid, 'syncedAt', serverTimestamp());
      const [first] = op.fields;
      if (first === undefined) batch.update(ref, stamp);
      else batch.update(ref, new FieldPath(...first[0]), fieldValue(first[0], first[1]), ...rest);
      return;
    }
  }
}
