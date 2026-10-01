/// <reference lib="webworker" />
/**
 * Service worker A² Budget (lead).
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
