import { expect, test } from '@playwright/test';
import { APP, PHONE, UI_KEY, goTo, nav, openApp, persisted, sheet, trackErrors } from './helpers';

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
  await expect(modules.getByRole('button')).toHaveCount(4);
  await expect(modules.getByRole('button', { name: 'Calendrier', exact: true })).toBeVisible();
  await expect(modules.getByRole('button', { name: 'Maison', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: /Aujourd’hui/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Historique de la maison', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réglages', exact: true })).toBeVisible();
  // Aucun appel réseau hors de l'origine, rien dans l'URL sauf ?module=.
  expect(new URL(page.url()).search).toBe('');
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('lune de l’en-tête : pause annulable, soleil pour réveiller ; réglage « Maison en pause »', async ({ page }) => {
  await openApp(page);
  const header = page.locator('.app-header');
  await header.getByRole('button', { name: 'Mettre la maison en pause', exact: true }).click();
  await expect.poll(async () => (await persisted(page)).forest.paused).toBe(true);
  await expect(header.getByRole('button', { name: 'Réveiller la forêt', exact: true })).toBeVisible();

  // Confirmation douce : le message propose d'annuler.
  await page.locator('.toast').getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect.poll(async () => (await persisted(page)).forest.paused).toBe(false);
  await expect(header.getByRole('button', { name: 'Mettre la maison en pause', exact: true })).toBeVisible();

  await header.getByRole('button', { name: 'Mettre la maison en pause', exact: true }).click();
  await expect.poll(async () => (await persisted(page)).forest.paused).toBe(true);
  await header.getByRole('button', { name: 'Réveiller la forêt', exact: true }).click();
  await expect.poll(async () => (await persisted(page)).forest.paused).toBe(false);

  // Le même réglage dans les Réglages.
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = sheet(page, 'Réglages');
  const toggle = settings.getByRole('switch', { name: 'Maison en pause' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await persisted(page)).forest.paused).toBe(true);
  await toggle.click();
  await expect.poll(async () => (await persisted(page)).forest.paused).toBe(false);
});

test.describe('Clavier virtuel (écran tactile)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

  test('la navigation s’efface clavier ouvert et revient dès qu’il se ferme, même si le champ garde le focus', async ({ page }) => {
    await openApp(page, 'courses');
    const dock = page.locator('.app-dock');
    const input = page.locator('#grocery-input');

    // Focus puis blur : la barre reste visible.
    await input.focus();
    await expect(dock).toHaveCSS('opacity', '1');
    await input.blur();
    await expect(dock).toHaveCSS('opacity', '1');

    // Clavier ouvert : la zone visible rétrécit nettement.
    await input.focus();
    await page.setViewportSize({ width: PHONE.width, height: 480 });
    await expect(page.locator('.app')).toHaveClass(/app--keyboard/);
    await expect(dock).toHaveCSS('opacity', '0');

    // Clavier fermé (cas iPhone : le champ garde le focus) : la barre revient.
    await page.setViewportSize(PHONE);
    await expect(input).toBeFocused();
    await expect(page.locator('.app')).not.toHaveClass(/app--keyboard/);
    await expect(dock).toHaveCSS('opacity', '1');
    await nav(page).getByRole('button', { name: 'Maison', exact: true }).click();
    await expect(nav(page).getByRole('button', { name: 'Maison', exact: true })).toHaveAttribute('aria-current', 'page');
  });
});

test('4ᵉ onglet Calendrier : ?module=calendar, bandeau de la forêt, historique des événements passés', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(`${APP}?module=calendar`);
  await expect(nav(page).getByRole('button', { name: 'Calendrier', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#calendar-title')).toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/app--calendar/);
  await expect(page.locator('.app-world__banner[data-universe="calendar"]')).toHaveClass(/is-shown/);
  await page.getByRole('button', { name: 'Événements passés', exact: true }).click();
  await expect(sheet(page, 'Événements passés').getByText('Aucun événement passé')).toBeVisible();
  await page.keyboard.press('Escape');

  // Chaque univers a son bandeau peint et son accent.
  await goTo(page, 'Budget');
  await expect(page.locator('.app-world__banner[data-universe="budget"]')).toHaveClass(/is-shown/);
  await expect(page.locator('.app-world__banner[data-universe="calendar"]')).not.toHaveClass(/is-shown/);
  await goTo(page, 'Courses');
  await expect(page.locator('.app-world__banner[data-universe="courses"]')).toHaveClass(/is-shown/);
  const ui = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), UI_KEY);
  expect(ui.module).toBe('courses');
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('pilule à quatre entrées lisible à 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openApp(page);
  const fit = await page.evaluate(() => {
    const el = document.querySelector('.app-nav')!.getBoundingClientRect();
    const clipped = [...document.querySelectorAll('.app-nav__label')].filter((l) => l.scrollWidth > l.clientWidth + 0.5);
    return el.left >= 0 && el.right <= window.innerWidth && clipped.length === 0;
  });
  expect(fit).toBe(true);
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
