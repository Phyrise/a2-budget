/**
 * Cache des images de saison — module SANS dépendance, partagé par le
 * service worker (src/sw.ts) et la page (préchargement, mode développeur).
 *
 * Les peintures de saison (forêt printemps / automne / hiver, LUT nuit de
 * saison, bandeaux automne / hiver des univers) sont émises au build sous
 * `assets/season-*-<hash>.<ext>` (en-têtes de world/manifest.ts et
 * themes/manifest.ts). Elles sont EXCLUES du précache (vite.config.ts,
 * injectManifest.globIgnores) et servies par un cache d'exécution dédié
 * (cache d'abord), rempli à la demande et par le préchargement discret.
 *
 * Purge douce : la saison en cours n'est jamais purgée ; une entrée d'une
 * autre saison est retirée 90 jours après sa mise en cache (la saison
 * passée part donc au plus une saison plus tard, la suivante, préchargée
 * ~14 jours avant, reste) ; une seule version (hash) de chaque image est
 * gardée d'un build à l'autre. Règle fondée sur l'âge plutôt que sur un
 * nombre de saisons : elle ne dépend que de l'horloge du service worker.
 */

/** Même union que world/types.ts (dupliquée : ce module reste sans import). */
export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS_CACHE = 'a2-budget-seasons';
/** En-tête ajouté par le service worker : date de mise en cache (ms). */
export const CACHED_AT_HEADER = 'x-a2-cached-at';
/** Âge maximal d'une entrée d'une saison non courante. */
export const SEASON_MAX_AGE_MS = 90 * 24 * 3600 * 1000;
/** Préchargement de la saison suivante à moins de N jours du changement. */
export const NEXT_SEASON_LEAD_DAYS = 14;

const ORDER: SeasonName[] = ['winter', 'spring', 'summer', 'autumn'];

/**
 * Saison météorologique (hémisphère nord) d'après le mois local — même
 * découpage que seasonOf (world/worldState.ts) : printemps mars–mai, été
 * juin–août, automne sept.–nov., hiver déc.–fév.
 */
export function seasonOfDate(now: Date): SeasonName {
  const m = now.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function nextSeason(s: SeasonName): SeasonName {
  return ORDER[(ORDER.indexOf(s) + 1) % 4] as SeasonName;
}

/** Jours entiers (dates locales) jusqu'au premier jour de la saison suivante. */
export function daysUntilNextSeason(now: Date): number {
  // Premiers mois de saison : mars (2), juin (5), septembre (8), décembre (11),
  // puis mars de l'année suivante (14).
  const m = now.getMonth();
  const startMonth = [2, 5, 8, 11, 14].find((s) => s > m) as number;
  const boundary = new Date(now.getFullYear(), startMonth, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((boundary.getTime() - today.getTime()) / 86_400_000);
}

const SEASON_ASSET_RE = /\/assets\/(season-[\w-]+)-[\w-]{8}\.(?:webp|png|jpe?g|avif)$/;
const SEASON_IN_NAME_RE = /^season-(?:(?:budget|courses)-)?(spring|summer|autumn|winter)-/;

/** Vrai pour une URL (ou un chemin) d'image de saison émise au build. */
export function isSeasonAsset(pathname: string): boolean {
  return SEASON_ASSET_RE.test(pathname);
}

/**
 * Nom logique (sans hash) et saison d'une image de saison, ex.
 * `/a2-budget/assets/season-winter-stage-3-AbC_12-x.webp` →
 * `{ key: 'season-winter-stage-3', season: 'winter' }`. null sinon.
 */
export function parseSeasonAsset(pathname: string): { key: string; season: SeasonName } | null {
  const m = SEASON_ASSET_RE.exec(pathname);
  if (!m) return null;
  const key = m[1] as string;
  const s = SEASON_IN_NAME_RE.exec(key);
  return s ? { key, season: s[1] as SeasonName } : null;
}

/**
 * Faut-il retirer cette entrée ? `cachedAt` = date de mise en cache (ms),
 * null si inconnue (gardée : on ne sait pas la dater).
 */
export function shouldPurge(season: SeasonName, cachedAt: number | null, now: Date): boolean {
  if (season === seasonOfDate(now) || cachedAt === null) return false;
  return now.getTime() - cachedAt > SEASON_MAX_AGE_MS;
}

/**
 * Purge douce du cache des saisons : saisons trop lointaines ou trop vieilles
 * (shouldPurge), et une seule version (hash) par image — la plus récente, ou
 * `keepUrl` (celle qu'on vient de mettre en cache). Retourne le nombre
 * d'entrées retirées. Utilisable depuis la page comme depuis le SW.
 */
export async function purgeSeasonCache(storage: CacheStorage, now: Date, keepUrl?: string): Promise<number> {
  if (!(await storage.has(SEASONS_CACHE))) return 0;
  const cache = await storage.open(SEASONS_CACHE);
  const drop: Request[] = [];
  const newest = new Map<string, { req: Request; at: number }>();
  for (const req of await cache.keys()) {
    const parsed = parseSeasonAsset(new URL(req.url).pathname);
    if (parsed === null) {
      drop.push(req);
      continue;
    }
    const res = await cache.match(req);
    const raw = Number(res?.headers.get(CACHED_AT_HEADER) ?? NaN);
    const at = Number.isFinite(raw) ? raw : null;
    if (shouldPurge(parsed.season, at, now)) {
      drop.push(req);
      continue;
    }
    const rank = req.url === keepUrl ? Infinity : (at ?? 0);
    const prev = newest.get(parsed.key);
    if (prev === undefined) newest.set(parsed.key, { req, at: rank });
    else if (rank > prev.at) {
      drop.push(prev.req);
      newest.set(parsed.key, { req, at: rank });
    } else drop.push(req);
  }
  let removed = 0;
  for (const req of drop) if (await cache.delete(req)) removed += 1;
  return removed;
}

/**
 * Fin d'un aperçu de saison (mode développeur) : retire du cache les saisons
 * qui ne servent pas maintenant — tout sauf la saison en cours et, à ≤ 14
 * jours du changement, la suivante (celles du préchargement discret). Un
 * aperçu ne laisse donc rien pour 90 jours. Retourne le nombre d'entrées retirées.
 */
export async function dropOffSeasons(storage: CacheStorage, now: Date): Promise<number> {
  if (!(await storage.has(SEASONS_CACHE))) return 0;
  const current = seasonOfDate(now);
  const keep = new Set<SeasonName>([current]);
  if (daysUntilNextSeason(now) <= NEXT_SEASON_LEAD_DAYS) keep.add(nextSeason(current));
  const cache = await storage.open(SEASONS_CACHE);
  let removed = 0;
  for (const req of await cache.keys()) {
    const parsed = parseSeasonAsset(new URL(req.url).pathname);
    if (parsed !== null && !keep.has(parsed.season) && (await cache.delete(req))) removed += 1;
  }
  return removed;
}
