import { describe, expect, it } from 'vitest';
import type { BillboardWriter } from './batch';
import { FLIGHT, FLIGHT_STRONG } from './flight';
import { DayLights } from './lights';

const anchors = [{ x: 0.4, y: 0.7, depth: 0.6 }];
const FROM = { x: 0.5, y: 1.0 };

/** Somme des opacités émises (une luciole éteinte n'émet plus rien de visible). */
function glow(lights: DayLights, now: number): number {
  let sum = 0;
  const out: BillboardWriter = {
    push: (_x, _y, _d, _w, _h, _r, _cr, _cg, _cb, a) => {
      sum += a;
    },
  } as BillboardWriter;
  lights.emit(out, now, now, 0, 1, 1);
  return sum;
}

/** Fait tourner le moteur de `from` à `to` (pas de 1/60 s). */
function run(lights: DayLights, from: number, to: number) {
  for (let t = from; t <= to; t += 1 / 60) lights.update(t);
}

describe('tâche annulée : la luciole quitte la forêt', () => {
  it('posée à son ancre : fondu puis supprimée', () => {
    const lights = new DayLights(anchors);
    lights.sync([{ id: 'c1', who: 'a' }], 0, false);
    expect(lights.size).toBe(1);
    lights.sync([], 10, true);
    expect(lights.busy(10)).toBe(true);
    run(lights, 10, 12);
    expect(lights.size).toBe(0);
    expect(glow(lights, 12)).toBe(0);
  });

  it('annulée EN PLEIN VOL : s’éteint en vol, n’atterrit pas, puis disparaît', () => {
    const lights = new DayLights(anchors);
    // Cocher : envol depuis la case, puis l'état (rendu suivant) contient la lumière.
    lights.pulse('c1', 'b', FROM, 10, true);
    lights.sync([{ id: 'c1', who: 'b' }], 10.02, true);
    run(lights, 10, 10.4);
    expect(lights.flying(10.4)).toHaveLength(1);
    const bright = glow(lights, 10.4);
    expect(bright).toBeGreaterThan(0);
    // Annuler pendant le vol (la lumière n'est plus dans l'état).
    lights.sync([], 10.4, true);
    run(lights, 10.4, 11.2);
    expect(glow(lights, 11.2)).toBeLessThan(bright * 0.6);
    run(lights, 11.2, 10 + FLIGHT + 1);
    // Ni éclat ni souffle d'atterrissage (kodama, feuilles) pour une tâche annulée.
    expect(lights.landed).toEqual([]);
    expect(lights.size).toBe(0);
    expect(glow(lights, 10 + FLIGHT + 1)).toBe(0);
  });

  it('annulée juste après l’atterrissage : la lumière posée s’éteint aussi', () => {
    const lights = new DayLights(anchors);
    lights.pulse('c1', 'a', FROM, 10);
    lights.sync([{ id: 'c1', who: 'a' }], 10.02, true);
    run(lights, 10, 10 + FLIGHT + 0.1);
    expect(lights.landed).toHaveLength(1);
    lights.sync([], 12, true);
    run(lights, 12, 14);
    expect(lights.size).toBe(0);
  });

  it('corvée annulée juste après l’atterrissage : éclat et pluie s’éteignent avec elle', () => {
    const land = (cancel: boolean) => {
      const lights = new DayLights(anchors);
      lights.pulse('c1', 'b', FROM, 10, true);
      lights.sync([{ id: 'c1', who: 'b' }], 10.02, true);
      run(lights, 10, 10 + FLIGHT_STRONG + 0.05);
      expect(lights.landed).toHaveLength(1);
      if (cancel) lights.sync([], 10 + FLIGHT_STRONG + 0.05, true);
      return lights;
    };
    const t = 10 + FLIGHT_STRONG + 0.05 + 1.2; // fondu aux trois quarts
    const kept = glow(land(false), t);
    expect(glow(land(true), t)).toBeLessThan(kept * 0.4);
  });

  it('vol réservé (feuille) puis annulé avant l’envol : le pulse ne crée aucune lumière', () => {
    const lights = new DayLights(anchors);
    lights.reserve('c1', 12.5);
    lights.sync([{ id: 'c1', who: 'a' }], 10, true);
    lights.sync([], 10.2, true); // annulé
    expect(lights.isReserved('c1', 10.2)).toBe(false);
    lights.pulse('c1', 'a', FROM, 10.4);
    expect(lights.size).toBe(0);
    expect(lights.flying(10.4)).toEqual([]);
    // L'annulation ne vaut qu'une fois : un autre envol du même id partirait.
    lights.pulse('c1', 'a', FROM, 11);
    expect(lights.size).toBe(1);
  });

  it('vol réservé (feuille) : la luciole posée reste allumée, puis s’éteint à l’annulation, même forêt figée', () => {
    const lights = new DayLights(anchors);
    lights.reserve('c1', 12.5);
    lights.sync([{ id: 'c1', who: 'a' }], 10, true);
    lights.pulse('c1', 'a', FROM, 10.3);
    run(lights, 10.3, 10.3 + FLIGHT + 8);
    // Elle est dans l'état : pas d'extinction « orpheline » après l'atterrissage.
    expect(lights.size).toBe(1);
    // Annulée alors que la forêt est figée (pas d'animation) : retirée à l'image suivante.
    lights.sync([], 30, false);
    lights.update(30);
    expect(lights.size).toBe(0);
  });

  it('vol réservé jamais vu dans l’état : rien n’est annulé (rendu pas encore poussé)', () => {
    const lights = new DayLights(anchors);
    lights.reserve('c1', 12.5);
    lights.sync([{ id: 'c0', who: 'b' }], 10, true);
    lights.pulse('c1', 'a', FROM, 10.2);
    expect(lights.flying(10.2)).toHaveLength(1);
  });

  it('les autres lumières du jour restent allumées', () => {
    const lights = new DayLights(anchors);
    lights.sync([{ id: 'c0', who: 'a' }, { id: 'c1', who: 'b' }], 0, false);
    lights.sync([{ id: 'c0', who: 'a' }], 5, true);
    run(lights, 5, 8);
    expect(lights.size).toBe(1);
  });

  it('fondu en cours signalé (scène figée : le moteur dessine jusqu’à la suppression)', () => {
    const lights = new DayLights(anchors);
    lights.sync([{ id: 'c1', who: 'a' }], 0, false);
    expect(lights.fading).toBe(false);
    lights.sync([], 10, true);
    expect(lights.fading).toBe(true);
    lights.update(10 + 5);
    expect(lights.fading).toBe(false);
  });
});
