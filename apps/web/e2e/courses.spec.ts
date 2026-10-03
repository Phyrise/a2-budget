import { expect, test, type Page } from '@playwright/test';
import { PHONE, closeSheet, openApp, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

async function quickAdd(page: Page, text: string) {
  const input = page.locator('#grocery-input');
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
}

const toBuy = (page: Page, label: string) => page.locator('.aisles .item-row').filter({ hasText: label });
const basket = (page: Page) => page.locator('.item-list--basket .item-row');

test.describe('Courses — parcours', () => {
  test('ajouter « 2 pommes », cocher, vider le panier', async ({ page }) => {
    await openApp(page, 'courses');
    await expect(page.getByText('La liste est vide')).toBeVisible();

    await quickAdd(page, '2 pommes');
    const pommes = toBuy(page, 'Pommes');
    await expect(pommes).toBeVisible();
    await expect(pommes.locator('.item-row__qty')).toHaveText('×2');
    await expect(page.locator('.aisle').filter({ has: page.locator('.item-row', { hasText: 'Pommes' }) }).locator('.aisle__title')).toContainText(
      'Fruits & légumes',
    );

    // Doublon d'un article non coché : pas de seconde ligne.
    await quickAdd(page, 'pommes');
    await expect(page.locator('.toast')).toContainText('déjà dans la liste');
    await expect(toBuy(page, 'Pommes')).toHaveCount(1);

    await quickAdd(page, 'lait x2');
    await expect(toBuy(page, 'Lait')).toBeVisible();
    await expect(page.locator('.courses-banner__summary')).toContainText('2 articles à prendre');

    // Cocher : l'article rejoint « Dans le panier ».
    await page.getByRole('checkbox', { name: 'Pommes (×2)' }).click();
    await expect(toBuy(page, 'Pommes')).toHaveCount(0);
    await expect(basket(page)).toHaveCount(1);
    await expect(basket(page)).toContainText('Pommes');

    // Vider le panier : archivé dans l'historique.
    await page.getByRole('button', { name: 'Vider le panier', exact: true }).click();
    await expect(basket(page)).toHaveCount(0);
    await expect.poll(async () => (await persisted(page)).groceries.history.length).toBe(1);

    await page.getByRole('button', { name: 'Historique des courses', exact: true }).click();
    const history = sheet(page, 'Historique des courses');
    await expect(history).toContainText('Pommes');
    await closeSheet(page, 'Historique des courses');

    // Persistance et suggestions : « Pommes » revient en un geste.
    await page.reload();
    await expect(toBuy(page, 'Lait')).toBeVisible();
    const suggestion = page.getByRole('button', { name: 'Ajouter Pommes', exact: true });
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(toBuy(page, 'Pommes')).toBeVisible();
  });

  test('retirer (annulable) et modifier un article', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, '500 g de farine');
    const farine = toBuy(page, 'Farine');
    await expect(farine.locator('.item-row__qty')).toHaveText('500 g');

    await page.getByRole('button', { name: 'Retirer Farine', exact: true }).click();
    await expect(page.locator('.toast')).toContainText('Farine', { timeout: 3_000 });
    await expect(toBuy(page, 'Farine')).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(toBuy(page, 'Farine')).toBeVisible();

    await page.getByRole('button', { name: 'Modifier Farine', exact: true }).click();
    const dialog = sheet(page, 'Modifier l’article');
    await expect(dialog).toBeVisible();
    await dialog.locator('#item-label').fill('Farine de sarrasin');
    await dialog.locator('#item-quantity').fill('1 kg');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(toBuy(page, 'Farine de sarrasin')).toBeVisible();
    await expect(toBuy(page, 'Farine de sarrasin').locator('.item-row__qty')).toContainText('kg');
  });
});
