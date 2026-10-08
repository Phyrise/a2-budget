/**
 * Rangs d'ordre (V5, synchronisation) : une liste de l'état (tâches,
 * articles, dépenses d'un mois…) devient une collection de documents ; chaque
 * document porte un rang `order` (nombre) et la liste se relit triée par
 * `(order, id)`.
 *
 * - Première écriture (migration) : rangs 0, 1, 2… → aller-retour exact.
 * - Ajout en fin de liste : dernier rang + 1. Deux téléphones qui ajoutent
 *   en même temps obtiennent le même rang : l'id départage, de la même façon
 *   partout.
 * - Insertion au milieu (« Annuler » une suppression) : rang entre les deux
 *   voisins. Les rangs déjà connus sont gardés tant qu'ils restent croissants
 *   (aucune réécriture inutile).
 *
 * Fonctions pures.
 */

/** Un élément rangé (document de liste). */
export interface Ordered {
  id: string;
  order: number;
}

/** Tri stable et identique sur tous les téléphones : rang, puis id. */
export function compareOrdered(x: Ordered, y: Ordered): number {
  if (x.order !== y.order) return x.order < y.order ? -1 : 1;
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}

function isRank(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Rangs pour `ids` (dans l'ordre voulu). `known(id)` donne le rang déjà écrit
 * (ou undefined). Un rang connu est gardé s'il dépasse le dernier rang gardé ;
 * les autres sont placés entre leurs voisins gardés.
 */
export function allocateOrders(
  ids: readonly string[],
  known: (id: string) => number | undefined,
): number[] {
  const out: (number | undefined)[] = new Array(ids.length);
  let last = -Infinity;
  ids.forEach((id, i) => {
    const rank = known(id);
    if (isRank(rank) && rank > last) {
      out[i] = rank;
      last = rank;
    }
  });
  let i = 0;
  while (i < ids.length) {
    if (out[i] !== undefined) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < ids.length && out[j] === undefined) j += 1;
    const lo = i > 0 ? out[i - 1] : undefined;
    const hi = j < ids.length ? out[j] : undefined;
    const count = j - i;
    for (let t = 0; t < count; t += 1) {
      out[i + t] = lo === undefined && hi === undefined ? t
        : lo === undefined ? hi! - count + t
          : hi === undefined ? lo + 1 + t
            : lo + ((hi - lo) * (t + 1)) / (count + 1);
    }
    i = j;
  }
  return out as number[];
}

/** Trie des documents rangés (copie) ; un rang absent compte comme 0. */
export function sortByOrder<T extends { id: string; order?: unknown }>(docs: readonly T[]): T[] {
  return docs.slice().sort((x, y) => compareOrdered(
    { id: x.id, order: isRank(x.order) ? x.order : 0 },
    { id: y.id, order: isRank(y.order) ? y.order : 0 },
  ));
}
