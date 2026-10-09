import { expect, test } from '@playwright/test';
import { STORAGE_KEY, PHONE, UI_KEY, openApp, sheet, trackErrors } from './helpers';
import { openDev, openDevSection } from './devPanel';

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
  // Rangé en accordéon : tout fermé par défaut, une seule partie ouverte.
  const dev = await openDev(page, 'Chiffres');
  await expect(dev.locator('.dev-fold.is-open')).toHaveCount(1);
  await expect(dev.getByText('La forêt, en chiffres')).toBeVisible();
  await expect(dev.getByText('1 / 7')).toBeVisible();
  for (const name of ['DAILY_CREDIT_CAP', 'VITALITY_PER_CREDIT', 'DAILY_DECAY', 'INACTIVITY_GRACE_DAYS', 'GUARDIAN_STREAK', 'VITALITY_STATE_THRESHOLDS', 'WEEKLY_GOAL_LEVELS']) {
    await expect(dev.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(dev.getByText('Objectif de la semaine')).toBeVisible();
  await expect(dev.getByText('Partage de la semaine')).toBeVisible();

  // Aperçu : stade 5, la forêt change, les données non.
  await openDevSection(page, 'Aperçus et sons');
  await expect(dev.getByRole('button', { name: 'Chiffres', exact: true })).toHaveAttribute('aria-expanded', 'false');
  const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  await dev.locator('fieldset', { hasText: 'Stade' }).getByRole('button', { name: '5', exact: true }).click();
  await expect(dev.locator('fieldset', { hasText: 'Stade' }).getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dev.getByRole('button', { name: 'Voir la forêt' }).click();
  await expect(page.getByText('Aperçu — vos données ne changent pas')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(before);
  await page.getByRole('button', { name: 'Revenir à la vraie forêt' }).click();
  await expect(page.locator('.preview-banner')).toHaveCount(0);

  // Quitter le mode : bouton et aperçu disparaissent (la partie ouverte est retenue).
  await header.getByRole('button', { name: 'Mode développeur' }).click();
  await expect(dev.getByRole('button', { name: 'Aperçus et sons', exact: true })).toHaveAttribute('aria-expanded', 'true');
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

test('mode développeur : rejouer les fêtes sans attendre la date, sans rien écrire', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ module: 'maison', devMode: true })), UI_KEY);
  await openApp(page);
  const header = page.locator('.app-header');
  await expect.poll(async () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').anniversaries, STORAGE_KEY)).toBeTruthy();
  const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);

  const dev = await openDev(page, 'Fêtes');
  await dev.getByRole('button', { name: 'Fête d’AC' }).click();
  await expect(page.getByRole('button', { name: 'Joyeux anniversaire, AC (fermer)' })).toBeVisible();
  await expect(page.locator('.party-cake')).toHaveCount(1);
  await page.getByRole('button', { name: 'Joyeux anniversaire, AC (fermer)' }).click();
  await expect(page.locator('.party')).toHaveCount(0);

  await header.getByRole('button', { name: 'Mode développeur' }).click();
  await dev.getByRole('button', { name: 'Fête du couple' }).click();
  await expect(page.getByText('Aperçu — vos données ne changent pas')).toBeVisible();
  await page.getByRole('button', { name: 'Revenir à la vraie forêt' }).click();
  await expect(page.locator('.preview-banner')).toHaveCount(0);

  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('a2-budget:fetes:v1'))).toBeNull();
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('panneau DEV rangé : accordéon, rien ne déborde à 360 px, cibles ≥ 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ module: 'maison', devMode: true })), UI_KEY);
  await openApp(page);
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = sheet(page, 'Mode développeur');
  await expect(dev.locator('.dev-fold')).toHaveCount(9);
  await expect(dev.locator('.dev-fold.is-open')).toHaveCount(0);
  const titles = await dev.locator('.dev-fold .disclosure__summary').allInnerTexts();
  expect(titles).toEqual(['Quêtes', 'Avatar', 'Compagnons', 'Noiraudes', 'Fêtes', 'Saisons', 'Aperçus et sons', 'Chiffres', 'Remise à zéro']);
  for (const title of titles) {
    await openDevSection(page, title as Parameters<typeof openDevSection>[1]);
    await expect(dev.locator('.dev-fold.is-open')).toHaveCount(1);
    const fit = await dev.locator('.sheet__body').evaluate((body) => {
      const box = body.getBoundingClientRect();
      const open = body.querySelector('.dev-fold.is-open .dev-fold__body') as HTMLElement;
      const wide = [...open.querySelectorAll<HTMLElement>('*')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5);
      });
      const small = [...open.querySelectorAll<HTMLElement>('button')].filter((b) => b.getBoundingClientRect().height < 43.5);
      return { scroll: body.scrollWidth - body.clientWidth, wide: wide.map((el) => el.className || el.tagName), small: small.map((b) => b.textContent) };
    });
    expect(fit, title).toEqual({ scroll: 0, wide: [], small: [] });
  }
  // La dernière ouverte est retenue.
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  await expect(dev.getByRole('button', { name: 'Remise à zéro', exact: true })).toHaveAttribute('aria-expanded', 'true');
});
