/**
 * Préchargement discret des peintures de saison (monté une fois par la
 * coquille, App.tsx).
 *
 * À l'installation, seul le précache (interface + forêt de base) est
 * téléchargé. Ensuite, quand la page est au repos (requestIdleCallback) et
 * hors économiseur de données (navigator.connection.saveData) :
 * - saison en cours : stade actuel et suivant, bandeaux de saison des
 *   univers, LUT nuit, puis les stades suivants ;
 * - à ≤ 14 jours du changement : saison suivante, stade actuel et suivant
 *   (plan : seasonAssets.planSeasonPrefetch).
 * Une image à la fois, jamais de rafale ; une image déjà en cache est sautée.
 * Les requêtes passent par le service worker, qui les met dans le cache
 * « a2-budget-seasons » (sw.ts) : sans service worker (développement), rien
 * n'est préchargé.
 */
import { useEffect } from 'react';
import { planSeasonPrefetch } from './seasonAssets';
import { SEASONS_CACHE } from './seasonCache';

/** Délai après le démarrage avant la première image (le premier rendu d'abord). */
const START_DELAY_MS = 2500;
const CONTROLLER_WAIT_MS = 15_000;

interface NetworkInformationLike {
  saveData?: boolean;
}

/** Économiseur de données du navigateur (Chrome / Android). */
export function saveDataOn(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return c?.saveData === true;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(t);
      resolve();
    });
  });
}

function idle(signal: AbortSignal): Promise<void> {
  if (typeof window.requestIdleCallback !== 'function') return sleep(1200, signal);
  return new Promise((resolve) => {
    const id = window.requestIdleCallback(() => resolve(), { timeout: 5000 });
    signal.addEventListener('abort', () => {
      window.cancelIdleCallback(id);
      resolve();
    });
  });
}

/** Attend que le service worker contrôle la page (clientsClaim au premier lancement). */
async function controlled(signal: AbortSignal): Promise<boolean> {
  const sw = navigator.serviceWorker;
  if (sw.controller) return true;
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      window.clearTimeout(t);
      sw.removeEventListener('controllerchange', onChange);
      resolve(ok);
    };
    const onChange = () => done(sw.controller !== null);
    const t = window.setTimeout(() => done(sw.controller !== null), CONTROLLER_WAIT_MS);
    sw.addEventListener('controllerchange', onChange);
    signal.addEventListener('abort', () => done(false));
  });
}

async function prefetchAll(urls: string[], signal: AbortSignal): Promise<void> {
  await sleep(START_DELAY_MS, signal);
  if (signal.aborted || !(await controlled(signal))) return;
  const cache = await caches.open(SEASONS_CACHE);
  for (const url of urls) {
    await idle(signal);
    if (signal.aborted || saveDataOn() || !navigator.onLine) return;
    if (await cache.match(url)) continue;
    try {
      // Corps lu jusqu'au bout (puis jeté) : le service worker le met en cache en parallèle.
      const res = await fetch(url, { signal, priority: 'low', credentials: 'same-origin' });
      await res.blob();
    } catch {
      if (signal.aborted) return;
    }
  }
}

/**
 * Lance (et relance quand le stade, le jour ou la largeur changent) le
 * préchargement des saisons. `stage` : stade RÉEL (jamais l'aperçu).
 */
export function useSeasonPrefetch(stage: number | null, today: Date, isDesktop: boolean): void {
  const day = today.toDateString();
  useEffect(() => {
    if (stage === null || !('serviceWorker' in navigator) || typeof caches === 'undefined') return;
    if (saveDataOn()) return;
    const urls = planSeasonPrefetch({ now: new Date(), stage, isDesktop });
    if (urls.length === 0) return;
    const ctrl = new AbortController();
    void prefetchAll(urls, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [stage, day, isDesktop]);
}
