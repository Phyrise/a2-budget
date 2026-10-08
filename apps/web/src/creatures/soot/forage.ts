/**
 * Répartition des Noiraudes entre les kompeitō au sol (règle pure, testée) :
 * chaque bonbon est « réservé » par 1 à `max` Noiraudes (3 par défaut).
 *
 * 1. Celles qui ont déjà un bonbon (encore là) le gardent : pas de
 *    va-et-vient, et celles qui se chamaillent (`locked`) ne bougent plus.
 * 2. Les libres vont, par niveaux, vers le bonbon le moins servi : d'abord
 *    ceux qui n'ont personne (la paire Noiraude-bonbon la plus proche
 *    d'abord), puis ceux qui en ont une, puis deux… jusqu'à `max`.
 * 3. S'il reste un bonbon sans personne alors qu'un autre en a plusieurs,
 *    la plus proche des « en trop » (non verrouillée) change de bonbon.
 * `unserved` : les bonbons que personne ne vise (des Noiraudes arrivent
 * alors par le bord, voir herd.ts) ; `idle` : les Noiraudes sans bonbon.
 */

export interface ForageTreat {
  id: number;
  x: number;
  y: number;
}

export interface Forager {
  id: number;
  x: number;
  y: number;
  /** Bonbon visé jusqu'ici (null : libre). */
  target: number | null;
  /** Se chamaille déjà sur son bonbon : ne change plus. */
  locked?: boolean;
}

export interface Assignment {
  /** Noiraude → bonbon visé (null : aucun). */
  targets: Map<number, number | null>;
  unserved: number[];
  idle: number[];
}

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function assignForagers(treats: readonly ForageTreat[], foragers: readonly Forager[], max = 3): Assignment {
  const byId = new Map(treats.map((t) => [t.id, t]));
  const load = new Map<number, number[]>(treats.map((t) => [t.id, []]));
  const targets = new Map<number, number | null>();
  const free: Forager[] = [];

  // 1. Garder son bonbon (s'il existe encore et n'est pas déjà plein).
  const keep = [...foragers].sort((a, b) => Number(b.locked ?? false) - Number(a.locked ?? false));
  for (const f of keep) {
    const list = f.target === null ? undefined : load.get(f.target);
    if (list && (list.length < max || f.locked)) {
      list.push(f.id);
      targets.set(f.id, f.target);
    } else free.push(f);
  }

  // 2. Les libres, par niveaux : le bonbon le moins servi, le plus proche.
  for (let level = 0; level < max && free.length > 0; level++) {
    for (;;) {
      let best: { f: Forager; t: ForageTreat; k: number } | null = null;
      for (const t of treats) {
        if (load.get(t.id)!.length !== level) continue;
        for (const f of free) {
          const k = d2(f, t);
          if (!best || k < best.k) best = { f, t, k };
        }
      }
      if (!best) break;
      load.get(best.t.id)!.push(best.f.id);
      targets.set(best.f.id, best.t.id);
      free.splice(free.indexOf(best.f), 1);
      if (free.length === 0) break;
    }
  }

  // 3. Un bonbon délaissé : une Noiraude « en trop » ailleurs y va.
  const where = new Map(foragers.map((f) => [f.id, f]));
  for (const t of treats) {
    if (load.get(t.id)!.length > 0) continue;
    let best: { id: number; from: number; k: number } | null = null;
    for (const [from, list] of load) {
      if (list.length < 2) continue;
      for (const id of list) {
        const f = where.get(id)!;
        if (f.locked) continue;
        const k = d2(f, t);
        if (!best || k < best.k) best = { id, from, k };
      }
    }
    if (!best) continue;
    const list = load.get(best.from)!;
    list.splice(list.indexOf(best.id), 1);
    load.get(t.id)!.push(best.id);
    targets.set(best.id, t.id);
  }

  for (const f of free) targets.set(f.id, null);
  return {
    targets,
    unserved: treats.filter((t) => load.get(t.id)!.length === 0 && byId.has(t.id)).map((t) => t.id),
    idle: free.map((f) => f.id),
  };
}
