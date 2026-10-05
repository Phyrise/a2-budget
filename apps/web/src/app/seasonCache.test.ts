import { describe, expect, it } from 'vitest';
import {
  CACHED_AT_HEADER,
  SEASONS_CACHE,
  SEASON_MAX_AGE_MS,
  daysUntilNextSeason,
  dropOffSeasons,
  isSeasonAsset,
  nextSeason,
  parseSeasonAsset,
  purgeSeasonCache,
  seasonOfDate,
  shouldPurge,
} from './seasonCache';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0);
const DAY_MS = 86_400_000;

describe('seasonOfDate / nextSeason', () => {
  it('suit les mois de l’hémisphère nord, aux frontières', () => {
    expect(seasonOfDate(day(2027, 2, 28))).toBe('winter');
    expect(seasonOfDate(day(2027, 3, 1))).toBe('spring');
    expect(seasonOfDate(day(2027, 5, 31))).toBe('spring');
    expect(seasonOfDate(day(2027, 6, 1))).toBe('summer');
    expect(seasonOfDate(day(2027, 8, 31))).toBe('summer');
    expect(seasonOfDate(day(2027, 9, 1))).toBe('autumn');
    expect(seasonOfDate(day(2027, 11, 30))).toBe('autumn');
    expect(seasonOfDate(day(2027, 12, 1))).toBe('winter');
    expect(seasonOfDate(day(2027, 1, 1))).toBe('winter');
  });

  it('enchaîne hiver → printemps → été → automne → hiver', () => {
    expect(nextSeason('winter')).toBe('spring');
    expect(nextSeason('spring')).toBe('summer');
    expect(nextSeason('summer')).toBe('autumn');
    expect(nextSeason('autumn')).toBe('winter');
  });
});

describe('daysUntilNextSeason', () => {
  it('compte en jours locaux jusqu’au premier jour de la saison suivante', () => {
    expect(daysUntilNextSeason(day(2026, 11, 30))).toBe(1);
    expect(daysUntilNextSeason(day(2026, 12, 1))).toBe(90); // → 1er mars 2027
    expect(daysUntilNextSeason(day(2026, 12, 15))).toBe(76);
    expect(daysUntilNextSeason(day(2027, 2, 28))).toBe(1);
    expect(daysUntilNextSeason(day(2028, 2, 15))).toBe(15); // année bissextile
    expect(daysUntilNextSeason(day(2027, 8, 18))).toBe(14);
    expect(daysUntilNextSeason(day(2027, 8, 17))).toBe(15);
  });

  it('ignore l’heure (et le changement d’heure)', () => {
    // Fin mars : passage à l'heure d'été en Europe, sans effet sur le compte.
    expect(daysUntilNextSeason(new Date(2027, 2, 27, 0, 5))).toBe(daysUntilNextSeason(new Date(2027, 2, 27, 23, 55)));
    expect(daysUntilNextSeason(new Date(2027, 2, 27, 12))).toBe(66); // → 1er juin
    expect(daysUntilNextSeason(new Date(2027, 9, 30, 23, 59))).toBe(32); // → 1er décembre
  });
});

describe('isSeasonAsset / parseSeasonAsset', () => {
  // Noms réels émis au build (dist/assets), hash de 8 caractères avec « - » ou « _ ».
  const real: [string, string, string][] = [
    ['season-winter-stage-4-pdAV5--a.webp', 'season-winter-stage-4', 'winter'],
    ['season-winter-stage-3-CPf-yRld.webp', 'season-winter-stage-3', 'winter'],
    ['season-autumn-stage-1-DoFb_ZKH.webp', 'season-autumn-stage-1', 'autumn'],
    ['season-spring-lut-night-CU2PZh6D.png', 'season-spring-lut-night', 'spring'],
    ['season-winter-lut-night-Cr_NEQlF.png', 'season-winter-lut-night', 'winter'],
    ['season-budget-winter-landscape-CNShJEy1.webp', 'season-budget-winter-landscape', 'winter'],
    ['season-courses-autumn-portrait-v3AASGGo.webp', 'season-courses-autumn-portrait', 'autumn'],
  ];

  it.each(real)('%s', (file, key, season) => {
    const path = `/a2-budget/assets/${file}`;
    expect(isSeasonAsset(path)).toBe(true);
    expect(parseSeasonAsset(path)).toEqual({ key, season });
  });

  it('refuse la base, les portraits, les chemins sources et les autres dossiers', () => {
    for (const p of [
      '/a2-budget/assets/stage-1-BeGzblgo.webp',
      '/a2-budget/assets/banner-portrait-AbCdEf12.webp',
      '/a2-budget/src/world/assets/seasons/winter/season-winter-stage-1.webp',
      '/a2-budget/other/season-winter-stage-1-BeGzblgo.webp',
      '/a2-budget/assets/season-winter-stage-1-BeGzblgo.js',
    ]) {
      expect(isSeasonAsset(p)).toBe(false);
      expect(parseSeasonAsset(p)).toBeNull();
    }
  });
});

describe('shouldPurge', () => {
  const now = day(2027, 1, 15); // hiver
  it('ne purge jamais la saison en cours, ni une entrée non datée', () => {
    expect(shouldPurge('winter', now.getTime() - 400 * DAY_MS, now)).toBe(false);
    expect(shouldPurge('autumn', null, now)).toBe(false);
  });
  it('purge une autre saison mise en cache il y a plus de 90 jours', () => {
    expect(shouldPurge('autumn', now.getTime() - SEASON_MAX_AGE_MS - 1, now)).toBe(true);
    expect(shouldPurge('autumn', now.getTime() - SEASON_MAX_AGE_MS + DAY_MS, now)).toBe(false);
    expect(shouldPurge('spring', now.getTime() - 10 * DAY_MS, now)).toBe(false);
  });
});

/** Faux CacheStorage : un seul cache, réponses datées par en-tête. */
function fakeStorage(entries: { url: string; at?: number }[]) {
  const store = new Map<string, Response>();
  for (const e of entries) {
    const headers = new Headers();
    if (e.at !== undefined) headers.set(CACHED_AT_HEADER, String(e.at));
    store.set(e.url, new Response('x', { headers }));
  }
  const cache = {
    keys: async () => [...store.keys()].map((u) => new Request(u)),
    match: async (r: Request | string) => store.get(typeof r === 'string' ? r : r.url),
    delete: async (r: Request | string) => store.delete(typeof r === 'string' ? r : r.url),
  };
  const storage = {
    has: async (name: string) => name === SEASONS_CACHE,
    open: async () => cache,
  } as unknown as CacheStorage;
  return { storage, urls: () => [...store.keys()].map((u) => u.replace('https://x.test/a2-budget/assets/', '')) };
}

const U = (f: string) => `https://x.test/a2-budget/assets/${f}`;

describe('purgeSeasonCache', () => {
  const now = day(2027, 1, 15);
  const t = now.getTime();

  it('une version par image (la plus récente), saisons trop vieilles et entrées étrangères retirées', async () => {
    const { storage, urls } = fakeStorage([
      { url: U('season-winter-stage-1-AAAAAAAA.webp'), at: t - 5 * DAY_MS },
      { url: U('season-winter-stage-1-BBBBBBBB.webp'), at: t - 1 * DAY_MS },
      { url: U('season-winter-stage-2-pdAV5--a.webp'), at: t - 300 * DAY_MS },
      { url: U('season-autumn-stage-1-DoFb_ZKH.webp'), at: t - 120 * DAY_MS },
      { url: U('season-spring-stage-1-mSHBmyjA.webp'), at: t - 3 * DAY_MS },
      { url: U('season-autumn-stage-2-BKAwiGzu.webp') },
      { url: U('stage-1-BeGzblgo.webp'), at: t },
    ]);
    expect(await purgeSeasonCache(storage, now)).toBe(3);
    expect(urls().sort()).toEqual([
      'season-autumn-stage-2-BKAwiGzu.webp',
      'season-spring-stage-1-mSHBmyjA.webp',
      'season-winter-stage-1-BBBBBBBB.webp',
      'season-winter-stage-2-pdAV5--a.webp',
    ]);
  });

  it('garde `keepUrl` (l’image tout juste mise en cache) plutôt que la plus récente', async () => {
    const { storage, urls } = fakeStorage([
      { url: U('season-budget-winter-landscape-NEWNEW12.webp'), at: t },
      { url: U('season-budget-winter-landscape-OLDOLD12.webp'), at: t - DAY_MS },
    ]);
    expect(await purgeSeasonCache(storage, now, U('season-budget-winter-landscape-OLDOLD12.webp'))).toBe(1);
    expect(urls()).toEqual(['season-budget-winter-landscape-OLDOLD12.webp']);
  });

  it('sans cache des saisons : rien', async () => {
    const storage = { has: async () => false } as unknown as CacheStorage;
    expect(await purgeSeasonCache(storage, now)).toBe(0);
  });
});

describe('dropOffSeasons (fin d’aperçu)', () => {
  const files = [
    'season-winter-stage-1-BeGzblgo.webp',
    'season-spring-stage-1-mSHBmyjA.webp',
    'season-autumn-stage-1-DoFb_ZKH.webp',
    'season-budget-autumn-landscape-DPmusyeZ.webp',
  ];

  it('garde la saison en cours seule, loin du changement', async () => {
    const { storage, urls } = fakeStorage(files.map((f) => ({ url: U(f), at: 0 })));
    expect(await dropOffSeasons(storage, day(2027, 1, 10))).toBe(3);
    expect(urls()).toEqual(['season-winter-stage-1-BeGzblgo.webp']);
  });

  it('garde aussi la saison suivante à J-14', async () => {
    const { storage, urls } = fakeStorage(files.map((f) => ({ url: U(f), at: 0 })));
    expect(await dropOffSeasons(storage, day(2027, 2, 20))).toBe(2);
    expect(urls()).toEqual(['season-winter-stage-1-BeGzblgo.webp', 'season-spring-stage-1-mSHBmyjA.webp']);
  });
});
