/**
 * Plan d'envoi (docs/SYNC_DESIGN.md §2.3, §5, §10) : comment les écritures
 * d'une transition locale (diffToOps) deviennent des lots Firestore. Pur,
 * sans Firebase ; le transport Firestore et le faux transport des tests
 * s'en servent tous deux.
 *
 * - « Créer si absent » sans transaction (marche hors ligne) : un document
 *   déjà connu n'est pas recréé ; un objet créé porte un jeton `creationId`
 *   que les règles protègent (un autre téléphone ne le recrée pas par-dessus,
 *   ex. le mois ouvert le 1er des deux côtés). Une restauration (`set`)
 *   garde le jeton connu ; le recalage du solde (remplacé, le dernier gagne)
 *   n'en a pas.
 * - Un lot refusé est perdu en entier : ce qui peut l'être sans dommage part
 *   dans son propre lot — annulation d'un fait (un autre appareil a pu
 *   l'annuler avant), création d'un mois, jalons de la forêt (le serveur a pu
 *   monter plus haut), mise à jour d'un document inconnu.
 * - Le reste part par lots de 450 écritures au plus (limite : 500), dans
 *   l'ordre (le SDK garde l'ordre des lots).
 */

import { emptyMilestones, mergeMilestones, validateMilestones } from '@a2/core';
import {
  docKey,
  FACT_COLLECTIONS,
  jsonEqual,
  type CollectionName,
  type DocStore,
  type WriteOp,
} from './docs';

/** Écritures au plus par lot (Firestore : 500). */
export const BATCH_LIMIT = 450;
/** Jeton de création d'un objet (règles : `keepsCreation`). */
export const CREATION_FIELD = 'creationId';
/** Objets à clé naturelle (pas un UUID) : deux téléphones peuvent les créer. */
const NATURAL_KEYS: readonly CollectionName[] = ['months'];
/** Objets remplacés en bloc (le dernier gagne) : jamais de jeton. */
const REPLACED: readonly CollectionName[] = ['balanceCorrections'];
/** Objets « dernier qui écrit gagne » (règles : isObjectColl). */
const OBJECTS: readonly CollectionName[] = ['tasks', 'groceries', 'events', 'months', 'balanceCorrections', 'circles', 'settings'];

export interface PlanContext {
  /** Vue du téléphone (dernier état connu + écritures en attente). */
  view: DocStore;
  /** Jeton de création. */
  newId: () => string;
}

function isFact(c: CollectionName): boolean {
  return FACT_COLLECTIONS.includes(c);
}

/**
 * Écriture finale d'une opération, ou null (inutile), et si elle doit partir
 * seule. `written` : documents créés plus tôt dans le même plan.
 */
function prepare(op: WriteOp, ctx: PlanContext, written: ReadonlySet<string>): { op: WriteOp; alone: boolean } | null {
  const known = ctx.view.get(docKey(op.collection, op.id));
  switch (op.kind) {
    case 'create': {
      if (known !== undefined) return null; // déjà là : « créer si absent » ne fait rien
      if (isFact(op.collection) || !OBJECTS.includes(op.collection) || REPLACED.includes(op.collection)) return { op, alone: false };
      return {
        op: { ...op, data: { ...op.data, [CREATION_FIELD]: ctx.newId() } },
        alone: NATURAL_KEYS.includes(op.collection),
      };
    }
    case 'set': {
      const token = known?.[CREATION_FIELD];
      return { op: typeof token === 'string' ? { ...op, data: { ...op.data, [CREATION_FIELD]: token } } : op, alone: false };
    }
    case 'update':
      if (isFact(op.collection)) {
        // Annulation : inutile si le fait est inconnu ou déjà annulé ; seule sinon.
        return known === undefined || known.undoneAt !== undefined ? null : { op, alone: true };
      }
      return { op, alone: known === undefined && !written.has(docKey(op.collection, op.id)) };
    case 'merge':
      return { op, alone: false };
    case 'raise': {
      const stored = validateMilestones(known);
      const incoming = validateMilestones(op.data);
      if (!incoming.ok) return null;
      const before = stored.ok ? stored.state : emptyMilestones();
      const merged = mergeMilestones(before, incoming.state);
      if (stored.ok && jsonEqual(merged, before)) return null;
      return { op: { ...op, data: { ...merged } }, alone: true };
    }
  }
}

/** Lots à envoyer, dans l'ordre. Pur. */
export function planWrites(ops: readonly WriteOp[], ctx: PlanContext): WriteOp[][] {
  const batches: WriteOp[][] = [];
  let current: WriteOp[] = [];
  const close = () => {
    if (current.length > 0) batches.push(current);
    current = [];
  };
  const written = new Set<string>();
  for (const raw of ops) {
    const planned = prepare(raw, ctx, written);
    if (planned === null) continue;
    if (raw.kind === 'create' || raw.kind === 'set') written.add(docKey(raw.collection, raw.id));
    if (planned.alone) {
      close();
      batches.push([planned.op]);
      continue;
    }
    if (current.length >= BATCH_LIMIT) close();
    current.push(planned.op);
  }
  close();
  return batches;
}

/** Clés écrites par un lot. */
export function batchKeys(ops: readonly WriteOp[]): string[] {
  return [...new Set(ops.map((op) => docKey(op.collection, op.id)))];
}
