/**
 * Noiraudes vivantes du Budget (dessinées par le code) : le panneau DEV en
 * fait venir une, la toucher l'attrape (+1 au compteur, +1 kompeitō) ;
 * toutes s'attrapent (porteuses comprises, au doigt) ; les kompeitō lâchés
 * (du bocal ou par le panneau DEV) sont TOUS ramassés. Une égarée peut aussi
 * apparaître dans Courses. Jeu hors AppState.
 */
import { expect, test, type Page } from '@playwright/test';
import { UI_KEY, openApp, sheet, trackErrors } from './helpers';
import { sootActors, tapNoiraude, treats } from './soot';

const SHOTS = process.env.NOIRAUDES_SHOTS;
const stage = (page: Page, screen = 'budget') => page.locator(`.soot-stage[data-screen="${screen}"]`);

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
  await expect(stage(page)).toHaveAttribute('data-stray', '1', { timeout: 6_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vivantes-perchee.png`, scale: 'css' });
  await expect.poll(async () => (await sootActors(page)).some((a) => a.alpha > 0.6)).toBe(true);
  await tapNoiraude(page, 'stray');
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
  await expect(stage(page, 'courses')).toHaveAttribute('data-stray', '1', { timeout: 6_000 });
});

/** Glisse un kompeitō du bocal jusqu'à (dx, dy) du bocal, puis le lâche. */
async function dropTreat(page: Page, dx: number, dy: number) {
  const jar = page.getByTestId('konpeito-jar');
  const box = (await jar.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6);
  await page.mouse.up();
}

test('trois kompeitō lâchés coup sur coup : tous ramassés, aucune Noiraude ne reste figée', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page, 'budget');
  const count = page.getByTestId('konpeito-count');
  await expect(count).toHaveText('20');
  await page.getByTestId('konpeito-jar').scrollIntoViewIfNeeded();
  await dropTreat(page, -150, 90);
  await dropTreat(page, -40, 160);
  await dropTreat(page, -230, 200);
  await expect(count).toHaveText('17');
  // Bien avant que les bonbons délaissés ne s'effacent (14 s) : tous ramassés, aucun effacé.
  await expect.poll(() => treats(page), { timeout: 12_000 }).toEqual({ picked: 3, expired: 0, down: 0 });
  // Puis le troupeau se disperse (personne ne reste planté là).
  await expect(stage(page)).not.toHaveAttribute('data-herd', /./, { timeout: 12_000 });
  expect(errors).toEqual([]);
});

test('DEV → trois kompeitō tombés du ciel : tous ramassés', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page, 'budget');
  await devCall(page, 'Une Noiraude');
  await expect(stage(page)).toHaveAttribute('data-stray', '1', { timeout: 6_000 });
  await devCall(page, 'Trois kompeitō');
  // La vagabonde et des Noiraudes venues du bord (au plus 8) s'en chargent.
  await expect(stage(page)).toHaveAttribute('data-herd', /\d/, { timeout: 6_000 });
  await expect.poll(() => treats(page), { timeout: 12_000 }).toEqual({ picked: 3, expired: 0, down: 0 });
  expect((await sootActors(page)).filter((a) => a.role === 'herd').length).toBeLessThanOrEqual(8);
  // Gratuits (DEV) : le bocal n'a pas bougé.
  await expect(page.getByTestId('konpeito-count')).toHaveText('20');
  expect(errors).toEqual([]);
});

test.describe('au doigt', () => {
  test.use({ hasTouch: true });

  test('toucher une porteuse en chemin (à côté d’elle, zone généreuse) : attrapée, compteur +1', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'budget');
    await devCall(page, 'Des porteuses');
    await expect(stage(page)).toHaveAttribute('data-porter', /\d/, { timeout: 6_000 });
    // Elle marche : on la vise là où elle est au moment du toucher, à 16 px de son centre.
    await expect(async () => {
      const a = (await sootActors(page)).find((v) => v.role === 'porter' && !v.caught && v.alpha > 0.6);
      expect(a).toBeDefined();
      await page.touchscreen.tap(a!.x + 16, a!.y);
      await expect(page.getByTestId('susu-count')).toHaveText('Noiraudes attrapées\u00a0: 1', { timeout: 1_500 });
    }).toPass({ timeout: 8_000 });
    await expect(page.getByTestId('konpeito-count')).toHaveText('21');
    expect(errors).toEqual([]);
  });

  test('un doigt qui glisse sur une Noiraude fait défiler la page, sans l’attraper', async ({ page }) => {
    await openApp(page, 'budget');
    await devCall(page, 'Une Noiraude');
    await expect(stage(page)).toHaveAttribute('data-stray', '1', { timeout: 6_000 });
    await expect.poll(async () => (await sootActors(page)).some((a) => a.alpha > 0.6)).toBe(true);
    const a = (await sootActors(page)).find((v) => v.role === 'stray')!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const before = await page.evaluate(() => window.scrollY);
    await touch('touchStart', a.x, a.y);
    for (let i = 1; i <= 8; i++) await touch('touchMove', a.x, a.y - i * 12);
    await touch('touchEnd');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await expect(page.getByTestId('susu-count')).toHaveCount(0);
  });
});
