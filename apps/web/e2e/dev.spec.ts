import { expect, test } from '@playwright/test';
import { STORAGE_KEY, PHONE, UI_KEY, openApp, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

/**
 * Mode développeur (V3.2) : interrupteur dans Réglages › À propos, bouton
 * « DEV » discret, panneau des valeurs cachées, aperçus NON PERSISTANTS de
 * la forêt (bandeau « Aperçu »), tout effacé en quittant le mode.
 */
test('mode développeur : panneau, aperçus non persistants, remise à zéro en quittant', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  const header = page.locator('.app-header');
  await expect(header.getByRole('button', { name: 'Mode développeur' })).toHaveCount(0);

  // Activer dans Réglages › À propos (préférence d'interface).
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = sheet(page, 'Réglages');
  const toggle = settings.getByRole('switch', { name: 'Mode développeur' });
  await expect(settings.getByText(/régler l’app pendant sa création/)).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').devMode, UI_KEY)).toBe(true);
  await page.keyboard.press('Escape');

  // Le panneau : chiffres cachés et constantes.
  await header.getByRole('button', { name: 'Mode développeur' }).click();
  const dev = sheet(page, 'Mode développeur');
  await expect(dev.getByText('La forêt, en chiffres')).toBeVisible();
  await expect(dev.getByText('1 / 7')).toBeVisible();
  for (const name of ['DAILY_CREDIT_CAP', 'VITALITY_PER_CREDIT', 'DAILY_DECAY', 'INACTIVITY_GRACE_DAYS', 'GUARDIAN_STREAK', 'VITALITY_STATE_THRESHOLDS', 'WEEKLY_GOAL_LEVELS']) {
    await expect(dev.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(dev.getByText('Objectif de la semaine')).toBeVisible();
  await expect(dev.getByText('Partage de la semaine')).toBeVisible();

  // Aperçu : stade 5, la forêt change, les données non.
  const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  await dev.locator('fieldset', { hasText: 'Stade' }).getByRole('button', { name: '5', exact: true }).click();
  await expect(dev.locator('fieldset', { hasText: 'Stade' }).getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dev.getByRole('button', { name: 'Voir la forêt' }).click();
  await expect(page.getByText('Aperçu — vos données ne changent pas')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(before);
  await page.getByRole('button', { name: 'Revenir à la vraie forêt' }).click();
  await expect(page.locator('.preview-banner')).toHaveCount(0);

  // Quitter le mode : bouton et aperçu disparaissent.
  await header.getByRole('button', { name: 'Mode développeur' }).click();
  await dev.locator('fieldset', { hasText: 'Saison' }).getByRole('button', { name: 'Hiver' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.preview-banner')).toBeVisible();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await settings.getByRole('switch', { name: 'Mode développeur' }).click();
  await page.keyboard.press('Escape');
  await expect(header.getByRole('button', { name: 'Mode développeur' })).toHaveCount(0);
  await expect(page.locator('.preview-banner')).toHaveCount(0);
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('objectif de la semaine : carte bienveillante, sans chiffre', async ({ page }) => {
  await openApp(page);
  const card = page.locator('.weekly-goal');
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole('heading', { name: 'Objectif de la semaine' })).toBeVisible();
  await expect(card).toContainText(/La forêt (se repose|va bien|s’épanouit)/);
  await expect(card).toContainText('trois soins par jour');
  expect(await card.innerText()).not.toMatch(/\d/);
});
