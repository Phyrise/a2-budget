import { expect, test } from '@playwright/test';
import { APP, PHONE, UI_KEY, goTo, nav, openApp, trackErrors } from './helpers';

test.use({ viewport: PHONE });

/**
 * La page de production se charge avec la coquille V2 : monde en fond,
 * en-tête (Historique, Réglages), pilule de navigation, Maison par défaut.
 */
test('la page de production se charge sur Maison', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await expect(page).toHaveTitle('A² Home');
  await expect(page.locator('main#contenu')).toBeVisible();
  await expect(page.locator('.app-world')).toHaveAttribute('aria-hidden', 'true');

  const modules = nav(page);
  await expect(modules.getByRole('button')).toHaveCount(3);
  await expect(modules.getByRole('button', { name: 'Maison', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: /Aujourd’hui/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Historique de la maison', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réglages', exact: true })).toBeVisible();
  // Aucun appel réseau hors de l'origine, rien dans l'URL sauf ?module=.
  expect(new URL(page.url()).search).toBe('');
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('?module= ouvre le module demandé ; le dernier module est mémorisé', async ({ page }) => {
  await openApp(page, 'budget');
  await expect(nav(page).getByRole('button', { name: 'Budget', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#salary-a')).toBeVisible();

  await goTo(page, 'Courses');
  await expect(page.locator('#grocery-input')).toBeVisible();
  // Le titre de l'écran reçoit le focus à chaque changement de module.
  await expect(page.locator('#courses-title')).toBeFocused();

  // Préférences d'interface dans une clé distincte des données.
  const ui = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), UI_KEY);
  expect(ui.module).toBe('courses');

  await page.goto(APP);
  await expect(nav(page).getByRole('button', { name: 'Courses', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#grocery-input')).toBeVisible();
});
