/**
 * diffToOps : transition locale `avant → après` → écritures minimales
 * (docs/SYNC_DESIGN.md §3.1). Les ~30 actions du store restent inchangées :
 * le pont observe chaque transition et la traduit. Pur.
 *
 * | Différence                                   | Écriture                         |
 * |----------------------------------------------|----------------------------------|
 * | objet ajouté                                 | create (set si restauré)         |
 * | champs d'un objet changés                    | update des seuls champs changés  |
 * | objet retiré                                 | deletedAt (suppression douce)    |
 * | fait ajouté                                  | create du fait                   |
 * | complétion / « pas aujourd'hui » retiré      | annulation des faits vivants de l'occurrence |
 * | lanterne / achat sorti par le plafond        | rien (élagage, pas une annulation) |
 * | `forest.paused` basculé                      | fait forestEvents                |
 * | autres champs de la forêt                    | rien (dérivés) ; jalons relevés  |
 * | `selectedMonth`                              | rien (préférence du téléphone)   |
 *
 * Les changements reçus des autres ne repassent jamais par ici (pas d'écho).
 */

import {
  liveFactsOfOccurrence,
  localDateKey,
  milestonesOf,
  raisesMilestones,
  SKIPS_MAX,
  validateMilestones,
  emptyMilestones,
  type AppState,
  type ChoreCompletion,
  type ChoreSkip,
  type CompletionFact,
  type Role,
  type SkipFact,
} from '@a2/core';
import {
  DELETE_FIELD,
  docKey,
  docsOf,
  isPlainRecord,
  jsonEqual,
  META_MILESTONES,
  splitDocKey,
  type CollectionName,
  type DocData,
  type DocStore,
  type FieldWrite,
  type WriteOp,
} from './docs';
import { LIST_SPECS, listDocs, SINGLETON_SPECS, singletonDoc, type ListSpec } from './entities';

export interface DiffContext {
  /** Documents connus du téléphone (vue locale, écritures en attente comprises). */
  docs: DocStore;
  /** Rôle de ce téléphone ('a' = AL, 'b' = AC). */
  role: Role;
  now: Date;
  /** Id d'un nouveau fait (pause / reprise). */
  newId: () => string;
}

/**
 * Champs différents, feuille par feuille : une map imbriquée n'est jamais
 * remplacée en bloc (une écriture concurrente d'un champ voisin survit).
 * Un champ retiré → DELETE_FIELD. Pur.
 */
export function diffFields(before: DocData, after: DocData, path: readonly string[] = []): FieldWrite[] {
  const out: FieldWrite[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[key];
    const a = after[key];
    const p = [...path, key];
    if (a === undefined) {
      if (isPlainRecord(b)) out.push(...diffFields(b, {}, p));
      else if (b !== undefined) out.push([p, DELETE_FIELD]);
    } else if (isPlainRecord(a) && isPlainRecord(b)) {
      out.push(...diffFields(b, a, p));
    } else if (!jsonEqual(a, b)) {
      out.push([p, a]);
    }
  }
  return out;
}

function undoOps(collection: CollectionName, ids: string[], ctx: DiffContext): WriteOp[] {
  const fields: FieldWrite[] = [
    [['undoneAt'], ctx.now.toISOString()],
    [['undoneDay'], localDateKey(ctx.now)],
    [['undoneBy'], ctx.role],
  ];
  return ids.map((id) => ({ kind: 'update', collection, id, fields }));
}

/** Faits vivants connus de l'occurrence retirée (toutes les versions sont annulées). */
function occurrenceUndo(
  collection: 'completions' | 'skips',
  removed: ChoreCompletion | ChoreSkip,
  ctx: DiffContext,
): WriteOp[] {
  const known = docsOf(ctx.docs, collection).map(([id, data]) => ({ ...data, id }) as unknown as CompletionFact | SkipFact);
  const ids = liveFactsOfOccurrence(known, removed.taskId, removed.dueDate).map((f) => f.id);
  if (!ids.includes(removed.id) && ctx.docs.has(docKey(collection, removed.id))) ids.push(removed.id);
  return undoOps(collection, ids, ctx);
}

function removedOps(spec: ListSpec, id: string, prev: AppState, next: AppState, ctx: DiffContext): WriteOp[] {
  const at = ctx.now.toISOString();
  if (!spec.fact) {
    return [{ kind: 'update', collection: spec.collection, id, fields: [[['deletedAt'], at], [['updatedAt'], at]] }];
  }
  if (spec.collection === 'completions') {
    const c = prev.chores.completions.find((x) => x.id === id);
    return c === undefined ? [] : occurrenceUndo('completions', c, ctx);
  }
  if (spec.collection === 'skips' && (next.chores.skips ?? []).length < SKIPS_MAX) {
    const s = (prev.chores.skips ?? []).find((x) => x.id === id);
    return s === undefined ? [] : occurrenceUndo('skips', s, ctx);
  }
  return []; // lanternes, achats, passages au-delà du plafond : élagage, pas une annulation
}

function addedOp(spec: ListSpec, id: string, data: DocData, ctx: DiffContext): WriteOp {
  const at = ctx.now.toISOString();
  if (spec.fact) return { kind: 'create', collection: spec.collection, id, data: { ...data, role: ctx.role } };
  const stored = ctx.docs.get(docKey(spec.collection, id));
  // Restauré après une suppression douce, ou remplacé (recalage du solde) : set.
  // Déjà créé par l'autre (mois du 1er) : create, sans écraser ses valeurs.
  const kind = spec.replaceOnAdd === true || stored?.deletedAt !== undefined ? 'set' : 'create';
  return { kind, collection: spec.collection, id, data: { ...data, updatedAt: at } };
}

function listOps(spec: ListSpec, prev: AppState, next: AppState, ctx: DiffContext): WriteOp[] {
  if (spec.list(prev) === spec.list(next) && (spec.collection !== 'completions' ||
    prev.chores.tasks === next.chores.tasks)) return [];
  const before = listDocs(spec, prev, ctx.docs);
  const after = listDocs(spec, next, ctx.docs);
  const ops: WriteOp[] = [];
  for (const [key, data] of after) {
    const [, id] = splitDocKey(key);
    const old = before.get(key);
    if (old === undefined) ops.push(addedOp(spec, id, data, ctx));
    else if (!spec.fact) {
      const fields = diffFields(old, data);
      if (fields.length > 0) {
        ops.push({ kind: 'update', collection: spec.collection, id, fields: [...fields, [['updatedAt'], ctx.now.toISOString()]] });
      }
    }
  }
  for (const key of before.keys()) {
    if (!after.has(key)) ops.push(...removedOps(spec, splitDocKey(key)[1], prev, next, ctx));
  }
  return ops;
}

function sameRefs(x: readonly unknown[], y: readonly unknown[]): boolean {
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function forestOps(prev: AppState, next: AppState, ctx: DiffContext): WriteOp[] {
  if (prev.forest === next.forest) return [];
  const ops: WriteOp[] = [];
  if (prev.forest.paused !== next.forest.paused) {
    ops.push({
      kind: 'create',
      collection: 'forestEvents',
      id: ctx.newId(),
      data: {
        kind: next.forest.paused ? 'pause' : 'resume',
        localDay: localDateKey(ctx.now),
        at: ctx.now.toISOString(),
        role: ctx.role,
      },
    });
  }
  const stored = validateMilestones(ctx.docs.get(docKey('meta', META_MILESTONES)));
  const candidate = milestonesOf(next.forest);
  if (raisesMilestones(stored.ok ? stored.state : emptyMilestones(), candidate)) {
    ops.push({ kind: 'raise', collection: 'meta', id: META_MILESTONES, data: { ...candidate } });
  }
  return ops;
}

/** Écritures minimales qui portent la transition locale `prev → next`. Pur. */
export function diffToOps(prev: AppState, next: AppState, ctx: DiffContext): WriteOp[] {
  if (prev === next) return [];
  const ops: WriteOp[] = [];
  for (const spec of LIST_SPECS) ops.push(...listOps(spec, prev, next, ctx));
  for (const spec of SINGLETON_SPECS) {
    if (sameRefs(spec.sources(prev), spec.sources(next))) continue;
    const fields = diffFields(singletonDoc(spec, prev, ctx.docs), singletonDoc(spec, next, ctx.docs));
    if (fields.length > 0) {
      ops.push({ kind: 'merge', collection: 'settings', id: spec.id, fields: [...fields, [['updatedAt'], ctx.now.toISOString()]] });
    }
  }
  ops.push(...forestOps(prev, next, ctx));
  return ops;
}
