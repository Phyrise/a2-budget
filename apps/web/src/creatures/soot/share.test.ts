import { describe, expect, it } from 'vitest';
import { HERD_CAP, MAX_PER_CANDY, reinforcements, share, type Eater, type Spot } from './share';

const spot = (id: number, x: number, y = 0): Spot => ({ id, x, y });
const eater = (id: number, x: number, target: number | null = null): Eater => ({ id, x, y: 0, target });

/** Combien de Noiraudes visent chaque bonbon. */
function load(targets: Map<number, number | null>): Map<number, number> {
  const n = new Map<number, number>();
  for (const t of targets.values()) if (t !== null) n.set(t, (n.get(t) ?? 0) + 1);
  return n;
}

describe('répartition des kompeitō', () => {
  it('5 bonbons, 3 Noiraudes : chacune le sien (le plus proche), deux à faire venir du bord', () => {
    const spots = [spot(1, 0), spot(2, 100), spot(3, 200), spot(4, 300), spot(5, 400)];
    const eaters = [eater(10, 95), eater(11, 310), eater(12, 20)];
    const { targets, unclaimed } = share(spots, eaters);
    expect(targets.get(10)).toBe(2);
    expect(targets.get(11)).toBe(4);
    expect(targets.get(12)).toBe(1);
    expect(unclaimed.sort()).toEqual([3, 5]);
    expect(reinforcements(unclaimed.length, eaters.length)).toBe(2);
  });

  it('1 bonbon, 6 Noiraudes : trois au plus se le disputent, les autres restent libres', () => {
    const eaters = [0, 10, 20, 30, 40, 50].map((x, i) => eater(i, x));
    const { targets, unclaimed } = share([spot(1, 0)], eaters);
    expect(load(targets).get(1)).toBe(MAX_PER_CANDY);
    // Les plus proches y vont.
    expect([0, 1, 2].map((id) => targets.get(id))).toEqual([1, 1, 1]);
    expect([3, 4, 5].map((id) => targets.get(id))).toEqual([null, null, null]);
    expect(unclaimed).toEqual([]);
  });

  it('bonbon retiré pendant la course : ses Noiraudes repartent vers les autres', () => {
    const spots = [spot(1, 0), spot(2, 200)];
    const first = share(spots, [eater(10, 10), eater(11, 20), eater(12, 190)]);
    expect(first.targets.get(10)).toBe(1);
    expect(first.targets.get(12)).toBe(2);
    // Le bonbon 1 disparaît (ramassé, effacé) : personne ne reste sans but.
    const eaters = [eater(10, 60, first.targets.get(10)!), eater(11, 70, first.targets.get(11)!), eater(12, 195, 2)];
    const after = share([spot(2, 200)], eaters);
    expect([...after.targets.values()]).toEqual([2, 2, 2]);
    expect(after.unclaimed).toEqual([]);
  });

  it('une Noiraude garde son bonbon ; un bonbon délaissé prend une Noiraude en surnombre', () => {
    const spots = [spot(1, 0), spot(2, 300)];
    const eaters = [eater(10, 5, 1), eater(11, 8, 1), eater(12, 250, 1)];
    const { targets, unclaimed } = share(spots, eaters);
    expect(targets.get(10)).toBe(1);
    expect(targets.get(11)).toBe(1);
    expect(targets.get(12)).toBe(2);
    expect(unclaimed).toEqual([]);
  });

  it('plafond : jamais plus de HERD_CAP Noiraudes du troupeau', () => {
    expect(reinforcements(5, HERD_CAP - 2)).toBe(2);
    expect(reinforcements(3, HERD_CAP)).toBe(0);
    expect(reinforcements(0, 0)).toBe(0);
  });

  it('sans bonbon, toutes libres', () => {
    const { targets, unclaimed } = share([], [eater(1, 0, 4)]);
    expect(targets.get(1)).toBeNull();
    expect(unclaimed).toEqual([]);
  });
});
