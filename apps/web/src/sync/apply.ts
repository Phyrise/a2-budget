/**
 * Application d'un lot d'écritures sur des documents, avec la sémantique de
 * Firestore (docs/SYNC_DESIGN.md §2.3) : « dernier qui écrit gagne », champ
 * par champ. Deux modifications de champs différents se combinent ; sur un
 * même champ, la dernière arrivée gagne. Une suppression douce reste : une
 * modification concurrente ne fait pas réapparaître l'objet.
 *
 * Sert au faux serveur des tests (avec `rules` : les règles essentielles de
 * FIREBASE_SETUP.md §5) et à la vue locale optimiste d'un téléphone
 * (écritures en attente appliquées sur le dernier état reçu). Pur.
 */

import { emptyMilestones, mergeMilestones, validateMilestones } from '@a2/core';
import {
  docKey,
  FACT_COLLECTIONS,
  isDeleteField,
  isPlainRecord,
  UNDO_FIELDS,
  type DocData,
  type DocKey,
  type DocStore,
  type FieldPath,
  type FieldWrite,
  type WriteOp,
} from './docs';

export interface ApplyOptions {
  /** Règles du serveur : faits non modifiables (hors annulation), pas de mise à jour d'un absent. */
  rules?: boolean;
  /** Métadonnées posées sur chaque document écrit (heure serveur, auteur). */
  stamp?: DocData;
}

export type ApplyResult =
  | { ok: true; docs: Map<DocKey, DocData>; changed: DocKey[] }
  | { ok: false; reason: string };

/** Écrit (ou supprime) un champ à un chemin ; les maps intermédiaires sont créées. Pur. */
export function setField(data: DocData, path: FieldPath, value: unknown): DocData {
  const [head, ...rest] = path;
  if (head === undefined) return data;
  if (rest.length === 0) {
    const out = { ...data };
    if (isDeleteField(value)) delete out[head];
    else out[head] = value;
    return out;
  }
  const child = data[head];
  if (!isPlainRecord(child) && isDeleteField(value)) return data;
  return { ...data, [head]: setField(isPlainRecord(child) ? child : {}, rest, value) };
}

function applyFields(data: DocData, fields: readonly FieldWrite[]): DocData {
  return fields.reduce((acc, [path, value]) => setField(acc, path, value), data);
}

function isFact(op: WriteOp): boolean {
  return FACT_COLLECTIONS.includes(op.collection);
}

function onlyUndo(fields: readonly FieldWrite[]): boolean {
  return fields.every(([path]) => path.length === 1 && (UNDO_FIELDS as readonly string[]).includes(path[0]!));
}

/** Nouvel état d'un document après une opération (undefined : inchangé ; string : refus). */
function nextDoc(current: DocData | undefined, op: WriteOp, rules: boolean): DocData | undefined | string {
  switch (op.kind) {
    case 'create':
      return current === undefined ? { ...op.data } : undefined;
    case 'set':
      if (rules && isFact(op) && current !== undefined) return 'fact-immutable';
      return { ...op.data };
    case 'update':
      if (current === undefined) return 'not-found';
      if (rules && isFact(op) && !onlyUndo(op.fields)) return 'fact-immutable';
      return applyFields(current, op.fields);
    case 'merge':
      if (rules && isFact(op)) return 'fact-immutable';
      return applyFields(current ?? {}, op.fields);
    case 'raise': {
      const known = validateMilestones(current);
      const incoming = validateMilestones(op.data);
      if (!incoming.ok) return 'invalid-milestones';
      return { ...mergeMilestones(known.ok ? known.state : emptyMilestones(), incoming.state) };
    }
  }
}

/**
 * Applique un lot d'un bloc : une opération refusée (règles) annule tout le
 * lot, comme un lot Firestore. Renvoie les clés effectivement écrites. Pur.
 */
export function applyBatch(docs: DocStore, ops: readonly WriteOp[], opts: ApplyOptions = {}): ApplyResult {
  const out = new Map(docs);
  const changed: DocKey[] = [];
  for (const op of ops) {
    const key = docKey(op.collection, op.id);
    const next = nextDoc(out.get(key), op, opts.rules === true);
    if (typeof next === 'string') return { ok: false, reason: `${key}: ${next}` };
    if (next === undefined) continue;
    out.set(key, opts.stamp === undefined ? next : { ...next, ...opts.stamp });
    if (!changed.includes(key)) changed.push(key);
  }
  return { ok: true, docs: out, changed };
}

/** Comme applyBatch, sans règles ni refus possible côté client : un lot refusé est ignoré. */
export function applyOptimistic(docs: DocStore, batches: readonly (readonly WriteOp[])[]): Map<DocKey, DocData> {
  let view = new Map(docs);
  for (const ops of batches) {
    const r = applyBatch(view, ops);
    if (r.ok) view = r.docs;
  }
  return view;
}
