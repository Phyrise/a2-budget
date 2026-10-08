/**
 * Premiers documents du foyer à partir de l'état local du téléphone de
 * référence (docs/SYNC_DESIGN.md §6.2) :
 * - chaque entité → son document (ids existants, rangs 0, 1, 2…) ;
 * - complétions existantes → faits marqués `imported: true` ;
 * - forêt actuelle → point de reprise genèse `checkpoints/{jour}` tel quel
 *   (les crédits déjà tombstonés n'ont plus de fait : on part de l'état, on
 *   ne le reconstruit pas) ;
 * - jalons initialisés depuis cette forêt.
 *
 * Relancer est sans risque (ids stables, `create` = « créer si absent ») :
 * l'envoi par lots (migrationBatches) saute les documents déjà là. Le
 * document `meta/migration` note l'avancement (qui, quand, fini ou non).
 * Pur.
 */

import { localDateKey, milestonesOf, type AppState, type Role } from '@a2/core';
import {
  clean,
  docKey,
  FACT_COLLECTIONS,
  META_MILESTONES,
  splitDocKey,
  isPlainRecord,
  type DocData,
  type DocKey,
  type WriteOp,
} from './docs';
import { entityDocs } from './entities';
import type { HouseholdContent } from './firebase/types';
import { planWrites } from './writePlan';

/** Documents initiaux (sans métadonnées serveur). */
export function migrationDocs(state: AppState, now: Date): Map<DocKey, DocData> {
  const day = localDateKey(now);
  const docs = entityDocs(state);
  for (const [key, data] of docs) {
    if (splitDocKey(key)[0] !== 'completions') continue;
    // Clé sous laquelle le crédit a vraiment été enregistré (tâche passée de
    // jour fixe à souple depuis) : celle du registre si elle y est.
    const exact = `${String(data.taskId)}|${String(data.dueDate)}`;
    const creditKey = state.forest.creditLedger[exact] !== undefined ? exact : data.creditKey;
    docs.set(key, { ...data, creditKey, imported: true });
  }
  docs.set(docKey('checkpoints', day), clean({ day, forest: state.forest, genesis: true }));
  docs.set(docKey('meta', META_MILESTONES), { ...milestonesOf(state.forest) });
  return docs;
}

/** Écritures de la migration (un seul lot ici ; découpage en lots plus tard). */
export function migrationOps(state: AppState, ctx: { now: Date; role: Role }): WriteOp[] {
  const at = ctx.now.toISOString();
  const ops: WriteOp[] = [];
  for (const [key, data] of migrationDocs(state, ctx.now)) {
    const [collection, id] = splitDocKey(key);
    if (collection === 'meta') {
      ops.push({ kind: 'raise', collection: 'meta', id: META_MILESTONES, data });
    } else {
      const meta = FACT_COLLECTIONS.includes(collection) ? { role: ctx.role } : { updatedAt: at };
      ops.push({ kind: 'create', collection, id, data: { ...data, ...meta } });
    }
  }
  return ops;
}

/** Avancement de la migration : `meta/migration`. */
export const MIGRATION_DOC = 'migration';

export interface MigrationMark {
  status: 'running' | 'done';
  /** Rôle du téléphone qui initialise le foyer. */
  role: Role;
  /** Heure de la migration (ISO) : même genèse et mêmes documents à la reprise. */
  at: string;
}

export function parseMigrationMark(data: unknown): MigrationMark | null {
  if (!isPlainRecord(data)) return null;
  const { status, role, at } = data;
  if ((status !== 'running' && status !== 'done') || (role !== 'a' && role !== 'b') || typeof at !== 'string') return null;
  if (Number.isNaN(Date.parse(at))) return null;
  return { status, role, at };
}

/**
 * Contenu du foyer pour ce téléphone (rôle) : vide (il l'initialise), envoi
 * de ce rôle à reprendre, ou données communes (déjà là, ou l'autre est en
 * train de les envoyer). Pur.
 */
export function householdContent(mark: MigrationMark | null, role: Role): HouseholdContent {
  if (mark === null) return 'empty';
  if (mark.status === 'running' && mark.role === role) return 'resume';
  return 'shared';
}

/**
 * Lots de l'envoi initial (≤ 450 écritures), sans les documents déjà sur le
 * serveur (`existing` : reprise après coupure). Pur.
 */
export function migrationBatches(
  state: AppState,
  ctx: { now: Date; role: Role; existing: ReadonlySet<DocKey>; newId: () => string },
): WriteOp[][] {
  const ops = migrationOps(state, ctx).filter((op) => !ctx.existing.has(docKey(op.collection, op.id)));
  return planWrites(ops, { view: new Map(), newId: ctx.newId });
}
