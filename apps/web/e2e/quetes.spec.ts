/**
 * V5.1 — quêtes communes en invité (mode développeur) : apparition locale,
 * AL aide (effet partiel + tête de Jiji), AC touche l'objet (fête, +3
 * kompeitō), puis la trace « À deux » dans le Carnet. Aucune quête du
 * calendrier en invité.
 */
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, UI_KEY, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function openDev(page: Page) {
  await page.addInitScript(
    ({ ui }) => {
      if (sessionStorage.getItem('quetes-seeded')) return;
      localStorage.setItem(ui, JSON.stringify({ module: 'budget', forestMotion: 'still', offlineAnnounced: true, devMode: true }));
      sessionStorage.setItem('quetes-seeded', '1');
    },
    { ui: UI_KEY },
  );
  await page.goto(`${APP}?module=budget`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

const jar = (page: Page) => page.locator('[aria-label^="Bocal de kompeitō"]').first();
const jarCount = async (page: Page) => Number((await jar(page).getAttribute('aria-label'))?.match(/(\d+)/)?.[1] ?? 'NaN');

test('quête à deux en invité : apparition, deux aides, fête, Carnet', async ({ page }) => {
  const errors = trackErrors(page);
  await openDev(page);
  // Rien en invité sans le mode développeur.
  await expect(page.locator('.quest')).toHaveCount(0);
  const before = await jarCount(page);

  const dev = page.getByRole('dialog', { name: 'Mode développeur' });
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  await dev.getByRole('button', { name: 'Rocher (Budget)' }).click();
  const quest = page.locator('.screen-sheet.budget .quest');
  await expect(quest).toHaveAttribute('data-status', 'waiting');
  await expect(quest.locator('.quest__head')).toHaveCount(0);

  // AL aide (panneau) : effet partiel, tête de Jiji.
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  await dev.getByRole('button', { name: 'Aide AL' }).click();
  await expect(quest).toHaveAttribute('data-status', 'half');
  await expect(quest.locator('.quest__head--a')).toHaveCount(1);

  // AC touche l'objet : réglée, fête, +3 kompeitō, puis l'objet s'en va.
  await quest.click();
  await expect(quest).toHaveAttribute('data-status', 'done');
  await expect(quest.locator('.quest__head')).toHaveCount(2);
  await expect(quest.locator('.quest__spark')).toHaveCount(6);
  await expect.poll(() => jarCount(page)).toBe(before + 3);
  await expect(page.locator('.quest')).toHaveCount(0, { timeout: 8000 });

  // La trace « À deux » dans le Carnet (Maison › rituels).
  await page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name: 'Maison', exact: true }).click();
  await page.locator('section.rituals').getByRole('button', { name: 'Carnet de la forêt' }).click();
  const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
  await expect(carnet.getByRole('heading', { name: 'À deux' })).toBeVisible();
  await expect(carnet.locator('.carnet-together__item')).toHaveCount(1);
  await expect(carnet.locator('.carnet-together__item .quest-art--rocher')).toHaveCount(1);

  // Recharger ne redonne ni la fête ni les kompeitō.
  await page.reload();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  await expect(page.locator('.quest')).toHaveCount(0);
  expect(errors).toEqual([]);
});
