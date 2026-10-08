/**
 * Répartition des kompeitō entre les Noiraudes (pur, testé) : chaque bonbon
 * posé doit être ramassé, aucune Noiraude ne reste figée.
 *
 * - Une Noiraude qui a déjà son bonbon le garde (pas de va-et-vient).
 * - Chaque bonbon que personne ne vise reçoit la Noiraude libre la plus
 *   proche (paires les plus proches d'abord) ; s'il n'y en a plus de libre,
 *   une Noiraude en surnombre sur un autre bonbon (2 ou plus) le rejoint.
 * - Les Noiraudes libres restantes rejoignent le bonbon le plus proche qui
 *   en a moins de `max` (chamaillerie) ; au-delà, elles restent libres
 *   (spectatrices).
 * - Bonbons encore sans personne : il faut en faire venir du bord
 *   (`reinforcements`, dans la limite du plafond).
 */

export interface Spot {
  id: number;
  x: number;
  y: number;
}

export interface Eater {
  id: number;
  x: number;
  y: number;
  /** Bonbon visé (null : libre). Un bonbon disparu la rend libre. */
  target: number | null;
}

export interface Share {
  /** Bonbon de chaque Noiraude (null : libre, spectatrice). */
  targets: Map<number, number | null>;
  /** Bonbons que personne ne vise. */
  unclaimed: number[];
}

/** Au plus trois Noiraudes par bonbon. */
export const MAX_PER_CANDY = 3;
/** Plafond de Noiraudes du troupeau à l'écran (celles venues du bord comprises). */
export const HERD_CAP = 8;

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function share(spots: readonly Spot[], eaters: readonly Eater[], max = MAX_PER_CANDY): Share {
  const targets = new Map<number, number | null>();
  const claims = new Map<number, number[]>(spots.map((s) => [s.id, []]));
  const free: Eater[] = [];
  for (const e of eaters) {
    const list = e.target === null ? undefined : claims.get(e.target);
    if (list && list.length < max) {
      list.push(e.id);
      targets.set(e.id, e.target);
    } else free.push(e);
  }
  const byId = new Map(eaters.map((e) => [e.id, e]));
  const assign = (e: Eater, s: Spot) => {
    claims.get(s.id)!.push(e.id);
    targets.set(e.id, s.id);
  };

  // 1. Chaque bonbon que personne ne vise : la Noiraude libre la plus proche.
  const empty = () => spots.filter((s) => claims.get(s.id)!.length === 0);
  const pairs = empty()
    .flatMap((s) => free.map((e) => ({ s, e, k: d2(s, e) })))
    .sort((p, q) => p.k - q.k);
  const taken = new Set<number>();
  for (const { s, e } of pairs) {
    if (taken.has(e.id) || claims.get(s.id)!.length > 0) continue;
    assign(e, s);
    taken.add(e.id);
  }
  const rest = free.filter((e) => !taken.has(e.id));

  // 2. Encore des bonbons sans personne : une Noiraude en surnombre ailleurs vient.
  for (const s of empty()) {
    let best: { e: Eater; from: number; k: number } | null = null;
    for (const [from, ids] of claims) {
      if (ids.length < 2) continue;
      for (const id of ids) {
        const e = byId.get(id);
        const k = e ? d2(s, e) : Infinity;
        if (e && (!best || k < best.k)) best = { e, from, k };
      }
    }
    if (!best) break;
    const list = claims.get(best.from)!;
    list.splice(list.indexOf(best.e.id), 1);
    assign(best.e, s);
  }

  // 3. Les autres libres : le bonbon le plus proche qui a encore de la place.
  for (const e of rest) {
    let best: Spot | null = null;
    for (const s of spots) {
      if (claims.get(s.id)!.length >= max) continue;
      if (!best || d2(s, e) < d2(best, e)) best = s;
    }
    if (best) assign(e, best);
    else targets.set(e.id, null);
  }
  return { targets, unclaimed: empty().map((s) => s.id) };
}

/** Combien en faire venir du bord : un par bonbon sans personne, sans dépasser le plafond. */
export function reinforcements(unclaimed: number, present: number, cap = HERD_CAP): number {
  return Math.max(0, Math.min(unclaimed, cap - present));
}
