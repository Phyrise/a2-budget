/**
 * Courses V4.2 (retours d'Arthur) : tout au panier → seulement « Tout est
 * dans le panier » (pas de salut de Kiki en plus) ; historique sans
 * doublons (« Pommes ×2 ») ; messages fermables d'une croix ou d'un glissé.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, sheet } from './helpers';

test.use({ viewport: PHONE });

async function quickAdd(page: Page, ...texts: string[]) {
  const input = page.locator('#grocery-input');
  for (const text of texts) {
    await input.fill(text);
    await input.press('Enter');
    await expect(input).toHaveValue('');
  }
}

const basketRows = (page: Page) => page.locator('.item-list--basket .item-row');

/** Glisse le message de `dx`, `dy` pixels à la souris (pointer events). */
async function drag(page: Page, dx: number, dy: number) {
  const box = (await page.locator('.toast').boundingBox())!;
  const x = box.x + 24;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
  await page.mouse.up();
}

test.describe('Courses V4.2', () => {
  test('tout au panier : « Tout est dans le panier », sans salut de Kiki', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Farine');
    await page.getByRole('checkbox', { name: 'Farine', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.kiki-done')).toContainText('Tout est dans le panier');
    await expect(page.locator('.kiki-hello')).toHaveCount(0);
  });

  test('historique : les articles identiques sont combinés', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Pommes', 'Lait');
    await page.getByRole('checkbox', { name: 'Pommes', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(1);
    await quickAdd(page, 'pomme');
    await page.locator('.aisles').getByRole('checkbox', { name: 'Pomme', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Lait', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(3);
    await page.getByRole('button', { name: 'Historique des courses' }).click();
    const entries = sheet(page, 'Historique des courses').locator('.history-entry__title');
    await expect(entries).toHaveCount(2);
    await expect(entries.filter({ hasText: /^Pommes?/ })).toHaveText(/^Pommes? ×2$/);
  });

  test('message : fermé par la croix, ou d’un glissé ; un petit glissé revient', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Riz', 'Thé', 'Sel');
    const toast = page.locator('.toast');

    await page.getByRole('button', { name: 'Retirer Riz' }).click();
    await expect(toast).toContainText('Riz');
    await toast.getByRole('button', { name: 'Fermer' }).click();
    await expect(toast).toHaveCount(0);

    await page.getByRole('button', { name: 'Retirer Thé' }).click();
    await expect(toast).toContainText('Thé');
    await drag(page, 30, 0);
    await expect(toast).toBeVisible();
    await expect.poll(() => toast.evaluate((el) => getComputedStyle(el).translate)).toMatch(/^(none|0px)$/);
    await drag(page, 0, 90);
    await expect(toast).toHaveCount(0);

    // Glissé horizontal : le message part, « Annuler » n'est pas déclenché.
    await page.getByRole('button', { name: 'Retirer Sel' }).click();
    await expect(toast).toContainText('Sel');
    await drag(page, 220, 0);
    await expect(toast).toHaveCount(0);
    await expect(page.locator('.aisles .item-row')).toHaveCount(0);
  });
});
