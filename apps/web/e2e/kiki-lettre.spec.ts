/**
 * V5.10 — Kiki apporte la lettre : traversée du haut de l'écran, enveloppe
 * pendue à sa main, puis départ ; jamais en « Immobile » ni en mouvement
 * réduit. Par l'aperçu DEV (une vraie lettre demande deux téléphones :
 * scripts/qa-sync.mjs). Le déclenchement lui-même : kikiDelivery.test.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, UI_KEY, goTo, openApp, trackErrors } from './helpers';
import { openDev } from './devPanel';

test.use({ viewport: PHONE });

async function openWith(page: Page, forestMotion: 'full' | 'still', module: 'maison' | 'courses' = 'maison') {
  await page.addInitScript(
    ({ key, ui }) => localStorage.setItem(key, ui),
    { key: UI_KEY, ui: JSON.stringify({ module, devMode: true, forestMotion, offlineAnnounced: true }) },
  );
  await openApp(page, module);
}

async function previewKiki(page: Page) {
  const dev = await openDev(page, 'Aperçus et sons');
  await dev.getByRole('button', { name: 'Kiki apporte une lettre' }).click();
}

test('Kiki traverse avec l’enveloppe, sans bloquer les touchers, puis s’en va', async ({ page }) => {
  const errors = trackErrors(page);
  await openWith(page, 'full', 'courses');
  await previewKiki(page);
  const kiki = page.getByTestId('kiki-post');
  await expect(kiki).toBeVisible();
  await expect(kiki.locator('.envelope')).toHaveCount(1);
  await expect(kiki.locator('.kiki-post__kiki')).toHaveAttribute('src', /kiki-flying/);
  expect(await kiki.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  // Les onglets restent touchables pendant le vol.
  await goTo(page, 'Maison');
  await expect(page.locator('.app--maison')).toHaveCount(1);
  await expect(kiki).toHaveCount(0, { timeout: 6000 });
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('Forêt « Immobile » : pas de traversée', async ({ page }) => {
  const errors = trackErrors(page);
  await openWith(page, 'still');
  await previewKiki(page);
  await page.waitForTimeout(900);
  await expect(page.getByTestId('kiki-post')).toHaveCount(0);
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('mouvement réduit : pas de traversée', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWith(page, 'full');
  await previewKiki(page);
  await page.waitForTimeout(900);
  await expect(page.getByTestId('kiki-post')).toHaveCount(0);
});
