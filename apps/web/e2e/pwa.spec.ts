import { test, expect } from '@playwright/test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Tests PWA contre des builds de production servis par un serveur statique
 * local (le service worker n'est pas servi par `vite preview` en dev).
 *
 * Deux builds sont préparés avant la suite (scripts/pwa-builds.sh) :
 * - dist-v1 : la version courante ;
 * - dist-v2 : un rebuild avec un marqueur dans le titre (précache différent).
 * Sans ces builds, les tests sont sautés (message explicite).
 */

const V1 = '/tmp/a2-budget/pwa/dist-v1';
const V2 = '/tmp/a2-budget/pwa/dist-v2';
const pwaReady = existsSync(V1) && existsSync(V2);
const pwaSkipReason =
  'builds PWA absents : lancer apps/web/scripts/pwa-builds.sh avant la suite';
const PORT = 4210;
const BASE = `http://127.0.0.1:${PORT}/a2-budget/`;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function createServer(root: string): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/a2-budget/')) {
      p = p.slice('/a2-budget/'.length);
    }
    if (p === '' || p.endsWith('/')) {
      p += 'index.html';
    }
    const file = path.join(root, p);
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      // Repli SPA (comme le service worker).
      const data = await readFile(path.join(root, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(data);
    }
  });
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));
}

/**
 * Attend que le précache workbox soit réellement rempli des entrées critiques
 * (bundle applicatif + assets du thème). Le nom du cache de précache inclut
 * le scope (préfixe « a2-budget »), d'où la recherche par préfixe.
 */
interface PrecacheState {
  count: number;
  ok: boolean;
}

async function readPrecache(page: import('@playwright/test').Page): Promise<PrecacheState | null> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const precacheName = names.find((n) => n.startsWith('a2-budget-precache'));
    if (!precacheName) {
      return null;
    }
    const cache = await caches.open(precacheName);
    const urls = (await cache.keys()).map((r) => r.url);
    return {
      count: urls.length,
      ok:
        urls.some((u) => /\/assets\/index-.*\.js/.test(u)) &&
        urls.some((u) => /\.(jpe?g|webp|avif)$/.test(u)) &&
        urls.some((u) => /\.woff2$/.test(u)),
    };
  });
}

/**
 * Attend que le précache soit peuplé des entrées critiques ET stable
 * (deux lectures consécutives identiques). Le polling est fait côté Node
 * pour éviter les courses dans le contexte page.
 */
async function waitPrecacheReady(page: import('@playwright/test').Page): Promise<void> {
  const start = Date.now();
  let last: PrecacheState | null = null;
  for (;;) {
    if (Date.now() - start > 45_000) {
      throw new Error('précache pas prêt après 45s');
    }
    const state = await readPrecache(page);
    if (state?.ok && last?.ok && state.count === last.count) {
      return;
    }
    last = state;
    await page.waitForTimeout(400);
  }
}

test.describe('PWA', () => {
  test('hors ligne après préparation du cache', async ({ browser }) => {
    test.skip(!pwaReady, pwaSkipReason);
    const server = createServer(V1);
    await listen(server);
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(BASE);
    await expect(page.locator('.app-nav')).toBeVisible();
    await waitPrecacheReady(page);

    // Le monde (peintures) et les polices auto-hébergées sont dans le précache.
    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys();
      const name = names.find((n) => n.startsWith('a2-budget-precache'));
      const cache = await caches.open(name as string);
      return (await cache.keys()).map((r) => r.url);
    });
    expect(cachedUrls.some((u) => /\.(jpe?g|webp|avif)$/.test(u))).toBe(true);
    expect(cachedUrls.some((u) => /\.woff2$/.test(u))).toBe(true);

    // Hors ligne : rechargement servi par le précache.
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.app-nav')).toBeVisible();
    await expect(page.locator('.screen-sheet')).toBeVisible();

    // Le contenu est bien servi par le service worker (pas le réseau) :
    // le worker est le contrôleur de la page.
    await page.waitForFunction(async () => {
      return Boolean(navigator.serviceWorker.controller);
    }, undefined, { timeout: 10_000 });

    await context.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  test('mise à jour volontaire : SKIP_WAITING active le nouveau worker', async ({ browser }) => {
    test.skip(!pwaReady, pwaSkipReason);
    let server = createServer(V1);
    await listen(server);
    const context = await browser.newContext();
    const page = await context.newPage();

    // Version 1 : enregistrement + précache.
    await page.goto(BASE);
    await expect(page.locator('.app-nav')).toBeVisible();
    await waitPrecacheReady(page);
    expect(await page.title()).not.toContain('v2');

    // Le serveur passe en version 2 (précache différent).
    await new Promise<void>((r) => server.close(() => r()));
    server = createServer(V2);
    await listen(server);

    // On force le check de mise à jour du worker (ce que l'app fait
    // périodiquement via registration.update(), et que le navigateur fait au
    // chargement) : le nouveau worker est installé puis EN ATTENTE (pas de
    // skipWaiting automatique) → proposition « Actualiser ».
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await expect(page.locator('.update-prompt')).toBeVisible({ timeout: 20_000 });

    // Le nouveau worker est bien en attente (pas d'activation automatique).
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.waiting !== null;
    }, undefined, { timeout: 15_000 });

    // Le changement de contrôleur ne doit PAS se produire avant le clic.
    const controllerChanged = page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          let changed = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            changed = true;
          });
          setTimeout(() => resolve(changed), 5000);
        }),
    );

    // Clic « Actualiser » → SKIP_WAITING → activation + prise de contrôle.
    await page.getByRole('button', { name: 'Actualiser' }).click();
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.waiting === null && reg?.active?.state === 'active';
      },
      undefined,
      { timeout: 15_000 },
    );

    // Le contrôleur a bien changé (nouveau worker).
    expect(await controllerChanged).toBe(true);

    // Rechargement : la version 2 est servie.
    await page.reload();
    await expect(page.locator('.app-nav')).toBeVisible();
    await expect(page).toHaveTitle(/v2/);

    await context.close();
    await new Promise<void>((r) => server.close(() => r()));
  });
});
