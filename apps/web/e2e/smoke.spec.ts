import { expect, test } from '@playwright/test';

/**
 * Smoke test minimal, indépendant de la structure des vues :
 * la page de production se charge, le titre est correct, aucun crash.
 * Les scénarios métier (2200/3675, persistance, hors ligne) sont ajoutés
 * après l'intégration de l'UI.
 */
test('la page de production se charge', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page).toHaveTitle('A² Budget');
  await expect(page.locator('#contenu-principal')).toBeVisible();
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});
