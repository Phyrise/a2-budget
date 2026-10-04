/// <reference lib="webworker" />
/**
 * Service worker A² Home.
 *
 * Stratégie injectManifest : le manifest de précache est injecté par
 * vite-plugin-pwa dans `self.__WB_MANIFEST`.
 *
 * - Tous les caches sont préfixés « a2-budget » : ils ne collident jamais
 *   avec les autres projets servis depuis la même origine (phyrise.github.io)
 *   et le nettoyage des caches périmés ne touche que les nôtres.
 * - Le service worker est limité au scope /a2-budget/ (manifest + scope).
 * - Une mise à jour de l'application ne touche jamais au stockage financier
 *   (localStorage, clé a2-budget:state:v1).
 */
import { clientsClaim, setCacheNameDetails, skipWaiting } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

setCacheNameDetails({ prefix: 'a2-budget' });

clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

// Repli SPA : toute navigation est servie par l'index précache
// (l'application n'a pas de routeur ; l'état de vue est en mémoire).
const fallback = createHandlerBoundToURL('/a2-budget/index.html');
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fallback({ event, request: event.request, url: new URL(event.request.url) }),
    );
  }
});

// Peintures portrait des univers (fond fixe sur ordinateur seulement) :
// hors précache, mises en cache au premier affichage (cache d'abord), en
// gardant au plus quelques versions (les noms changent à chaque build).
const PORTRAITS_CACHE = 'a2-budget-portraits';
const PORTRAITS_KEEP = 4;
const PORTRAIT_RE = /\/assets\/banner-portrait-[\w-]+\.webp$/;

async function portraitFirst(request: Request): Promise<Response> {
  const cache = await caches.open(PORTRAITS_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - PORTRAITS_KEEP))) await cache.delete(old);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !PORTRAIT_RE.test(new URL(request.url).pathname)) return;
  event.respondWith(portraitFirst(request).catch(() => fetch(request)));
});

// Mise à jour volontaire : workbox-window (updateServiceWorker(true)) envoie
// SKIP_WAITING au service worker en attente ; on l'active alors. Sans ce
// message, le nouveau worker reste en attente et l'ancienne version sert.
self.addEventListener('message', (event) => {
  if (event.data !== null && typeof event.data === 'object' && 'type' in event.data) {
    if ((event.data as { type: unknown }).type === 'SKIP_WAITING') {
      skipWaiting();
    }
  }
});
