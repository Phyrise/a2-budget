/**
 * Compagnons V4.3 — interactions « inutiles » : Calcifer et Jiji touchables
 * (réaction, colère / bouderie après une rafale), Totoro endormi qui bâille,
 * coup de patte de Jiji aux Courses. Aucun nouveau bouton ne prend les clics
 * des contrôles existants. Contre le build de production (`pnpm preview`).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PHONE, openApp } from './helpers';

test.use({ viewport: PHONE });

/** Le centre du contrôle est bien à lui (aucun calque par-dessus). */
async function ownsItsCenter(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('button')?.getAttribute('aria-label') ?? null, [
    box.x + box.width / 2,
    box.y + box.height / 2,
  ]);
  expect(hit).toBe(await target.getAttribute('aria-label'));
}

test.describe('Compagnons V4.3', () => {
  test('Maison : Calcifer crépite, s’énerve après une rafale, puis se calme', async ({ page }) => {
    await openApp(page, 'maison');
    const calcifer = page.locator('.perch').getByRole('button', { name: 'Taquiner Calcifer' });
    const jiji = page.locator('.perch').getByRole('button', { name: 'Caresser Jiji' });
    await expect(calcifer).toBeVisible();
    await expect(jiji).toBeVisible();

    // Les compagnons ne recouvrent pas « Ajouter une tâche ».
    await ownsItsCenter(page, page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first());
    await ownsItsCenter(page, calcifer);

    await calcifer.click();
    await expect(calcifer).toHaveClass(/is-poke/);
    await expect(calcifer).not.toHaveClass(/is-poke/, { timeout: 3000 });

    // Quatre touchers rapides (moins de 2 s).
    const box = (await calcifer.boundingBox())!;
    for (let i = 0; i < 4; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(calcifer).toHaveClass(/is-upset/);
    await expect(calcifer.locator('.companion__smoke')).toHaveCount(1);
    // Pendant la colère, rien ne la relance.
    await calcifer.click();
    await expect(calcifer).not.toHaveClass(/is-upset/, { timeout: 5000 });

    await jiji.click();
    await expect(jiji).toHaveClass(/is-poke/);
  });

  test('Calendrier : Totoro endormi bâille, une fois, puis se rendort', async ({ page }) => {
    await openApp(page, 'calendar');
    const totoro = page.getByRole('button', { name: 'Chatouiller Totoro' }).first();
    await expect(totoro).toBeVisible();
    await ownsItsCenter(page, page.locator('.cal-add'));
    await totoro.click();
    await expect(totoro).toHaveClass(/is-yawning/);
    await totoro.click();
    await expect(totoro.locator('.cal-totoro__bubble')).toHaveCount(1);
    await expect(totoro).not.toHaveClass(/is-yawning/, { timeout: 5000 });
  });

  test('Courses : Jiji donne un coup de patte quand un article file vers le panier', async ({ page }) => {
    await openApp(page, 'courses');
    await page.locator('#grocery-input').fill('lait');
    await page.keyboard.press('Enter');
    await page.locator('#grocery-input').fill('pain');
    await page.keyboard.press('Enter');
    await page.getByRole('checkbox', { name: /lait/i }).first().click();
    await expect
      .poll(() => page.evaluate(() => document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.target?.classList.contains('basket-stage__jiji') && !('animationName' in a))))
      .toBe(true);
  });

  test('mouvement réduit : la pose change, rien ne bouge', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, 'maison');
    const calcifer = page.locator('.perch').getByRole('button', { name: 'Taquiner Calcifer' });
    await calcifer.click();
    await expect(calcifer).toHaveClass(/is-calm/);
    const animated = await calcifer.evaluate((el) => getComputedStyle(el.querySelector('.companion__poke')!).animationName);
    expect(animated).toBe('none');
  });
});
