import { expect, test } from '@playwright/test';
import { PHONE, UI_KEY, openApp, sheet, trackErrors } from './helpers';
import { openDev } from './devPanel';

test.use({ viewport: PHONE });

/**
 * Essai « 30 images/s » (Réglages › Préférences) : visible seulement quand
 * la forêt est « Vivante », retenu sur l'appareil ; le panneau DEV lit le
 * plafond appliqué au moteur.
 */
test('forêt à 30 images/s : interrupteur sous « Vivante », retenu au rechargement, lu par le DEV', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page, 'maison');
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    return sheet(page, 'Réglages');
  };

  let settings = await openSettings();
  const fps = settings.getByRole('switch', { name: '30 images/s' });
  await expect(fps).toBeVisible();
  await expect(fps).toHaveAttribute('aria-checked', 'false');
  await expect(settings.getByText('Plus léger, un peu moins fluide.')).toBeVisible();

  // « Immobile » : rien à plafonner, l'interrupteur disparaît.
  await settings.getByRole('radio', { name: 'Immobile' }).click();
  await expect(fps).toHaveCount(0);
  await settings.getByRole('radio', { name: 'Vivante' }).click();
  await expect(fps).toBeVisible();

  await fps.click();
  await expect(fps).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').forestFps30, UI_KEY)).toBe(true);

  // Rechargement : toujours coché ; mode développeur pour la lecture en direct.
  await page.evaluate((k) => {
    const ui = JSON.parse(localStorage.getItem(k) ?? '{}');
    localStorage.setItem(k, JSON.stringify({ ...ui, devMode: true }));
  }, UI_KEY);
  await page.reload();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  settings = await openSettings();
  await expect(settings.getByRole('switch', { name: '30 images/s' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();

  // Panneau DEV › Saisons › Rendu : le moteur applique le plafond (« — » sans WebGL).
  const dev = await openDev(page, 'Saisons');
  const render = dev.getByTestId('dev-render');
  await expect(render).toBeVisible();
  const hasEngine = await page.evaluate(() => typeof WebGLRenderingContext !== 'undefined' && document.querySelector('.living-forest canvas') !== null);
  if (hasEngine) await expect(render).toContainText(/\d+ \/ 30/);
  else await expect(render).toContainText('—');
  expect(errors).toEqual([]);
});
