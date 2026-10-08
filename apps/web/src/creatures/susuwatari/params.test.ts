import { describe, expect, it } from 'vitest';
import { furGenome } from './fur';
import { DEFAULT_SOOT_PARAMS, cloneParams, normalizeParams, rigOf, spriteKey } from './params';
import { legBend } from './limbs';
import { SOOT_PRESETS, legacy } from './presets';
import { formatParams, parseParams } from './paramsText';

const TAU = Math.PI * 2;
const diff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
};

describe('modèle par défaut (d’après le film)', () => {
  const p = DEFAULT_SOOT_PARAMS;

  it('corps un peu moins noir que les poils, au contour flou', () => {
    expect(p.hair.ink).toBeGreaterThan(p.body.darkness + 0.1);
    expect(p.body.blur).toBeGreaterThan(0.04);
    expect(Math.abs(p.body.ratio - 1)).toBeLessThanOrEqual(0.05);
  });

  it('poils rectilignes, non pointus, longs et variés', () => {
    expect(p.hair.taper).toBe(0);
    expect(p.hair.bend).toBe(0);
    expect(p.hair.cap).toBeGreaterThan(0.5);
    expect(p.hair.lenMax - p.hair.lenMin).toBeGreaterThan(0.2);
    for (let seed = 1; seed <= 4; seed++) {
      const main = furGenome(seed, p).hairs.filter((h) => !h.fine);
      expect(main.length).toBeGreaterThanOrEqual(40);
      expect(main.length).toBeLessThanOrEqual(80);
      for (const h of main) expect(Math.abs(h.bend)).toBe(0);
    }
  });

  it('une partie des poils rentre dans le corps (racine profonde, pointe dehors)', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const g = furGenome(seed, p);
      const over = g.hairs.filter((h) => h.over);
      const main = g.hairs.filter((h) => !h.fine);
      expect(over.length / main.length).toBeGreaterThan(0.3);
      expect(over.length / main.length).toBeLessThan(0.8);
      for (const h of over) {
        expect(Math.hypot(h.x, h.y)).toBeLessThan(p.hair.rootOut - 1e-9);
        expect(Math.hypot(h.x, h.y)).toBeGreaterThanOrEqual(p.hair.inner - 1e-9);
        // La pointe dépasse du disque.
        expect(Math.hypot(h.x + Math.cos(h.dir) * h.len, h.y + Math.sin(h.dir) * h.len)).toBeGreaterThan(1);
      }
      expect(g.hairs.filter((h) => h.fine).every((h) => !h.over)).toBe(true);
    }
  });

  it('tout tient dans le diamètre affiché (pointes et flou compris)', () => {
    for (let seed = 1; seed <= 4; seed++) expect(furGenome(seed, p).reach * p.body.radius).toBeLessThan(1);
  });

  it('les yeux louchent vers le nez, grands et ronds', () => {
    expect(p.eyes.cross).toBeGreaterThan(0.3);
    expect(p.eyes.size).toBeGreaterThan(p.body.radius * 0.3);
    expect(Math.abs(p.eyes.aspect - 1)).toBeLessThan(0.2);
  });

  it('jambes arquées en « ( ) » : en miroir, quel que soit le sens de marche', () => {
    for (const facing of [1, -1] as const) {
      expect(legBend(p, -1, facing)).toBeGreaterThan(0);
      expect(legBend(p, 1, facing)).toBeLessThan(0);
      expect(legBend(p, -1, facing)).toBeCloseTo(-legBend(p, 1, facing));
    }
  });

  it('pieds et mains : trois bouts très fins', () => {
    expect(p.limbs.toes).toBe(3);
    expect(p.limbs.fine).toBeLessThan(0.5);
  });

  it('les anciens modes restent possibles (courbure, longueur, épis)', () => {
    const ronces = furGenome(1, SOOT_PRESETS.ronces);
    expect(ronces.hairs.some((h) => Math.abs(h.bend) > 0.3)).toBe(true);
    const porcEpic = furGenome(1, SOOT_PRESETS.porcEpic);
    expect(Math.max(...porcEpic.hairs.map((h) => h.len))).toBeGreaterThan(0.35);
  });
});

describe('modèles', () => {
  it('« Arthur v1 » : son réglage, dessiné comme avec l’ancien moteur', () => {
    const a = SOOT_PRESETS.arthurV1;
    expect(a.body).toMatchObject({ radius: 0.5, darkness: 0.85, blur: 0 });
    expect(a.hair).toMatchObject({ count: 40, lenMin: 0.575, lenMax: 0.78, tufts: 0.36, taper: 1, over: 0, ink: 0.85 });
    expect(a.eyes).toMatchObject({ size: 0.166, gap: 0.225, cross: 0, ring: 0 });
    expect(a.limbs).toMatchObject({ legs: 0.5, arms: 0.6, mirror: 0, bow: 1, knee: 0.5, toes: 0 });
    expect(a.shadow.opacity).toBe(1.5);
    // Genoux du même côté (vers l'avant), comme avant.
    expect(Math.sign(legBend(a, -1, 1))).toBe(Math.sign(legBend(a, 1, 1)));
    expect(furGenome(1, a).hairs.some((h) => h.over)).toBe(false);
  });

  it('« Film » et « Ancien visé » existent, `legacy` coupe toutes les nouveautés', () => {
    expect(SOOT_PRESETS.film.hair.taper).toBe(0);
    expect(SOOT_PRESETS.film.limbs.mirror).toBe(1);
    expect(SOOT_PRESETS.vise.hair.count).toBe(150);
    const old = legacy(DEFAULT_SOOT_PARAMS);
    expect(old.hair).toMatchObject({ taper: 1, over: 0, ink: DEFAULT_SOOT_PARAMS.body.darkness });
    expect(old.body.blur).toBe(0);
    expect(old.eyes.cross).toBe(0);
    expect(old.limbs).toMatchObject({ mirror: 0, toes: 0 });
  });

  it('un réglage collé d’avant (sans les nouveaux champs) prend leurs valeurs par défaut', () => {
    const text = `export const SOOT_PARAMS: SootSpriteParams = {
      body: { radius: 0.5, ratio: 1, wobble: 0.022, darkness: 0.85, sheen: 0.12 },
      hair: { count: 40, rootOut: 0.825, depth: 0.17, lenMin: 0.575, lenMax: 0.78, jitter: 0.095, width: 0.05, opacity: 1, bend: 0, tufts: 0.36, under: 0.3, fuzz: 0, fuzzLen: 0.9, fuzzAlpha: 0.45, tone: 0.05 },
      eyes: { size: 0.166, aspect: 1.17, gap: 0.225, lift: 0.035, pupil: 0.042, blink: 1, lid: 0.18, turn: 0.1 },
      limbs: { legs: 0.5, arms: 0.6, width: 0.038, feet: 0.042, hands: 0.038, hip: 0.36, shoulder: 0.84 },
    };`;
    const p = parseParams(text)!;
    expect(p.hair.count).toBe(40);
    expect(p.limbs.feet).toBe(0.042);
    expect(p.hair.taper).toBe(DEFAULT_SOOT_PARAMS.hair.taper);
    expect(p.hair.over).toBe(DEFAULT_SOOT_PARAMS.hair.over);
    expect(p.body.blur).toBe(DEFAULT_SOOT_PARAMS.body.blur);
    expect(p.eyes.cross).toBe(DEFAULT_SOOT_PARAMS.eyes.cross);
    expect(p.limbs.toes).toBe(DEFAULT_SOOT_PARAMS.limbs.toes);
    expect(normalizeParams({ limbs: { toes: 2.6 } }).limbs.toes).toBe(3);
  });
});

describe('paramètres ↔ texte', () => {
  it('copier puis coller rend les mêmes paramètres', () => {
    const p = cloneParams(DEFAULT_SOOT_PARAMS);
    p.hair.count = 164;
    p.hair.lenMax = 0.73;
    p.palette.pupil = '#201510';
    const text = formatParams(p);
    expect(text).toContain('export const SOOT_PARAMS: SootSpriteParams = {');
    expect(text).toContain('    count: 164,');
    expect(text).toContain('    taper: 0,');
    expect(parseParams(text)).toEqual(p);
  });

  it('accepte un objet partiel, commenté, en JSON ou en TS', () => {
    const p = parseParams(`// essai
      const x = { hair: { count: 200, /* plus dense */ lenMax: 0.72, }, eyes: { size: 0.17 } } as const;`);
    expect(p?.hair.count).toBe(200);
    expect(p?.hair.lenMax).toBe(0.72);
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
    p.limbs.mirror = 0;
    p.eyes.cross = 0.9;
    p.anim.furSpeed = 2;
    expect(spriteKey(p)).toBe(base);
    p.eyes.ring = 0.2;
    expect(spriteKey(p)).not.toBe(base);
    p.eyes.ring = DEFAULT_SOOT_PARAMS.eyes.ring;
    p.hair.jitter = 0.2;
    expect(spriteKey(p)).not.toBe(base);
    const q = cloneParams(DEFAULT_SOOT_PARAMS);
    q.eyes.size = 0.2;
    expect(spriteKey(q)).not.toBe(base);
  });

  it('le corps posé touche le sol quel que soit son rayon', () => {
    const p = cloneParams(DEFAULT_SOOT_PARAMS);
    for (const radius of [0.5, 0.6, 0.86, 1]) {
      p.body.radius = radius;
      const rig = rigOf(p);
      // Centre au repos ≈ bas du disque (× diamètre).
      expect(Math.abs(rig.rest - (radius * p.body.ratio) / 2)).toBeLessThan(0.02);
    }
  });
});
