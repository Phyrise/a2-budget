/**
 * Avatar de l'autre (V5.2), en invité via le mode développeur (présence
 * simulée en local) : il entre, on le touche (saut + ♡), on le caresse,
 * il fait coucou, il suit l'onglet, puis il sort.
 * Il ne prend pas les clics de la barre du bas. Rien n'est écrit.
 */
import { emptyAppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { PHONE, STORAGE_KEY, UI_KEY, goTo, nav, openApp, sheet, trackErrors } from './helpers';
import { openDev } from './devPanel';

test.use({ viewport: PHONE });

async function devAction(page: Page, name: string) {
  await (await openDev(page, 'Avatar')).getByRole('button', { name }).click();
  await expect(sheet(page, 'Mode développeur')).toBeHidden();
  // Un message éphémère passe au même endroit, au-dessus de lui : on le laisse partir.
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 });
}

test('mode développeur : Jiji entre, saute au toucher, ronronne, fait coucou, puis sort', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ module: 'budget', devMode: true })), UI_KEY);
  await openApp(page);
  const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  const avatar = page.getByTestId('partner-avatar');
  await expect(avatar).toHaveCount(0);

  await devAction(page, 'Faire venir Jiji');
  await expect(avatar).toHaveCount(1);
  // Il entre, puis se pose dans la scène, à l'écran.
  await expect(avatar).not.toHaveAttribute('data-phase', 'enter', { timeout: 8_000 });
  const body = avatar.getByRole('button', { name: 'Coucou à AL' });
  const box = (await body.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);

  // La barre du bas reste à elle : le centre de chaque onglet n'est pas masqué.
  for (const name of ['Budget', 'Maison', 'Courses', 'Calendrier']) {
    const b = (await nav(page).getByRole('button', { name, exact: true }).boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('button')?.textContent ?? '', [
      b.x + b.width / 2,
      b.y + b.height / 2,
    ]);
    expect(hit).toContain(name);
  }

  // Toucher : petit saut + ♡.
  await body.click({ force: true });
  await expect(avatar).toHaveAttribute('data-react', 'hop');
  await expect(page.getByTestId('partner-avatar-heart')).toBeVisible();
  await expect(avatar).toHaveAttribute('data-react', '', { timeout: 4_000 });

  // Caresse : glisser le doigt dessus → il ronronne.
  const p = (await body.boundingBox())!;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  await page.mouse.move(cx - 12, cy);
  await page.mouse.down();
  for (let i = 0; i < 6; i++) await page.mouse.move(cx + (i % 2 === 0 ? 12 : -12), cy, { steps: 3 });
  await page.mouse.up();
  await expect(avatar).toHaveAttribute('data-react', 'purr');
  await expect(page.getByTestId('partner-avatar-heart')).toHaveCount(0);
  await expect(avatar).toHaveAttribute('data-react', '', { timeout: 4_000 });

  // L'autre fait coucou : Jiji fait coucou.
  await devAction(page, 'Il me fait coucou');
  await expect(avatar).toHaveAttribute('data-react', 'wave');

  // Il suit l'onglet (présence simulée).
  await goTo(page, 'Courses');
  await expect(avatar).toHaveCount(1);

  // Il repart : il sort par un bord, puis disparaît.
  await (await openDev(page, 'Avatar')).getByRole('button', { name: 'Le faire repartir' }).click();
  await page.keyboard.press('Escape');
  await expect(avatar).toHaveCount(0, { timeout: 10_000 });

  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(before);
  expect(errors).toEqual([]);
});

test('V5.6 : n’importe quel compagnon peut venir (Hin, sa démarche, son sprite)', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ module: 'maison', devMode: true })), UI_KEY);
  await openApp(page);
  await devAction(page, 'Faire venir Hin');
  const avatar = page.getByTestId('partner-avatar');
  await expect(avatar).toHaveAttribute('data-companion', 'hin');
  await expect(avatar).toHaveAttribute('data-gait', 'waddle');
  await expect(avatar.locator('img').first()).toHaveAttribute('src', /hin-/);
  await expect(avatar.getByRole('button', { name: 'Coucou à AC' })).toBeVisible();
});

test('V5.6 : AC a choisi Hin dans les Réglages → c’est Hin qui vient (sprite hin-*)', async ({ page }) => {
  const errors = trackErrors(page);
  const base = emptyAppState();
  const state = {
    ...base,
    budget: { ...base.budget, settings: { ...base.budget.settings, personB: { ...base.budget.settings.personB, companion: 'hin' as const } } },
  };
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('avatar-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', devMode: true }));
      sessionStorage.setItem('avatar-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(state) },
  );
  await openApp(page);
  await devAction(page, 'Faire venir AC');
  const avatar = page.getByTestId('partner-avatar');
  await expect(avatar).toHaveAttribute('data-companion', 'hin');
  await expect(avatar).toHaveAttribute('data-gait', 'waddle');
  await expect(avatar.locator('img').first()).toHaveAttribute('src', /hin-/);
  // Toucher : il saute quand même (interactions inchangées).
  await avatar.getByRole('button', { name: 'Coucou à AC' }).click({ force: true });
  await expect(avatar).toHaveAttribute('data-react', 'hop');
  expect(errors).toEqual([]);
});

test('calme (mouvement réduit) : Calcifer apparaît posé, sans entrer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ module: 'maison', devMode: true })), UI_KEY);
  await openApp(page);
  await devAction(page, 'Faire venir Calcifer');
  const avatar = page.getByTestId('partner-avatar');
  await expect(avatar).toHaveAttribute('data-phase', 'sit');
  await avatar.getByRole('button', { name: 'Coucou à AC' }).click();
  await expect(avatar).toHaveAttribute('data-react', 'hop');
});
