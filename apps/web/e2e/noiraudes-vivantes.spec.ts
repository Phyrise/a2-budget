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

/** Kompeitō encore au sol (ou en train de tomber) sur la scène du Budget. */
function treatsOnGround(page: Page) {
  return page.evaluate(() => {
    type Scene = { loose: Array<{ item: { kind: string }; mode: string; fading?: boolean }> };
    const c = document.querySelector('.soot-stage[data-screen="budget"] canvas') as (HTMLCanvasElement & { noiraudes?: Scene }) | null;
    const d = c?.noiraudes;
    return d ? d.loose.filter((l) => l.item.kind === 'konpeito' && (l.mode === 'ground' || l.mode === 'fall') && !l.fading).length : -1;
  });
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
  await expect.poll(() => treatsOnGround(page)).toBeGreaterThan(0);
  // Bien avant que les bonbons délaissés ne s'effacent (16 s) : tous ramassés.
  await expect.poll(() => treatsOnGround(page), { timeout: 11_000 }).toBe(0);
  // Puis le troupeau se disperse (personne ne reste planté là).
  await expect(page.locator('.soot-stage[data-screen="budget"]')).not.toHaveAttribute('data-herd', /./, { timeout: 12_000 });
  expect(errors).toEqual([]);
});

test.describe('au doigt', () => {
  test.use({ hasTouch: true });

  test('toucher une porteuse en chemin : attrapée, compteur +1', async ({ page }) => {
    await openApp(page, 'budget');
    await devCall(page, 'Des porteuses');
    const porter = page.getByRole('button', { name: 'Attraper la porteuse' }).first();
    await expect(porter).toBeAttached({ timeout: 6_000 });
    // Elle marche : on vise là où est sa cible (qui la suit) au moment du toucher.
    await expect(async () => {
      const box = (await porter.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('susu-count')).toHaveText('Noiraudes attrapées : 1', { timeout: 1_500 });
    }).toPass({ timeout: 8_000 });
    await expect(page.getByTestId('konpeito-count')).toHaveText('21');
  });

  test('appui long : elle s’enfuit sans être attrapée ; glisser depuis elle : poussée, sans défiler la page', async ({ page }) => {
    await openApp(page, 'budget');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const stray = page.locator('.soot-stage[data-screen="budget"] .susu-stray');

    // Glisser en partant d'elle : elle est poussée, pas attrapée, la page ne défile pas.
    await devCall(page, 'Une Noiraude');
    await expect(stray).toHaveCount(1, { timeout: 6_000 });
    await page.waitForTimeout(500);
    let b = (await stray.boundingBox())!;
    const scroll = await page.evaluate(() => window.scrollY);
    const x0 = b.x + b.width / 2;
    const y0 = b.y + b.height / 2;
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= 4; i++) await touch('touchMove', x0 + i * 14, y0 + i * 3);
    await touch('touchEnd');
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await expect(page.getByTestId('susu-count')).toHaveCount(0);
    await expect(stray).toHaveCount(1);

    // Appui long : elle tremble puis s'enfuit (pas comptée).
    await page.waitForTimeout(600);
    b = (await stray.boundingBox())!;
    await touch('touchStart', b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(900);
    await touch('touchEnd');
    await expect(stray).toHaveCount(0, { timeout: 4_000 });
    await expect(page.getByTestId('susu-count')).toHaveCount(0);
  });
});
