import { expect, test, type Page } from '@playwright/test';
import { PHONE, goTo, openApp, sheet } from './helpers';

/**
 * Saisons — replis (contre le build de production) :
 * - peinture de saison de la forêt indisponible (réseau coupé avant sa mise
 *   en cache) : la forêt vivante s'affiche sur la base (précachée), puis
 *   reprend la peinture de saison au retour du réseau ;
 * - bandeau d'un univers : d'une saison à l'autre (automne → hiver), la
 *   peinture précédente reste affichée jusqu'au fondu, jamais la base.
 * Service worker bloqué : les routes Playwright voient toutes les requêtes.
 */

test.use({ viewport: PHONE, serviceWorkers: 'block' });

const WINTER = new Date('2027-01-15T10:00:00');
const AUTUMN = new Date('2026-10-15T10:00:00');

async function saveData(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: true }) });
  });
}

test('forêt : peinture d’hiver indisponible → base, puis hiver au retour du réseau', async ({ page, context }) => {
  await page.clock.setFixedTime(WINTER);
  await saveData(page);
  let blocked = true;
  await context.route(/\/assets\/season-winter-stage-[\w-]+\.webp$/, (route) => (blocked ? route.abort() : route.fallback()));
  const served: string[] = [];
  page.on('response', (r) => {
    if (/\/season-winter-stage-1-/.test(r.url()) && r.ok()) served.push(r.url());
  });
  await openApp(page, 'maison');
  // Le moteur démarre sur la base du stade : canvas visible, plus de flou seul.
  const canvas = page.locator('.living-forest canvas').first();
  await expect(canvas).toHaveCSS('opacity', '1', { timeout: 20_000 });
  // L'image fixe s'est rabattue sur la base, elle aussi.
  await expect(page.locator('.living-forest img[src*="/stage-1-"]')).toHaveCount(1);
  expect(served).toEqual([]);

  blocked = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => served.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(canvas).toHaveCSS('opacity', '1');
});

test('bandeau : automne → hiver sans repasser par la base', async ({ page, context }) => {
  await page.clock.setFixedTime(AUTUMN);
  await saveData(page);
  // Bandeau d'hiver lent : la transition dure.
  await context.route(/\/assets\/season-budget-winter-landscape-[\w-]+\.webp$/, async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.fallback();
  });
  await openApp(page, 'budget');
  const autumn = page.locator('img.app-world__banner[data-universe="budget"][data-season="autumn"]');
  await expect(autumn).toHaveClass(/is-ready/);
  await expect(page.locator('img.app-world__img--budget[data-season="base"]')).toHaveCount(0);

  // Toute apparition de la base pendant la transition est notée.
  await page.evaluate(() => {
    const w = window as unknown as { baseSeen: number };
    w.baseSeen = 0;
    new MutationObserver(() => {
      if (document.querySelector('img.app-world__img--budget[data-season="base"]')) w.baseSeen += 1;
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });

  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await sheet(page, 'Réglages').getByRole('switch', { name: 'Mode développeur' }).click();
  await page.keyboard.press('Escape');
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  await sheet(page, 'Mode développeur').locator('fieldset', { hasText: 'Saison' }).getByRole('button', { name: 'Hiver' }).click();
  await page.keyboard.press('Escape');
  await goTo(page, 'Budget');

  // Pendant le chargement : l'automne reste en vigueur, visible.
  await expect(autumn).toHaveCSS('opacity', '1');
  const winter = page.locator('img.app-world__banner[data-universe="budget"][data-season="winter"]');
  await expect(winter).toHaveClass(/is-ready/, { timeout: 15_000 });
  await expect(winter).not.toHaveClass(/is-instant/);
  // Après le fondu, l'automne quitte le DOM ; la base n'est jamais apparue.
  await expect(page.locator('img.app-world__img--budget[data-season="autumn"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { baseSeen: number }).baseSeen)).toBe(0);
});
