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
 * Relancer est sans risque (ids stables, `create` = « créer si absent »).
 * L'envoi par lots de 450 avec reprise viendra avec la migration réelle.
 * Pur.
 */

import { localDateKey, milestonesOf, type AppState, type Role } from '@a2/core';
import {
  clean,
  docKey,
  FACT_COLLECTIONS,
  META_MILESTONES,
  splitDocKey,
  type DocData,
  type DocKey,
  type WriteOp,
} from './docs';
import { entityDocs } from './entities';

/** Documents initiaux (sans métadonnées serveur). */
export function migrationDocs(state: AppState, now: Date): Map<DocKey, DocData> {
  const day = localDateKey(now);
  const docs = entityDocs(state);
  for (const [key, data] of docs) {
    if (splitDocKey(key)[0] === 'completions') docs.set(key, { ...data, imported: true });
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
