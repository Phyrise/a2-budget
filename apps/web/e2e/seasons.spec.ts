import { expect, test, type Page } from '@playwright/test';
import { PHONE, STORAGE_KEY, goTo, openApp, sheet, trackErrors } from './helpers';

/**
 * Saisons (contre le build de production, `pnpm preview`, service worker
 * actif) :
 * - le précache ne contient aucune peinture de saison (assets/season-*) ;
 * - en hiver simulé (horloge Playwright, page seulement), la forêt et les
 *   bandeaux Budget / Courses pointent vers les variantes d'hiver ; en été,
 *   la base seule ;
 * - hors ligne après une visite, la peinture de saison courante est servie
 *   par le cache d'exécution « a2-budget-seasons ».
 */

test.use({ viewport: PHONE });

const WINTER = new Date('2027-01-15T10:00:00');
const SUMMER = new Date('2027-07-10T10:00:00');
const SEASON_ASSET = /\/assets\/season-[\w-]+\.(?:webp|png)$/;

/** Économiseur de données simulé : aucun préchargement, seules les images affichées sont demandées. */
async function saveData(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: true }) });
  });
}

function seasonRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (SEASON_ASSET.test(new URL(r.url()).pathname)) urls.push(r.url());
  });
  return urls;
}

async function cacheUrls(page: Page, prefix: string): Promise<string[]> {
  return page.evaluate(async (p) => {
    const name = (await caches.keys()).find((n) => n.startsWith(p));
    if (!name) return [];
    return (await (await caches.open(name)).keys()).map((r) => r.url);
  }, prefix);
}

async function waitController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30_000 });
}

/** Peinture d'univers visible (variante de saison prête, ou base). */
function painting(page: Page, kind: 'banner' | 'backdrop', universe: 'budget' | 'courses', season: string) {
  return page.locator(`img.app-world__${kind}[data-universe="${universe}"][data-season="${season}"]`);
}

test('précache : aucune peinture de saison', async ({ page }) => {
  await openApp(page);
  const sw = await (await page.request.get('sw.js')).text();
  expect(sw).not.toMatch(/assets\/season-[\w-]+-[\w-]{8}\.(?:webp|png)/);
  await waitController(page);
  // Précache rempli et stable (deux lectures identiques).
  let last = -1;
  await expect
    .poll(
      async () => {
        const n = (await cacheUrls(page, 'a2-budget-precache')).length;
        const stable = n > 50 && n === last;
        last = n;
        return stable;
      },
      { timeout: 45_000, intervals: [500] },
    )
    .toBe(true);
  const urls = await cacheUrls(page, 'a2-budget-precache');
  expect(urls.some((u) => /\/assets\/stage-1-[\w-]+\.webp$/.test(u))).toBe(true);
  expect(urls.filter((u) => /\/assets\/season-/.test(u))).toEqual([]);
});

test('hiver simulé : la forêt charge sa peinture d’hiver', async ({ page }) => {
  await page.clock.setFixedTime(WINTER);
  await saveData(page);
  const requested = seasonRequests(page);
  await openApp(page, 'maison');
  // Stade 1 d'une forêt neuve : image fixe puis moteur, peinture d'hiver.
  await expect.poll(() => requested.some((u) => /\/season-winter-stage-1-/.test(u)), { timeout: 20_000 }).toBe(true);
  await expect(page.locator('.living-forest img[src*="/season-winter-stage-1-"]')).toHaveCount(1);
  expect(requested.filter((u) => /\/season-(?:\w+-)?(?:spring|autumn)-/.test(u))).toEqual([]);
});

test('hiver simulé : bandeaux d’hiver (téléphone)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(WINTER);
  await saveData(page);
  await openApp(page, 'maison');

  await goTo(page, 'Budget');
  const budget = painting(page, 'banner', 'budget', 'winter');
  await expect(budget).toHaveAttribute('src', /\/season-budget-winter-landscape-/);
  await expect(budget).toHaveClass(/is-ready/);
  await expect(budget).toHaveClass(/is-shown/);
  await expect(budget).toHaveCSS('opacity', '1');

  await goTo(page, 'Courses');
  const courses = painting(page, 'banner', 'courses', 'winter');
  await expect(courses).toHaveAttribute('src', /\/season-courses-winter-landscape-/);
  await expect(courses).toHaveClass(/is-ready/);
  // Une seule peinture en vigueur ; la base (image d'attente) quitte le DOM après le fondu.
  await expect(page.locator('img.app-world__banner[data-universe="courses"]')).toHaveCount(1);
  await expect(page.locator('img.app-world__img--courses[data-season="base"]')).toHaveCount(0);
  expect(errors, errors.join(' | ')).toEqual([]);
});

test('hiver simulé : fonds portrait d’hiver (ordinateur)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(WINTER);
  await saveData(page);
  await openApp(page, 'budget');
  const budget = painting(page, 'backdrop', 'budget', 'winter');
  await expect(budget).toHaveAttribute('src', /\/season-budget-winter-portrait-/);
  await expect(budget).toHaveClass(/is-ready/);
  await goTo(page, 'Courses');
  await expect(painting(page, 'backdrop', 'courses', 'winter')).toHaveAttribute('src', /\/season-courses-winter-portrait-/);
});

test('été simulé : la base seule, aucune peinture de saison', async ({ page }) => {
  await page.clock.setFixedTime(SUMMER);
  await saveData(page);
  const requested = seasonRequests(page);
  await openApp(page, 'budget');
  await expect(painting(page, 'banner', 'budget', 'base')).toHaveClass(/is-shown/);
  await expect(page.locator('img[data-universe="budget"]')).toHaveCount(1);
  await goTo(page, 'Maison');
  await page.waitForTimeout(1500);
  expect(requested).toEqual([]);
});

test('mode développeur : l’aperçu de saison change les peintures, sans écrire ; saisons et cache dans le panneau', async ({ page }) => {
  await page.clock.setFixedTime(SUMMER);
  await saveData(page);
  await openApp(page, 'budget');
  await expect(painting(page, 'banner', 'budget', 'base')).toHaveClass(/is-shown/);
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await sheet(page, 'Réglages').getByRole('switch', { name: 'Mode développeur' }).click();
  await page.keyboard.press('Escape');
  const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);

  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = sheet(page, 'Mode développeur');
  const row = (label: string) => dev.locator('.dev-row', { has: page.getByText(label, { exact: true }) });
  await expect(row('Saison réelle')).toContainText('Été (base)');
  await expect(row('Saison affichée')).toContainText('Été (base)');
  await expect(row('Cache des saisons')).toContainText(/\d+ \/ 32/);
  await dev.locator('fieldset', { hasText: 'Saison' }).getByRole('button', { name: 'Hiver' }).click();
  await expect(row('Saison affichée')).toContainText('Hiver');
  await expect(row('Saison affichée')).toContainText('aperçu');
  await expect(row('Saison réelle')).toContainText('Été (base)');
  await page.keyboard.press('Escape');

  // Le bandeau Budget passe à l'hiver ; les données ne bougent pas.
  await expect(painting(page, 'banner', 'budget', 'winter')).toHaveClass(/is-ready/);
  await expect(page.locator('.preview-banner')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(before);
  await page.getByRole('button', { name: 'Revenir à la vraie forêt' }).click();
  await expect(painting(page, 'banner', 'budget', 'base')).toHaveClass(/is-shown/);
  await expect(page.locator('img.app-world__banner[data-universe="budget"]')).toHaveCount(1);
});

test('hors ligne après visite : la peinture de saison courante vient du cache', async ({ page, context }) => {
  await page.clock.setFixedTime(WINTER);
  await openApp(page, 'maison');
  await waitController(page);
  // Préchargement discret (au repos) : stade actuel, bandeaux d'hiver, nuit d'hiver…
  await expect
    .poll(
      async () => {
        const urls = await cacheUrls(page, 'a2-budget-seasons');
        return ['season-winter-stage-1-', 'season-winter-stage-2-', 'season-budget-winter-landscape-', 'season-winter-lut-night-'].every((k) =>
          urls.some((u) => u.includes(k)),
        );
      },
      { timeout: 60_000, intervals: [1000] },
    )
    .toBe(true);
  // Rien d'une autre saison (le préchargement suit la date de la page).
  expect((await cacheUrls(page, 'a2-budget-seasons')).filter((u) => /season-(?:\w+-)?(?:spring|autumn)-/.test(u))).toEqual([]);

  await context.setOffline(true);
  const fromWorker: string[] = [];
  page.on('response', (r) => {
    if (SEASON_ASSET.test(new URL(r.url()).pathname) && r.ok() && r.fromServiceWorker()) fromWorker.push(r.url());
  });
  await page.reload();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  await goTo(page, 'Budget');
  const budget = painting(page, 'banner', 'budget', 'winter');
  await expect(budget).toHaveClass(/is-ready/);
  expect(await budget.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1536);
  await expect.poll(() => fromWorker.some((u) => u.includes('season-budget-winter-landscape-'))).toBe(true);
  // La peinture d'hiver du stade actuel aussi (moteur ou image fixe de la forêt).
  const stage = await page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => n.startsWith('a2-budget-seasons')) as string;
    const req = (await (await caches.open(name)).keys()).find((r) => r.url.includes('season-winter-stage-1-'));
    const res = req ? await fetch(req.url) : null;
    return res ? { ok: res.ok, type: res.headers.get('content-type') } : null;
  });
  expect(stage).toEqual({ ok: true, type: 'image/webp' });
  await context.setOffline(false);
});
