/**
 * V5.1 — quêtes communes dans le pont (collection `quests`). Tout ce qui leur
 * est propre vit ici, pour garder les autres fichiers du pont presque
 * inchangés (une ligne chacun).
 *
 * Document `households/{hid}/quests/{jour-type}` : `{ id, kind, day, tab,
 * spot, createdBy (rôle), helpers: { a?, b? } (heures ISO), doneAt? }` + les
 * métadonnées habituelles. Règles (firestore.rules, bloc « Quêtes ») :
 * création par un membre (`createdBy` = son rôle, au plus sa propre aide),
 * chacun n'écrit QUE `helpers.<son rôle>`, une fois ; `doneAt` seulement avec
 * les deux aides ; jamais de suppression.
 *
 * Écriture d'un premier toucher : la création part SEULE, sans aide (si
 * l'autre l'a créée au même moment, elle est refusée sans rien emporter),
 * puis l'aide en mise à jour de champ (`helpers.a`) : elle s'ajoute à celle
 * de l'autre quoi qu'il arrive.
 */

import type { AppState, SharedQuest } from '@a2/core';
import { isPlainRecord, stripMeta, type DocData, type FieldWrite, type WriteOp } from './docs';

export const QUESTS = 'quests' as const;

/** Liste de l'état (même référence si rien n'a changé). */
export function questList(state: AppState): readonly SharedQuest[] | undefined {
  return state.quests?.items;
}

/** Écritures d'une quête qui apparaît dans l'état (premier toucher, mode développeur). */
export function questAddedOps(id: string, data: DocData, at: string): WriteOp[] {
  const { helpers, doneAt: _done, ...rest } = data;
  const ops: WriteOp[] = [{ kind: 'create', collection: QUESTS, id, data: { ...rest, helpers: {}, updatedAt: at } }];
  const fields: FieldWrite[] = [];
  if (isPlainRecord(helpers)) for (const [role, time] of Object.entries(helpers)) fields.push([['helpers', role], time]);
  if (fields.length > 0) ops.push({ kind: 'update', collection: QUESTS, id, fields: [...fields, [['updatedAt'], at]] });
  return ops;
}

/** Documents → quêtes (avec `createdBy`, que stripMeta retire des autres collections). */
export function questsFromDocs(rows: readonly { id: string; data: DocData }[]): DocData[] {
  return rows
    .filter((r) => r.data.deletedAt === undefined)
    .map((r) => ({ ...stripMeta(r.data), createdBy: r.data.createdBy }));
}

/**
 * Règles du faux serveur (tests du pont), comme firestore.rules : mise à jour
 * d'une quête = sa propre aide (une fois), `doneAt` avec les deux aides,
 * `updatedAt`/`order`. Renvoie la raison d'un refus, ou null.
 */
export function questUpdateRefusal(current: DocData, fields: readonly FieldWrite[], author: string | undefined): string | null {
  const helpers = isPlainRecord(current.helpers) ? current.helpers : {};
  let both = helpers.a !== undefined && helpers.b !== undefined;
  for (const [path] of fields) {
    const [head, sub] = path;
    if (head === 'updatedAt' || head === 'order') continue;
    if (head === 'helpers' && path.length === 2 && sub !== undefined && sub === author && helpers[sub] === undefined) {
      both = both || helpers[sub === 'a' ? 'b' : 'a'] !== undefined;
      continue;
    }
    if (head === 'doneAt' && path.length === 1 && current.doneAt === undefined) continue;
    return 'quest-not-yours';
  }
  if (fields.some(([path]) => path[0] === 'doneAt') && !both) return 'quest-not-done';
  return null;
}
