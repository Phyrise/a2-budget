import { describe, expect, it } from 'vitest';
import { allSeasonAssets, isSeasonFile, planSeasonPrefetch } from './seasonAssets';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0);

/** Nom logique d'une URL (chemin source en test) : « season-winter-stage-3 ». */
const names = (urls: string[]) => urls.map((u) => (u.split('/').pop() ?? '').replace(/\.(?:webp|png)$/, ''));

describe('isSeasonFile', () => {
  it('reconnaît les fichiers « season-… », source ou build', () => {
    expect(isSeasonFile('/src/world/assets/seasons/winter/season-winter-stage-1.webp')).toBe(true);
    expect(isSeasonFile('/a2-budget/assets/season-winter-stage-4-pdAV5--a.webp?v=1')).toBe(true);
    expect(isSeasonFile('/a2-budget/assets/stage-1-BeGzblgo.webp')).toBe(false);
    expect(isSeasonFile('/src/world/assets/seasons/winter/depth.webp')).toBe(false);
  });
});

describe('planSeasonPrefetch', () => {
  it('été (base), loin du changement : rien à précharger', () => {
    expect(planSeasonPrefetch({ now: day(2027, 7, 10), stage: 3, isDesktop: false })).toEqual([]);
  });

  it('été, J-15 : toujours rien ; J-14 : automne, stade actuel et suivant seulement', () => {
    expect(planSeasonPrefetch({ now: day(2027, 8, 17), stage: 3, isDesktop: false })).toEqual([]);
    expect(names(planSeasonPrefetch({ now: day(2027, 8, 18), stage: 3, isDesktop: false }))).toEqual([
      'season-autumn-stage-3',
      'season-autumn-stage-4',
    ]);
    expect(names(planSeasonPrefetch({ now: day(2027, 8, 31), stage: 3, isDesktop: false }))).toEqual([
      'season-autumn-stage-3',
      'season-autumn-stage-4',
    ]);
  });

  it('hiver, téléphone : stade actuel, suivant, bandeaux paysage, nuit, puis stades suivants', () => {
    expect(names(planSeasonPrefetch({ now: day(2027, 1, 15), stage: 3, isDesktop: false }))).toEqual([
      'season-winter-stage-3',
      'season-winter-stage-4',
      'season-budget-winter-landscape',
      'season-courses-winter-landscape',
      'season-winter-lut-night',
      'season-winter-stage-5',
      'season-winter-stage-6',
      'season-winter-stage-7',
    ]);
  });

  it('ordinateur : bandeaux portrait', () => {
    const plan = names(planSeasonPrefetch({ now: day(2026, 10, 5), stage: 1, isDesktop: true }));
    expect(plan.slice(0, 4)).toEqual(['season-autumn-stage-1', 'season-autumn-stage-2', 'season-budget-autumn-portrait', 'season-courses-autumn-portrait']);
    expect(plan.some((n) => n.includes('landscape'))).toBe(false);
  });

  it('stade 7, J-8 du printemps : aucun stade 8, printemps du stade 7 seul', () => {
    expect(names(planSeasonPrefetch({ now: day(2027, 2, 21), stage: 7, isDesktop: false }))).toEqual([
      'season-winter-stage-7',
      'season-budget-winter-landscape',
      'season-courses-winter-landscape',
      'season-winter-lut-night',
      'season-spring-stage-7',
    ]);
  });

  it('printemps : pas de bandeau de saison (automne et hiver seulement)', () => {
    const plan = names(planSeasonPrefetch({ now: day(2027, 4, 10), stage: 6, isDesktop: false }));
    expect(plan).toEqual(['season-spring-stage-6', 'season-spring-stage-7', 'season-spring-lut-night']);
  });

  it('stade hors bornes : ramené à 1..7, sans doublon', () => {
    const plan = planSeasonPrefetch({ now: day(2027, 1, 15), stage: 12, isDesktop: false });
    expect(new Set(plan).size).toBe(plan.length);
    expect(names(plan)[0]).toBe('season-winter-stage-7');
  });
});

describe('allSeasonAssets', () => {
  it('32 images : 3 saisons × (7 stades + nuit) et 8 bandeaux', () => {
    const all = allSeasonAssets();
    expect(all).toHaveLength(32);
    expect(new Set(all.map((a) => a.url)).size).toBe(32);
    expect(all.filter((a) => a.season === 'spring')).toHaveLength(8);
    expect(all.filter((a) => a.season === 'winter')).toHaveLength(12);
  });
});
