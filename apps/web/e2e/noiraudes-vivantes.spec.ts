/**
 * Noiraudes vivantes du Budget (dessinées par le code) : le panneau DEV en
 * fait venir une, l'attraper la compte (et donne un kompeitō), et un
 * kompeitō tiré du bocal puis lâché leur est donné (le bocal perd 1).
 * Une égarée peut aussi apparaître dans Courses. Jeu hors AppState.
 */
import { expect, test, type Page } from '@playwright/test';
import { UI_KEY, openApp, sheet, trackErrors } from './helpers';

const SHOTS = process.env.NOIRAUDES_SHOTS;

async function devCall(page: Page, label: string) {
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  await sheet(page, 'Mode développeur').getByRole('button', { name: label }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem(key, JSON.stringify({ devMode: true }));
      sessionStorage.setItem('seeded', '1');
    }
  }, UI_KEY);
});

test('DEV → une Noiraude ; attrapée → compteur ; kompeitō du bocal donné → bocal −1', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page, 'budget');
  const count = page.getByTestId('konpeito-count');
  await expect(count).toHaveText('20');

  await devCall(page, 'Une Noiraude');
  const stray = page.locator('.soot-stage[data-screen="budget"] .susu-stray');
  await expect(stray).toHaveCount(1, { timeout: 6_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vivantes-perchee.png`, scale: 'css' });
  await stray.dispatchEvent('click');
  await expect(page.getByTestId('susu-count')).toHaveText('Noiraudes attrapées : 1');
  await expect(count).toHaveText('21');

  const jar = page.getByTestId('konpeito-jar');
  await jar.scrollIntoViewIfNeeded();
  const box = (await jar.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x - i * 18, y + i * 22);
  await expect(page.locator('.soot-stage').first()).toHaveAttribute('data-herd', /\d/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vivantes-troupeau.png`, scale: 'css' });
  await page.mouse.up();
  await expect(count).toHaveText('20');
  expect(errors).toEqual([]);
});

test('DEV → une égarée dans Courses (même calque, perchoir sûr)', async ({ page }) => {
  await openApp(page, 'budget');
  await devCall(page, 'Égarée dans Courses');
  await expect(page.locator('.soot-stage[data-screen="courses"] .susu-stray')).toHaveCount(1, { timeout: 6_000 });
});
