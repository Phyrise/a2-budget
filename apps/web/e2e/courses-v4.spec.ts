/**
 * Courses V4 (retours d'Arthur) : cocher un article ne fait plus « zoomer »
 * le bandeau du haut (le coup de balai ne déborde plus de l'écran, la page
 * ne s'élargit pas) ; le rayon choisi à la main est retenu pour les
 * prochains ajouts du même article, et l'app le dit.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

async function quickAdd(page: Page, text: string) {
  const input = page.locator('#grocery-input');
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

const aisleOf = (page: Page, label: string) =>
  page.locator('.aisle').filter({ has: page.locator('.item-row', { hasText: label }) }).locator('.aisle__title');

test.describe('Courses V4', () => {
  test('cocher : la page ne s’élargit pas, le bandeau garde sa taille', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'pommes');
    await quickAdd(page, 'lait');
    await page.evaluate(() => {
      const w = window as unknown as { __widths: number[] };
      w.__widths = [];
      const t0 = performance.now();
      const loop = () => {
        const banner = document.querySelector('.app-world__banner');
        w.__widths.push(Math.max(document.documentElement.scrollWidth, Math.round(banner?.getBoundingClientRect().width ?? 0)));
        if (performance.now() - t0 < 900) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await page.getByRole('checkbox', { name: 'Pommes' }).click();
    await page.waitForTimeout(1000);
    const widths = await page.evaluate(() => (window as unknown as { __widths: number[] }).__widths);
    expect(widths.length).toBeGreaterThan(5);
    expect(Math.max(...widths)).toBeLessThanOrEqual(PHONE.width);
  });

  test('changer le rayon d’un article : retenu pour les prochains ajouts', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'café');
    await page.getByRole('button', { name: 'Modifier Café' }).click();
    const dialog = sheet(page, 'Modifier l’article');
    await expect(dialog).toBeVisible();
    await dialog.locator('#item-category').selectOption({ label: 'Boissons' });
    await expect(dialog.locator('#item-category-hint')).toHaveText('Je m’en souviendrai pour les prochaines fois.');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.toast')).toContainText('Je m’en souviendrai');
    await expect(aisleOf(page, 'Café')).toContainText('Boissons');

    // Retiré puis rajouté : il revient dans « Boissons ».
    await page.getByRole('button', { name: 'Retirer Café' }).click();
    await quickAdd(page, 'café');
    await expect(aisleOf(page, 'Café')).toContainText('Boissons');
    const state = await persisted(page);
    expect(state.groceries.categoryMemory).toMatchObject({ cafe: 'boissons' });
  });
});
