/**
 * Quelles peintures de saison, pour quoi : lecture des manifests (forêt :
 * world/manifest.ts `seasons` ; univers : themes/manifest.ts `seasons`).
 *
 * - L'été (saison des pluies) est la base : aucune variante.
 * - Forêt : printemps, automne, hiver = 7 stades + LUT nuit (la profondeur
 *   réutilise celle de la base, déjà précachée).
 * - Bandeaux Budget (Chihiro) / Courses (Kiki) : automne et hiver seulement.
 *
 * Fonctions pures (aucun accès réseau) : le préchargement (seasonPrefetch.ts)
 * et le mode développeur s'en servent.
 */
import { budgetTheme, coursesTheme } from '../themes/manifest';
import type { ThemeBanners } from '../themes/types';
import { manifest } from '../world/manifest';
import type { GrowthStage, Season, SeasonSet, WorldManifest } from '../world/types';
import { NEXT_SEASON_LEAD_DAYS, daysUntilNextSeason, nextSeason, seasonOfDate } from './seasonCache';

export type UniverseThemeId = 'budget' | 'courses';

const THEMES: Record<UniverseThemeId, { banners: ThemeBanners; seasons?: Partial<Record<'autumn' | 'winter', ThemeBanners>> }> = {
  budget: budgetTheme,
  courses: coursesTheme,
};

/** Variante de forêt d'une saison, null = la base (été, ou saison sans peinture). */
export function forestSeason(season: Season, m: WorldManifest = manifest): SeasonSet | null {
  if (season === 'summer') return null;
  return m.seasons?.[season] ?? null;
}

/** Bandeaux d'un univers pour une saison (base si pas de variante). */
export function universeBanners(theme: UniverseThemeId, season: Season): ThemeBanners {
  const t = THEMES[theme];
  const s = season === 'autumn' || season === 'winter' ? t.seasons?.[season] : undefined;
  return s ?? t.banners;
}

/**
 * Fichier de saison (nom « season-… ») : au build `assets/season-*-<hash>`
 * (motif du cache d'exécution, seasonCache.isSeasonAsset), en développement
 * le chemin source. Les profondeurs de base réutilisées n'en sont pas.
 */
export function isSeasonFile(url: string): boolean {
  return /(?:^|\/)season-[^/]*$/.test(url.split(/[?#]/)[0] ?? '');
}

function clampStage(stage: number): GrowthStage {
  return Math.min(7, Math.max(1, Math.round(stage))) as GrowthStage;
}

/** Images d'un stade de forêt de saison qui ne sont pas déjà des images de base. */
function stageUrls(set: SeasonSet, stage: GrowthStage): string[] {
  const img = set.stages[stage];
  return [img.color, img.depth].filter((u): u is string => !!u && isSeasonFile(u));
}

export interface PrefetchPlanInput {
  now: Date;
  /** Stade réel de la forêt (1..7). */
  stage: number;
  /** Ordinateur : bandeaux portrait (fond), sinon paysage (bandeau mobile). */
  isDesktop: boolean;
  m?: WorldManifest;
}

/**
 * Liste ordonnée (sans doublon) des images de saison à précharger :
 * 1. saison en cours : stade actuel, stade suivant, bandeaux des univers
 *    (paysage sur mobile, portrait sur ordinateur), LUT nuit, puis les stades
 *    suivants jusqu'au 7 (les stades passés ne reviennent jamais) ;
 * 2. à ≤ 14 jours du changement : saison suivante, stade actuel et suivant.
 */
export function planSeasonPrefetch({ now, stage, isDesktop, m = manifest }: PrefetchPlanInput): string[] {
  const urls: string[] = [];
  const add = (u: string | null | undefined) => {
    if (u && isSeasonFile(u) && !urls.includes(u)) urls.push(u);
  };
  const s = clampStage(stage);
  const current = seasonOfDate(now);
  const set = forestSeason(current, m);
  if (set) {
    for (const u of stageUrls(set, s)) add(u);
    if (s < 7) for (const u of stageUrls(set, clampStage(s + 1))) add(u);
  }
  for (const theme of ['budget', 'courses'] as const) {
    const b = universeBanners(theme, current);
    add(isDesktop ? b.portrait : b.landscape);
  }
  if (set) {
    add(set.nightLut);
    for (let n = s + 2; n <= 7; n++) for (const u of stageUrls(set, clampStage(n))) add(u);
  }
  if (daysUntilNextSeason(now) <= NEXT_SEASON_LEAD_DAYS) {
    const next = forestSeason(nextSeason(current), m);
    if (next) {
      for (const u of stageUrls(next, s)) add(u);
      if (s < 7) for (const u of stageUrls(next, clampStage(s + 1))) add(u);
    }
  }
  return urls;
}

export interface SeasonAssetEntry {
  season: Exclude<Season, 'summer'>;
  url: string;
}

/** Toutes les images de saison connues des manifests (mode développeur). */
export function allSeasonAssets(m: WorldManifest = manifest): SeasonAssetEntry[] {
  const out: SeasonAssetEntry[] = [];
  const seen = new Set<string>();
  const add = (season: SeasonAssetEntry['season'], u: string | null | undefined) => {
    if (!u || !isSeasonFile(u) || seen.has(u)) return;
    seen.add(u);
    out.push({ season, url: u });
  };
  for (const season of ['spring', 'autumn', 'winter'] as const) {
    const set = m.seasons?.[season];
    if (set) {
      for (const n of [1, 2, 3, 4, 5, 6, 7] as const) for (const u of stageUrls(set, n)) add(season, u);
      add(season, set.nightLut);
    }
    if (season !== 'spring') {
      for (const theme of ['budget', 'courses'] as const) {
        const b = THEMES[theme].seasons?.[season];
        add(season, b?.landscape);
        add(season, b?.portrait);
      }
    }
  }
  return out;
}
