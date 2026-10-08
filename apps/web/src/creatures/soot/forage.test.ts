import { describe, expect, it } from 'vitest';
import { assignForagers, type ForageTreat, type Forager } from './forage';

const treat = (id: number, x: number, y = 0): ForageTreat => ({ id, x, y });
const soot = (id: number, x: number, target: number | null = null, locked = false): Forager => ({ id, x, y: 0, target, locked });

function loads(targets: Map<number, number | null>): Map<number, number> {
  const n = new Map<number, number>();
  for (const t of targets.values()) if (t !== null) n.set(t, (n.get(t) ?? 0) + 1);
  return n;
}

describe('répartition des Noiraudes entre les kompeitō', () => {
  it('5 bonbons, 3 Noiraudes : chacune va au plus proche non réservé, 2 bonbons attendent des renforts', () => {
    const treats = [0, 100, 200, 300, 400].map((x, i) => treat(i + 1, x));
    const r = assignForagers(treats, [soot(1, 10), soot(2, 190), soot(3, 420)]);
    expect(r.targets.get(1)).toBe(1);
    expect(r.targets.get(2)).toBe(3);
    expect(r.targets.get(3)).toBe(5);
    expect(r.unserved.sort()).toEqual([2, 4]);
    expect(r.idle).toEqual([]);
  });

  it('1 bonbon, 6 Noiraudes : 3 au plus le réservent, les 3 autres restent libres', () => {
    const r = assignForagers([treat(7, 0)], [10, 20, 30, 40, 50, 60].map((x, i) => soot(i + 1, x)));
    expect(loads(r.targets).get(7)).toBe(3);
    // Les trois plus proches.
    expect([1, 2, 3].map((id) => r.targets.get(id))).toEqual([7, 7, 7]);
    expect(r.idle.sort()).toEqual([4, 5, 6]);
    expect(r.unserved).toEqual([]);
  });

  it('bonbon retiré pendant la course : ses Noiraudes repartent vers un autre', () => {
    const before = assignForagers([treat(1, 0), treat(2, 300)], [soot(1, 20), soot(2, 280)]);
    expect(before.targets.get(1)).toBe(1);
    // Le bonbon 1 disparaît (mangé, effacé) : la Noiraude 1 vise le 2.
    const after = assignForagers([treat(2, 300)], [soot(1, 20, 1), soot(2, 280, 2)]);
    expect(after.targets.get(1)).toBe(2);
    expect(after.targets.get(2)).toBe(2);
    expect(after.idle).toEqual([]);
  });

  it('garde son bonbon (pas de va-et-vient) et aucun bonbon délaissé tant qu’une autre est « en trop »', () => {
    const r = assignForagers([treat(1, 0), treat(2, 500)], [soot(1, 0, 1), soot(2, 10, 1), soot(3, 20, 1, true)]);
    // La 3e se chamaille (verrouillée) ; une des deux autres part vers le bonbon 2.
    expect(r.targets.get(3)).toBe(1);
    expect(loads(r.targets).get(2)).toBe(1);
    expect(r.unserved).toEqual([]);
  });

  it('plus de bonbon : toutes libres', () => {
    const r = assignForagers([], [soot(1, 0, 4), soot(2, 5)]);
    expect(r.idle.sort()).toEqual([1, 2]);
    expect(r.targets.get(1)).toBeNull();
  });
});
