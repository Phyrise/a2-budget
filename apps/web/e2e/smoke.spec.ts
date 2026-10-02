import { expect, test } from '@playwright/test';

/**
 * La page de production se charge avec la nouvelle coquille A² Home et
 * un Budget utilisable, sans navigation inférieure héritée.
 */
test('la page de production se charge', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/a2-budget/');
  await expect(page).toHaveTitle('A² Home');
  await expect(page.locator('#contenu-principal')).toBeVisible();
  await expect(page.getByRole('link', { name: 'A carré Home, aller au contenu' })).toBeVisible();
  const modules = page.getByRole('navigation', { name: 'Modules de la maison' });
  await expect(modules.getByRole('button')).toHaveCount(3);
  await expect(modules.getByRole('button', { name: 'Budget', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.budget-person__contribution')).toHaveCount(2);
  await expect(page.locator('.budget-total strong')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});
