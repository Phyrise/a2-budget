import { describe, expect, it } from 'vitest';
import { computeFraming } from './framing';
import { DEFAULT_RIG, imitators, kodamaAt, PARALLAX_PIVOT, RATTLE_S, rattlePose, rattling, rigFor, TOUCH_RADIUS, touchZone, type TouchTarget } from './karakara';
import { Spirits, type SpriteAsset } from './spirits';

const W = 1024;
const H = 1536;
const ASPECT = W / H;
const phone = computeFraming(390, 528, W, H);

const kodama = (x: number, y: number, depth = 0.2, vis = 1): TouchTarget => ({ x, y, depth, h: 0.05, aspect: 0.9, pivot: [0.5, 0.35], vis });

describe('gréement des têtes', () => {
  it('reconnaît chaque peinture (URL de dev ou de build), repli sinon', () => {
    expect(rigFor('/a2-budget/src/world/assets/sprites/kodama-7.webp').radius[0]).toBeGreaterThan(0.3);
    expect(rigFor('/a2-budget/assets/kodama-1-Ab12Cd.webp')).not.toBe(DEFAULT_RIG);
    expect(rigFor('/lab/kodama-sheet.png')).toBe(DEFAULT_RIG);
  });

  it('le cou est sous le centre de la tête, dans le sprite', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = rigFor(`kodama-${n}.webp`);
      expect(r.pivot[1]).toBeGreaterThan(r.center[1]);
      for (const v of [...r.center, ...r.pivot]) expect(v).toBeGreaterThan(0), expect(v).toBeLessThan(1);
    }
  });
});

describe('secousse', () => {
  it('oscille vivement puis s’éteint, rien avant ni après', () => {
    const r = { at: 10, amp: 0.3 };
    expect(rattlePose(r, 9.9)).toBeNull();
    expect(rattlePose(r, 10 + RATTLE_S + 0.01)).toBeNull();
    const angles = Array.from({ length: 40 }, (_, i) => rattlePose(r, 10 + (i / 40) * RATTLE_S)!.angle);
    const signChanges = angles.slice(1).filter((a, i) => Math.sign(a) !== Math.sign(angles[i]!)).length;
    expect(signChanges).toBeGreaterThanOrEqual(10);
    expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(0.3);
    expect(Math.abs(rattlePose(r, 10 + RATTLE_S * 0.95)!.angle)).toBeLessThan(0.02);
  });

  it('anti-rafale : une tête qui claque (ou va claquer) ne repart pas', () => {
    expect(rattling({ at: 10, amp: 0.3 }, 10.5)).toBe(true);
    expect(rattling({ at: 11, amp: 0.3 }, 10.5)).toBe(true);
    expect(rattling({ at: 10, amp: 0.3 }, 10 + RATTLE_S)).toBe(false);
    expect(rattling(null, 3)).toBe(false);
  });

  it('les voisins visibles imitent, du plus proche au plus loin, avec un décalage', () => {
    const spots = [{ x: 0.3, y: 0.5 }, { x: 0.35, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.5, y: 0.5 }];
    const echo = imitators(spots, 0, (i) => i !== 3);
    expect(echo.map((e) => e.index)).toEqual([1, 2]);
    expect(echo[0]!.delay).toBeGreaterThan(0.2);
    expect(echo[1]!.delay).toBeGreaterThan(echo[0]!.delay);
    expect(echo[1]!.amp).toBeLessThan(echo[0]!.amp);
  });
});

describe('test de toucher', () => {
  it('touche le cou d’un kodama visible, pas un kodama caché ni le vide', () => {
    const t = kodama(0.5, 0.45);
    const z = touchZone(phone, [0, 0], ASPECT, t);
    expect(kodamaAt(phone, [0, 0], ASPECT, [t], z.x, z.y)).toBe(0);
    expect(kodamaAt(phone, [0, 0], ASPECT, [t], z.x + z.r * 0.9, z.y)).toBe(0);
    expect(kodamaAt(phone, [0, 0], ASPECT, [t], z.x + z.r * 1.2, z.y)).toBe(-1);
    expect(kodamaAt(phone, [0, 0], ASPECT, [{ ...t, vis: 0.1 }], z.x, z.y)).toBe(-1);
    expect(z.r).toBeGreaterThanOrEqual(TOUCH_RADIUS);
  });

  it('suit la parallaxe selon la profondeur', () => {
    const par: [number, number] = [0.01, 0.006];
    const near = kodama(0.5, 0.45, 0.9);
    const still = touchZone(phone, [0, 0], ASPECT, near);
    const moved = touchZone(phone, par, ASPECT, near);
    const dx = ((par[0] * (near.depth - PARALLAX_PIVOT)) / phone.vw) * phone.w;
    expect(moved.x - still.x).toBeCloseTo(dx, 5);
    // Au pivot de la parallaxe, rien ne bouge.
    const pivot = kodama(0.5, 0.45, PARALLAX_PIVOT);
    expect(touchZone(phone, par, ASPECT, pivot).x).toBeCloseTo(touchZone(phone, [0, 0], ASPECT, pivot).x, 6);
  });

  it('suit le cadrage : la même scène, deux écrans', () => {
    const t = kodama(0.36, 0.49);
    const desk = computeFraming(1400, 900, W, H, { minVisibleH: 0.74 });
    for (const f of [phone, desk]) {
      const z = touchZone(f, [0, 0], ASPECT, t);
      expect(kodamaAt(f, [0, 0], ASPECT, [null, t], z.x, z.y)).toBe(1);
    }
  });

  it('deux kodama proches : le plus proche du doigt', () => {
    const a = kodama(0.5, 0.45);
    const b = kodama(0.53, 0.45);
    const zb = touchZone(phone, [0, 0], ASPECT, b);
    expect(kodamaAt(phone, [0, 0], ASPECT, [a, b], zb.x, zb.y)).toBe(1);
  });
});

describe('Spirits.rattle', () => {
  const asset = { tex: {}, rect: [0, 0, 1, 1], aspect: 0.9, head: DEFAULT_RIG } as unknown as SpriteAsset;
  const spots = [
    { x: 0.3, y: 0.5, depth: 0.2 },
    { x: 0.36, y: 0.5, depth: 0.2 },
    { x: 0.8, y: 0.5, depth: 0.2 },
  ];
  const awake = () => {
    const s = new Spirits(spots, {}, { x: 0.5, y: 0.5, depth: 0.1 });
    s.kodama = [asset];
    s.update(0, 0, spots.length, [], false);
    return s;
  };
  const heads = (s: Spirits, t: number) => s.draws(t, 0, 0, { active: false, reveal: 0, fogGlow: 0, windScale: 1, burst: 0, breathe: 0 }).map((d) => d.head?.angle ?? 0);

  it('le touché secoue, ses voisins suivent un peu plus tard', () => {
    const s = awake();
    expect(s.rattle(0, 1, 0.3)).toBe(true);
    const early = heads(s, 1.1);
    expect(early[0]).not.toBe(0);
    expect(early[1]).toBe(0);
    expect(heads(s, 1.75)[1]).not.toBe(0);
    expect(s.busy(1.5)).toBe(true);
  });

  it('anti-rafale : retoucher pendant la secousse ne relance rien', () => {
    const s = awake();
    expect(s.rattle(0, 1, 0.3)).toBe(true);
    expect(s.rattle(0, 1.4, 0.3)).toBe(false);
    expect(s.rattle(0, 1 + RATTLE_S, 0.3)).toBe(true);
  });

  it('seul et sans voisin visible : le plus proche sort pour répondre', () => {
    const s = awake();
    s.update(0, 0, 1, [], false);
    expect(s.visibility(1)).toBe(0);
    s.rattle(0, 1, 0.3);
    s.update(2, 0, 1, [], false);
    expect(s.visibility(1)).toBe(1);
  });
});
