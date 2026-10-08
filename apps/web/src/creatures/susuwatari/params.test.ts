import { describe, expect, it } from 'vitest';
import { furGenome } from './fur';
import { DEFAULT_SOOT_PARAMS, cloneParams, normalizeParams, rigOf, spriteKey } from './params';
import { SOOT_PRESETS } from './presets';
import { formatParams, parseParams } from './paramsText';

const TAU = Math.PI * 2;
const diff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
};

describe('modèle visé (preset par défaut)', () => {
  const p = DEFAULT_SOOT_PARAMS;

  it('un disque presque rond, très sombre', () => {
    expect(Math.abs(p.body.ratio - 1)).toBeLessThanOrEqual(0.05);
    expect(p.body.darkness).toBeGreaterThan(0.9);
    expect(p.body.wobble).toBeGreaterThan(0);
    expect(p.body.wobble).toBeLessThan(0.05);
  });

  it('120–180 poils courts quasi droits, enracinés sous le bord, vers l’extérieur', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const g = furGenome(seed, p);
      const main = g.hairs.filter((h) => !h.fine);
      expect(main.length).toBeGreaterThanOrEqual(120);
      expect(main.length).toBeLessThanOrEqual(180);
      for (const h of main) {
        // Racine : 0,88–0,98 du contour (à l'angle de la racine).
        const a = Math.atan2(h.y / p.body.ratio, h.x);
        const e = g.edge(a);
        const r0 = Math.hypot(h.x, h.y) / Math.hypot(e.x, e.y);
        expect(r0).toBeGreaterThanOrEqual(0.88 - 1e-9);
        expect(r0).toBeLessThanOrEqual(0.98 + 1e-9);
        // Direction : la normale au contour, ± 0,08 rad.
        const normal = Math.atan2(Math.sin(a), p.body.ratio * Math.cos(a));
        expect(Math.abs(diff(h.dir, normal))).toBeLessThanOrEqual(0.08 + 1e-9);
        expect(h.len).toBeGreaterThanOrEqual(0.1 - 1e-9);
        expect(h.len).toBeLessThanOrEqual(0.2 + 1e-9);
        expect(Math.abs(h.bend)).toBe(0);
      }
    }
  });

  it('aucun poil (duvet et frisottis compris) ne dépasse 0,25 Rd', () => {
    const g = furGenome(2, p);
    const grow = 1 + 0.05 * p.anim.wave;
    for (const h of g.hairs) expect(h.len * grow).toBeLessThanOrEqual(0.25);
    // Le halo reste un détail : les pointes ne vont pas au-delà de 1,25 Rd.
    expect(g.reach).toBeLessThan(1.28);
  });

  it('yeux 5–10 % plus petits que l’ancien rendu, membres 20–30 % plus courts', () => {
    expect(p.eyes.size / 0.195).toBeGreaterThanOrEqual(0.9);
    expect(p.eyes.size / 0.195).toBeLessThanOrEqual(0.95);
    expect(p.limbs.legs / 0.4).toBeGreaterThanOrEqual(0.7);
    expect(p.limbs.legs / 0.4).toBeLessThanOrEqual(0.8);
    expect(p.limbs.arms / 0.48).toBeGreaterThanOrEqual(0.7);
    expect(p.limbs.arms / 0.48).toBeLessThanOrEqual(0.8);
  });

  it('les anciens modes restent possibles (courbure, longueur, épis)', () => {
    const ronces = furGenome(1, SOOT_PRESETS.ronces);
    expect(ronces.hairs.some((h) => Math.abs(h.bend) > 0.3)).toBe(true);
    const porcEpic = furGenome(1, SOOT_PRESETS.porcEpic);
    expect(Math.max(...porcEpic.hairs.map((h) => h.len))).toBeGreaterThan(0.35);
  });
});

describe('paramètres ↔ texte', () => {
  it('copier puis coller rend les mêmes paramètres', () => {
    const p = cloneParams(DEFAULT_SOOT_PARAMS);
    p.hair.count = 164;
    p.hair.lenMax = 0.23;
    p.palette.pupil = '#201510';
    const text = formatParams(p);
    expect(text).toContain('export const SOOT_PARAMS: SootSpriteParams = {');
    expect(text).toContain('    count: 164,');
    expect(parseParams(text)).toEqual(p);
  });

  it('accepte un objet partiel, commenté, en JSON ou en TS', () => {
    const p = parseParams(`// essai
      const x = { hair: { count: 200, /* plus dense */ lenMax: 0.22, }, eyes: { size: 0.17 } } as const;`);
    expect(p?.hair.count).toBe(200);
    expect(p?.hair.lenMax).toBe(0.22);
    expect(p?.eyes.size).toBe(0.17);
    expect(p?.body).toEqual(DEFAULT_SOOT_PARAMS.body);
    expect(parseParams('{"body": {"radius": 0.9}}')?.body.radius).toBe(0.9);
  });

  it('refuse un texte sans paramètres, borne les valeurs dangereuses', () => {
    expect(parseParams('bonjour')).toBeNull();
    expect(parseParams('{ foo: 1 }')).toBeNull();
    expect(normalizeParams({ hair: { count: 1e7, lenMin: 0.3, lenMax: 0.1 } }).hair).toMatchObject({ count: 2000, lenMin: 0.1, lenMax: 0.3 });
    expect(normalizeParams({ body: { radius: 'grand' } }).body.radius).toBe(DEFAULT_SOOT_PARAMS.body.radius);
  });
});

describe('clé des sprites', () => {
  it('change avec le corps, les poils ou les yeux, pas avec les membres ni le tempo', () => {
    const base = spriteKey(DEFAULT_SOOT_PARAMS);
    const p = cloneParams(DEFAULT_SOOT_PARAMS);
    p.limbs.legs = 0.2;
    p.anim.furSpeed = 2;
    expect(spriteKey(p)).toBe(base);
    p.hair.jitter = 0.2;
    expect(spriteKey(p)).not.toBe(base);
    const q = cloneParams(DEFAULT_SOOT_PARAMS);
    q.eyes.size = 0.2;
    expect(spriteKey(q)).not.toBe(base);
  });

  it('le corps posé touche le sol quel que soit son rayon', () => {
    const p = cloneParams(DEFAULT_SOOT_PARAMS);
    for (const radius of [0.6, 0.86, 1]) {
      p.body.radius = radius;
      const rig = rigOf(p);
      // Centre au repos ≈ bas du disque (× diamètre).
      expect(Math.abs(rig.rest - (radius * p.body.ratio) / 2)).toBeLessThan(0.02);
    }
  });
});
