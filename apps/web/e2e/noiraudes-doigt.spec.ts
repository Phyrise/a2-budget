/**
 * Noiraudes au doigt, sur téléphone (Arthur : « des fois le bonbon
 * n'apparaît pas, des fois elles sont bloquées, j'ai du mal à cliquer sur
 * elles ») : écran tactile 390 × 844, densité 3, processeur ralenti ×4, et
 * de vrais gestes tactiles (CDP) — pas la souris.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { UI_KEY, openApp, trackErrors } from './helpers';
import { sootActors, treats } from './soot';
import { openDev } from './devPanel';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem(key, JSON.stringify({ devMode: true }));
      sessionStorage.setItem('seeded', '1');
    }
  }, UI_KEY);
});

type Touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => Promise<unknown>;

/** Téléphone lent : processeur ×4 ; rend un doigt (événements tactiles bruts). */
async function slowPhone(page: Page): Promise<Touch> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return (type, x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
}

async function devCall(page: Page, label: string) {
  await (await openDev(page, 'Noiraudes')).getByRole('button', { name: label }).click();
}

/** Glisse au doigt un kompeitō du bocal de (dx, dy), en quelques pas. */
async function fingerTreat(page: Page, touch: Touch, dx: number, dy: number): Promise<void> {
  const box = (await page.getByTestId('konpeito-jar').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await touch('touchStart', x, y);
  for (let i = 1; i <= 8; i++) await touch('touchMove', x + (dx * i) / 8, y + (dy * i) / 8);
  await touch('touchEnd');
}

const fingerCandy = (page: Page) =>
  page.evaluate(() => {
    type D = { loose: Array<{ mode: string; item: { x: number; y: number } }> };
    const d = (document.querySelector('.soot-stage[data-screen="budget"] canvas') as (HTMLCanvasElement & { noiraudes?: D }) | null)?.noiraudes;
    return d?.loose.find((l) => l.mode === 'finger')?.item ?? null;
  });

test('bonbon glissé au doigt : visible au-dessus du doigt, la page ne défile pas, posé puis ramassé', async ({ page }) => {
  const errors = trackErrors(page);
  const touch = await slowPhone(page);
  await openApp(page, 'budget');
  const jar = page.getByTestId('konpeito-jar');
  await jar.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  const box = (await jar.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await touch('touchStart', x, y);
  for (let i = 1; i <= 8; i++) await touch('touchMove', x - i * 18, y + i * 22);
  // Au bout du doigt, au-dessus de lui (pas caché dessous), là où est le doigt.
  const item = await fingerCandy(page);
  expect(item).not.toBeNull();
  expect(Math.abs(item!.x - (x - 144))).toBeLessThan(2);
  expect(y + 176 - item!.y).toBeGreaterThan(30);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await touch('touchEnd');
  await expect(page.getByTestId('konpeito-count')).toHaveText('19');
  await expect.poll(() => treats(page), { timeout: 12_000 }).toEqual({ picked: 1, expired: 0, down: 0 });
  expect(errors).toEqual([]);
});

test('un geste perdu (doigt repris par le navigateur) ne bloque pas le bonbon suivant', async ({ page }) => {
  const touch = await slowPhone(page);
  await openApp(page, 'budget');
  const jar = page.getByTestId('konpeito-jar');
  await jar.scrollIntoViewIfNeeded();
  // Le navigateur reprend le doigt sans pointerup (appel, notification…).
  await jar.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 340, clientY: 450 });
  await jar.dispatchEvent('pointercancel', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  expect(await fingerCandy(page)).toBeNull();
  await fingerTreat(page, touch, -160, 140);
  await expect(page.getByTestId('konpeito-count')).toHaveText('19');
  await expect.poll(() => treats(page), { timeout: 12_000 }).toEqual({ picked: 1, expired: 0, down: 0 });
});

test('toucher une Noiraude qui marche (un peu à côté) : attrapée', async ({ page }) => {
  const errors = trackErrors(page);
  const touch = await slowPhone(page);
  await openApp(page, 'budget');
  await devCall(page, 'Une Noiraude');
  await expect.poll(async () => (await sootActors(page)).some((a) => a.alpha > 0.6), { timeout: 8_000 }).toBe(true);
  await expect(async () => {
    // Elle part se promener : on la touche en route, là où on la voit.
    await page.evaluate(() => {
      type A = { s: { x: number; walkTo(x: number, y: number, o: { speed: number }): void; y: number } };
      const d = (document.querySelector('.soot-stage canvas') as HTMLCanvasElement & { noiraudes: { actors: A[] } }).noiraudes;
      const s = d.actors[0]!.s;
      s.walkTo(s.x < 195 ? 330 : 60, s.y, { speed: 90 });
    });
    await page.waitForTimeout(250);
    const a = (await sootActors(page)).find((v) => !v.caught && v.alpha > 0.6);
    expect(a).toBeDefined();
    await touch('touchStart', a!.x + 18, a!.y + 6);
    await touch('touchMove', a!.x + 21, a!.y + 8);
    await touch('touchEnd');
    await expect(page.getByTestId('susu-count')).toHaveText('Noiraudes attrapées : 1', { timeout: 1_500 });
  }).toPass({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('trois bonbons glissés au doigt, page défilée : tous ramassés, personne ne reste figé', async ({ page }) => {
  const errors = trackErrors(page);
  const touch = await slowPhone(page);
  await openApp(page, 'budget');
  const jar = page.getByTestId('konpeito-jar');
  // Le bocal plus haut dans l'écran : la page a défilé sous la toile.
  await page.evaluate(() => window.scrollTo(0, 60));
  await jar.scrollIntoViewIfNeeded();
  await fingerTreat(page, touch, -150, 120);
  await fingerTreat(page, touch, -40, 200);
  await fingerTreat(page, touch, -260, 240);
  await expect(page.getByTestId('konpeito-count')).toHaveText('17');
  await expect.poll(() => treats(page), { timeout: 13_000 }).toEqual({ picked: 3, expired: 0, down: 0 });
  await expect(page.locator('.soot-stage[data-screen="budget"]')).not.toHaveAttribute('data-herd', /./, { timeout: 12_000 });
  expect(errors).toEqual([]);
});
