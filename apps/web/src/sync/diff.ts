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
 * | complétion / « pas aujourd'hui » retiré      | annulation de SES faits vivants de l'occurrence |
 * | achat retiré sous le plafond (vidage annulé) | annulation de son propre fait d'achat |
 * | lanterne / achat sorti par le plafond        | rien (élagage, pas une annulation) |
 * | `forest.paused` basculé                      | fait forestEvents                |
 * | autres champs de la forêt                    | rien (dérivés) ; jalons relevés  |
 * | `selectedMonth`                              | rien (préférence du téléphone)   |
 *
 * Les changements reçus des autres ne repassent jamais par ici (pas d'écho).
 */

import {
  GROCERY_HISTORY_MAX,
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
import { QUESTS, questAddedOps } from './quests';

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
 * Un champ retiré → DELETE_FIELD. Une map qui apparaît (`paid` absent
 * jusque-là) s'écrit aussi feuille par feuille : sinon le premier virement
 * coché d'un côté effacerait celui coché de l'autre, hors ligne. Pur.
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
    } else if (isPlainRecord(a) && (isPlainRecord(b) || b === undefined)) {
      out.push(...diffFields(isPlainRecord(b) ? b : {}, a, p));
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

/** Faits vivants de l'occurrence posés par ce téléphone (on n'annule jamais les gestes de l'autre). Pur. */
export function ownLiveFacts(
  docs: DocStore,
  collection: 'completions' | 'skips',
  taskId: string,
  dueDate: string,
  role: Role,
): string[] {
  const known = docsOf(docs, collection).map(([id, data]) => ({ ...data, id }) as unknown as (CompletionFact | SkipFact) & { role?: unknown });
  return liveFactsOfOccurrence(known, taskId, dueDate).filter((f) => f.role === role).map((f) => f.id);
}

/**
 * Décocher (ou annuler « pas aujourd'hui ») : faits vivants de l'occurrence
 * retirée, posés par ce téléphone. Ceux de l'autre restent (les règles le
 * refuseraient hors mode développeur) : « fait ensemble » redevient « fait
 * par l'autre ».
 */
function occurrenceUndo(
  collection: 'completions' | 'skips',
  removed: ChoreCompletion | ChoreSkip,
  ctx: DiffContext,
): WriteOp[] {
  const ids = ownLiveFacts(ctx.docs, collection, removed.taskId, removed.dueDate, ctx.role);
  const own = ctx.docs.get(docKey(collection, removed.id));
  if (!ids.includes(removed.id) && own !== undefined && own.undoneAt === undefined && own.role === ctx.role) ids.push(removed.id);
  return undoOps(collection, ids, ctx);
}

function removedOps(spec: ListSpec, id: string, prev: AppState, next: AppState, ctx: DiffContext): WriteOp[] {
  const at = ctx.now.toISOString();
  if (spec.collection === QUESTS) return []; // jamais supprimées (élagage local seulement)
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
  // « Vider le panier » annulé : l'historique raccourcit (le plafond, lui,
  // remplace sans raccourcir). On n'annule que ses propres achats vivants.
  if (spec.collection === 'groceryHistory' && (next.groceries.history ?? []).length < GROCERY_HISTORY_MAX) {
    const own = ctx.docs.get(docKey('groceryHistory', id));
    return own !== undefined && own.undoneAt === undefined && own.role === ctx.role ? undoOps('groceryHistory', [id], ctx) : [];
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
    if (old === undefined && spec.collection === QUESTS) ops.push(...questAddedOps(id, data, ctx.now.toISOString()));
    else if (old === undefined) ops.push(addedOp(spec, id, data, ctx));
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
    const id = ctx.newId();
    ops.push({
      kind: 'create',
      collection: 'forestEvents',
      id,
      data: {
        id,
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
