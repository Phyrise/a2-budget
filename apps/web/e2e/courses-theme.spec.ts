/**
 * Univers Kiki de l'écran Courses : liste vide illustrée, bonjour du jour,
 * coup de balai vers le panier, Jiji et le remplissage du panier, retour
 * depuis le panier, envol de Kiki, mouvement réduit.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, persisted, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function quickAdd(page: Page, ...texts: string[]) {
  const input = page.locator('#grocery-input');
  for (const text of texts) {
    await input.fill(text);
    await input.press('Enter');
    await expect(input).toHaveValue('');
  }
}

const stage = (page: Page) => page.locator('.basket-stage');
const basketRows = (page: Page) => page.locator('.item-list--basket .item-row');
const aisleRow = (page: Page, label: string) => page.locator('.aisles .item-row').filter({ hasText: label });

test.describe('Courses — univers Kiki', () => {
  test('liste vide : Kiki et sa liste, Jiji endormi', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'courses');
    await expect(page.getByText('La liste est vide')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qu’il nous faut ?' })).toBeVisible();
    await expect(page.locator('.kiki-empty__kiki')).toBeVisible();
    await expect(page.locator('.kiki-empty__jiji')).toBeVisible();
    // Le champ d'ajout rapide reste le premier geste possible.
    await expect(page.locator('#grocery-input')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('coup de balai : l’article file vers le panier, Jiji réagit', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'courses');
    await quickAdd(page, 'Courgettes', 'Lait', 'Baguette');

    // Rayons illustrés, panier vide avec Jiji dedans.
    await expect(page.locator('.aisle__icon')).toHaveCount(3);
    await expect(stage(page)).toHaveAttribute('data-fill', 'empty');
    await expect(stage(page)).toHaveAttribute('data-pose', /inBasket|inBag/);

    await page.getByRole('checkbox', { name: 'Courgettes', exact: true }).click();
    // Pendant le coup de balai : Kiki passe sur la ligne, encore dans son rayon.
    const sweeping = aisleRow(page, 'Courgettes');
    await expect(sweeping).toHaveClass(/is-sweeping/);
    await expect(sweeping.locator('.sweep-fx__kiki')).toBeAttached();
    // L'état est écrit tout de suite (cocher reste instantané).
    await expect.poll(async () => (await persisted(page)).groceries.items.find((i: any) => i.label === 'Courgettes')?.done).toBe(true);

    // Puis l'article est dans le panier, qui se remplit ; Jiji saute dans le sac.
    await expect(aisleRow(page, 'Courgettes')).toHaveCount(0);
    await expect(basketRows(page)).toHaveCount(1);
    await expect(stage(page)).toHaveAttribute('data-fill', 'half');
    await expect(stage(page)).toHaveAttribute('data-pose', 'inBag');
    await expect(page.locator('.basket-head__line')).toHaveText('Plus que 2 articles à trouver.');
    // Puis, au repos, sa tasse de thé.
    await expect(stage(page)).toHaveAttribute('data-pose', 'teacup', { timeout: 4_000 });

    // Tout cocher : Jiji s'assoit sur le panier plein, Kiki tient le panier.
    await page.getByRole('checkbox', { name: 'Lait', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Baguette', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(3);
    await expect(stage(page)).toHaveAttribute('data-fill', 'full');
    await expect(stage(page)).toHaveAttribute('data-pose', 'onBasket');
    await expect(page.locator('.kiki-done')).toContainText('Tout est dans le panier');
    expect(errors).toEqual([]);
  });

  test('décocher depuis le panier ramène l’article dans son rayon', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Pommes', 'Riz');
    await page.getByRole('checkbox', { name: 'Pommes', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(1);

    await basketRows(page).getByRole('checkbox', { name: 'Pommes' }).click();
    await expect(basketRows(page)).toHaveCount(0);
    const back = aisleRow(page, 'Pommes');
    await expect(back).toHaveCount(1);
    await expect(back.locator('.sweep-fx__broom')).toBeAttached();
    await expect(back).not.toHaveClass(/is-returning/);
    await expect(stage(page)).toHaveAttribute('data-fill', 'empty');
  });

  test('vider le panier : Kiki s’envole, puis le message', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Café', 'Thé');
    await page.getByRole('checkbox', { name: 'Café', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Vider le panier', exact: true }).click();
    await expect(page.locator('.kiki-flight')).toBeVisible();
    await expect(page.locator('.kiki-flight')).toHaveAttribute('aria-hidden', 'true');
    await expect(basketRows(page)).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('1 article rangé dans l’historique');
    await expect(page.locator('.kiki-flight')).toHaveCount(0);
    await expect.poll(async () => (await persisted(page)).groceries.history.length).toBe(1);
  });

  test('Kiki dit bonjour une fois par jour', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Farine');
    await page.reload();
    const hello = page.getByRole('complementary', { name: 'Bonjour de Kiki' });
    await expect(hello).toBeVisible();
    await expect(hello).toContainText('1 article sur la liste');
    await hello.getByRole('button', { name: 'Fermer le bonjour de Kiki' }).click();
    await expect(hello).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.aisles')).toBeVisible();
    await expect(page.locator('.kiki-hello')).toHaveCount(0);
  });

  test('mouvement réduit : fondu simple, sans Kiki balayeuse', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, 'courses');
    await quickAdd(page, 'Savon', 'Éponges');
    await page.getByRole('checkbox', { name: 'Savon', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Vider le panier', exact: true }).click();
    await expect(page.locator('.kiki-flight--still')).toBeAttached();
    await expect(page.locator('.toast')).toContainText('rangé dans l’historique');
  });

  test('suggestions illustrées par rayon', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Bananes');
    await page.getByRole('checkbox', { name: 'Bananes', exact: true }).click();
    await expect(basketRows(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Vider le panier', exact: true }).click();
    const suggestion = page.getByRole('button', { name: 'Ajouter Bananes', exact: true });
    await expect(suggestion).toBeVisible();
    const icon = suggestion.locator('.suggestions__icon');
    await expect(icon).toBeVisible();
    await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  });
});
