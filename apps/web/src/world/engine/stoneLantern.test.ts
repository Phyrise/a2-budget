import { describe, expect, it } from 'vitest';
import type { Texture } from 'ogl';
import { StoneLantern, type LanternArtSource } from './stoneLantern';
import type { SpriteAsset } from './spirits';
import { VISIT } from './toro';

const shape = { aspect: 0.7, scale: 0.9, fire: { x: 0.5, y: 0.4 }, roof: { x: 0.65, y: 0.15 } };
const SRC: LanternArtSource = {
  art: {
    'kasuga-moss': { ...shape, unlit: 'k-unlit', lit: 'k-lit' },
    yukimi: { ...shape, aspect: 1.06, unlit: 'y-unlit', lit: 'y-lit' },
  },
  kodama: [{ src: 'kd-sit', seat: 0.7 }, { src: 'kd-pair', seat: 0.74 }],
};

function setup(fail = new Set<string>()) {
  const loaded: string[] = [];
  const freed: string[] = [];
  const load = async (url: string): Promise<SpriteAsset | null> => {
    loaded.push(url);
    if (fail.has(url)) return null;
    return { tex: { url } as unknown as Texture, rect: [0, 0, 1, 1], aspect: 0.7, px: url.startsWith('kd') ? 200 : 400 };
  };
  const free = (t: Texture) => freed.push((t as unknown as { url: string }).url);
  const stone = new StoneLantern(SRC, load, free, 1024 / 1536);
  return { stone, loaded, freed };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('StoneLantern : modèle posé', () => {
  it('charge seulement le modèle demandé ; inconnu ou absent → kasuga-moss', async () => {
    const { stone, loaded } = setup();
    expect(await stone.want(undefined, () => 1)).toBe(true);
    expect(stone.model?.id).toBe('kasuga-moss');
    expect(await stone.want('pas-une-lanterne', () => 2)).toBe(false);
    expect(loaded).toEqual(['k-unlit', 'k-lit']);
  });

  it('deux demandes identiques partagent le même chargement', async () => {
    const { stone, loaded } = setup();
    const [a, b] = await Promise.all([stone.want('yukimi', () => 1), stone.want('yukimi', () => 1)]);
    expect([a, b]).toEqual([true, false]);
    expect(loaded).toEqual(['y-unlit', 'y-lit']);
  });

  it('changement : l’ancien s’efface puis ses textures sont libérées', async () => {
    const { stone, freed } = setup();
    await stone.want('kasuga-moss', () => 0);
    await stone.want('yukimi', () => 10);
    const mid = stone.draws(10.5, 0, 0, 0, 0, true);
    expect(mid.map((d) => (d.asset.tex as unknown as { url: string }).url)).toEqual(['k-unlit', 'y-unlit']);
    expect(mid[1]!.reveal).toBeLessThan(1);
    stone.draws(12, 0, 0, 0, 0, true);
    expect(freed).toEqual(['k-unlit', 'k-lit']);
  });

  it('échec de chargement : aucun modèle (le moteur garde la lanterne de papier)', async () => {
    const { stone, freed } = setup(new Set(['k-lit']));
    expect(await stone.want('kasuga-moss', () => 0)).toBe(false);
    expect(stone.model).toBeNull();
    expect(freed).toEqual(['k-unlit']);
  });

  it('allumée : la peinture allumée se superpose à l’éteinte, au même endroit', async () => {
    const { stone } = setup();
    await stone.want('kasuga-moss', () => 0);
    expect(stone.draws(5, 0, 0, 0, 0, true)).toHaveLength(1);
    const [unlit, lit] = stone.draws(5, 0, 0.7, 0, 0, true);
    expect(lit!.alpha).toBeCloseTo(0.7);
    expect([lit!.x, lit!.y, lit!.h]).toEqual([unlit!.x, unlit!.y, unlit!.h]);
  });
});

describe('StoneLantern : kodama en visite', () => {
  async function ready() {
    const s = setup();
    await s.stone.want('kasuga-moss', () => 0);
    return s.stone;
  }

  it('un kodama vient s’asseoir après une attente douce, sur le toit', async () => {
    const stone = await ready();
    stone.update(0, true, false);
    stone.update(VISIT.first[1] + 0.1, true, false); // déclenche le chargement des kodama
    await flush();
    stone.update(VISIT.first[1] + 0.2, true, false);
    const sprites = stone.draws(VISIT.first[1] + 5, 0, 0, 0, 0, true);
    expect(sprites).toHaveLength(2);
    expect(sprites[1]!.y).toBeLessThan(sprites[0]!.y);
  });

  it('jamais en mouvement « immobile » ni pendant la floraison, qui le fait repartir', async () => {
    const stone = await ready();
    stone.update(0, false, false);
    for (let t = 1; t < 60; t += 0.5) stone.update(t, false, false);
    await flush();
    expect(stone.draws(60, 0, 0, 0, 0, false)).toHaveLength(1);
    for (let t = 60; t < 120; t += 0.5) stone.update(t, true, true);
    expect(stone.draws(120, 0, 0, 0, 0, true)).toHaveLength(1);
    stone.visitNow(130);
    await flush();
    stone.update(131, true, false);
    expect(stone.draws(131, 0, 0, 0, 0, true)).toHaveLength(2);
    stone.update(132, true, true);
    expect(stone.draws(132 + VISIT.fade + 0.05, 0, 0, 0, 0, true)).toHaveLength(1);
  });

  it('la nuit, des lucioles tournent autour de la pierre ; le jour, aucune', async () => {
    const stone = await ready();
    const pushed: number[] = [];
    const out = { push: (...a: number[]) => void pushed.push(a[9]!) } as unknown as Parameters<StoneLantern['emitNight']>[0];
    stone.emitNight(out, 3, 0);
    expect(pushed).toHaveLength(0);
    stone.emitNight(out, 3, 1);
    expect(pushed.length).toBeGreaterThan(3);
    expect(Math.min(...pushed)).toBeGreaterThan(0);
  });
});
