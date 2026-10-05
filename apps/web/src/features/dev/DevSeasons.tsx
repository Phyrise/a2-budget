/**
 * Mode développeur — les saisons : saison réelle (date) et saison affichée
 * (aperçu), jours avant le changement, et état du cache des peintures de
 * saison (« a2-budget-seasons », hors précache : app/seasonCache.ts). Lecture
 * seule, sauf la purge douce à la demande (la même que celle du service
 * worker) ; rien n'est écrit dans les données.
 */
import { useCallback, useEffect, useState } from 'react';
import { allSeasonAssets } from '../../app/seasonAssets';
import { saveDataOn } from '../../app/seasonPrefetch';
import { NEXT_SEASON_LEAD_DAYS, SEASONS_CACHE, daysUntilNextSeason, nextSeason, purgeSeasonCache } from '../../app/seasonCache';
import { Button } from '../../ui';
import type { Season } from '../../world/types';
import { useWorld } from '../../world/WorldContext';
import { Bar, Row } from './DevNumbers';

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Printemps',
  summer: 'Été (base)',
  autumn: 'Automne',
  winter: 'Hiver',
};

interface CacheStatus {
  /** Cache API disponible. */
  available: boolean;
  cached: number;
  total: number;
  bySeason: Array<{ season: Season; cached: number; total: number }>;
}

async function readCacheStatus(): Promise<CacheStatus> {
  const assets = allSeasonAssets();
  const empty = (['spring', 'autumn', 'winter'] as const).map((season) => ({
    season,
    cached: 0,
    total: assets.filter((a) => a.season === season).length,
  }));
  if (typeof caches === 'undefined') return { available: false, cached: 0, total: assets.length, bySeason: empty };
  const keys = (await caches.has(SEASONS_CACHE)) ? await (await caches.open(SEASONS_CACHE)).keys() : [];
  const inCache = new Set(keys.map((r) => r.url));
  const has = (u: string) => inCache.has(new URL(u, location.href).href);
  const bySeason = empty.map((row) => ({
    ...row,
    cached: assets.filter((a) => a.season === row.season && has(a.url)).length,
  }));
  return { available: true, cached: bySeason.reduce((n, r) => n + r.cached, 0), total: assets.length, bySeason };
}

export function DevSeasons() {
  const { state, realState, preview } = useWorld();
  const [status, setStatus] = useState<CacheStatus | null>(null);
  const [purged, setPurged] = useState<number | null>(null);
  const refresh = useCallback(() => {
    void readCacheStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(refresh, [refresh]);

  const real = realState?.season ?? 'summer';
  const shown = state?.season ?? real;
  const days = daysUntilNextSeason(new Date());
  const purge = async () => {
    if (typeof caches === 'undefined') return;
    setPurged(await purgeSeasonCache(caches, new Date()));
    refresh();
  };

  return (
    <section className="dev-section" aria-labelledby="dev-seasons">
      <h3 id="dev-seasons" className="dev-section__title">
        Saisons
      </h3>
      <dl className="dev-grid">
        <Row label="Saison réelle" value={SEASON_LABELS[real]} hint="date locale" />
        <Row label="Saison affichée" value={SEASON_LABELS[shown]} hint={preview?.season !== undefined ? 'aperçu' : 'réelle'} />
        <Row
          label="Saison suivante"
          value={`${SEASON_LABELS[nextSeason(real)]} dans ${days} j`}
          hint={days <= NEXT_SEASON_LEAD_DAYS ? 'préchargement en cours' : `préchargée à ${NEXT_SEASON_LEAD_DAYS} j`}
        />
        <Row label="Économiseur de données" value={saveDataOn() ? 'oui' : 'non'} hint={saveDataOn() ? 'aucun préchargement' : undefined} />
      </dl>
      {status === null ? null : (
        <>
          <dl className="dev-grid" data-testid="dev-season-cache">
            <Row
              label="Cache des saisons"
              value={`${status.cached} / ${status.total}`}
              hint={status.available ? 'images en cache' : 'Cache API indisponible'}
            />
            {status.bySeason.map((r) => (
              <Row key={r.season} label={SEASON_LABELS[r.season]} value={`${r.cached} / ${r.total}`} />
            ))}
          </dl>
          <Bar ratio={status.total === 0 ? 0 : status.cached / status.total} label="Images de saison en cache" />
        </>
      )}
      <div className="dev-actions">
        <Button size="sm" variant="quiet" icon="undo" onClick={refresh}>
          Actualiser
        </Button>
        <Button size="sm" variant="ghost" icon="leaf" onClick={() => void purge()}>
          Purger les saisons lointaines
        </Button>
      </div>
      {purged !== null && (
        <p className="dev-section__lead" role="status">
          {purged === 0 ? 'Rien à purger.' : `${purged} image${purged > 1 ? 's' : ''} retirée${purged > 1 ? 's' : ''}.`}
        </p>
      )}
    </section>
  );
}
