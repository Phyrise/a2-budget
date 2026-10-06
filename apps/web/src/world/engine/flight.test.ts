import { describe, expect, it } from 'vitest';
import { FLIGHT, FLIGHT_STRONG, bezierAt, flightAt, flightEase, makeFlight, pulseOrigin } from './flight';
import { computeFraming, viewToScene } from './framing';

/** Héros mobile 390×844 : canvas de 528 px, feuille opaque à partir de 456 px. */
const VIEW = { w: 390, h: 528 };
const SHEET = { left: 0, top: 456, width: 390 };

describe('pulseOrigin (non-régression V4 : la lumière ne part plus sous la feuille)', () => {
  it('ramène une case cochée sous la feuille au bord visible de la feuille, à son aplomb', () => {
    const o = pulseOrigin(VIEW, { x: 60, y: 700 }, SHEET);
    expect(o.x).toBe(60);
    expect(o.y).toBeLessThanOrEqual(SHEET.top + 20);
    expect(o.y).toBeGreaterThan(SHEET.top);
  });

  it('feuille remontée (liste défilée) : départ juste sous son bord, toujours dans la vue', () => {
    const o = pulseOrigin(VIEW, { x: 200, y: 600 }, { left: 0, top: 136, width: 390 });
    expect(o.y).toBeGreaterThan(136);
    expect(o.y).toBeLessThan(160);
  });

  it('carnet posé à droite (ordinateur) : départ au bord gauche du carnet', () => {
    const o = pulseOrigin({ w: 1440, h: 900 }, { x: 1200, y: 500 }, { left: 900, top: 0, width: 540 });
    expect(o.x).toBeLessThan(900);
    expect(o.y).toBe(500);
  });

  it('sans feuille : le point est seulement ramené dans la vue', () => {
    expect(pulseOrigin(VIEW, { x: -40, y: 300 }, null)).toEqual({ x: 0, y: 300 });
    expect(pulseOrigin(VIEW, { x: 100, y: 2000 }, null).y).toBeLessThanOrEqual(VIEW.h + 20);
  });
});

describe('makeFlight / flightAt', () => {
  const framing = computeFraming(VIEW.w, VIEW.h, 1024, 1536);
  const start = viewToScene(framing, 80, SHEET.top + 18);
  const anchor = { x: 0.62, y: 0.6 };
  const sheetTopScene = viewToScene(framing, 0, SHEET.top).y;

  it('part du point de départ et se pose exactement sur l’ancre', () => {
    const f = makeFlight(start, anchor, 1, 10, false);
    expect(flightAt(f, 10)).toMatchObject({ x: start.x, y: start.y, k: 0 });
    const end = flightAt(f, 10 + FLIGHT);
    expect(end.x).toBeCloseTo(anchor.x, 6);
    expect(end.y).toBeCloseTo(anchor.y, 6);
    expect(end.k).toBeCloseTo(1, 9);
  });

  it('monte franchement : la tête est au-dessus de la feuille pendant presque tout le vol', () => {
    const f = makeFlight(start, anchor, -1, 0, false);
    const above = Array.from({ length: 20 }, (_, i) => flightAt(f, ((i + 1) / 21) * FLIGHT)).filter((p) => p.y < sheetTopScene);
    expect(above.length).toBeGreaterThanOrEqual(19);
  });

  it('passe au-dessus de l’ancre avant de s’y poser (arc), plus haut et plus long si fort', () => {
    const soft = makeFlight(start, anchor, 1, 0, false);
    const strong = makeFlight(start, anchor, 1, 0, true);
    const top = (f: typeof soft) => Math.min(...Array.from({ length: 50 }, (_, i) => bezierAt(f, i / 49).y));
    expect(top(soft)).toBeLessThan(anchor.y - 0.05);
    expect(top(strong)).toBeLessThan(top(soft));
    expect(strong.dur).toBe(FLIGHT_STRONG);
  });

  it('horloge : départ vif, arrivée douce, bornée', () => {
    expect(flightEase(0)).toBe(0);
    expect(flightEase(1)).toBe(1);
    expect(flightEase(2)).toBe(1);
    expect(flightEase(-1)).toBe(0);
    expect(flightEase(0.2)).toBeGreaterThan(0.3);
    expect(1 - flightEase(0.98)).toBeLessThan(0.001);
  });
});
