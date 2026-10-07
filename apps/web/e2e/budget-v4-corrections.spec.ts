/**
 * Corrections V4 du budget : consulter un mois n'écrit rien (le solde du
 * mois courant ne bouge pas), recalage seulement sur le mois courant,
 * annuler la suppression d'une dépense cochée la remet à l'identique,
 * invitation douce tant que le solde n'a jamais été recalé.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, monthKey, openApp, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

/** Montant au pavé : toucher le montant, taper les chiffres (clavier physique), Entrée. */
async function setEuros(page: Page, id: string, digits: string) {
  await page.locator(`#${id}-value`).click();
  const display = page.locator(`#${id}-pad-display`);
  await expect(display).toBeFocused();
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(display).toHaveCount(0);
}

test('consulter des mois passés ne change ni l’état ni le solde du mois courant', async ({ page }) => {
  await openApp(page, 'budget');
  const key = await monthKey(page);
  await setEuros(page, 'salary-a', '2200');
  const now = page.getByTestId('balance-now');
  const before = await now.textContent();

  const previous = page.getByRole('button', { name: 'Mois précédent', exact: true });
  await previous.click();
  await previous.click();
  // Mois passé : solde de fin de mois, pas de « en ce moment » ni de recalage.
  await expect(page.getByTestId('balance-caption')).toContainText('estimé à la fin de');
  await expect(page.getByRole('button', { name: 'Recaler sur le compte', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await persisted(page)).budget.months.map((m: { monthKey: string }) => m.monthKey)).toEqual([key]);

  await page.getByRole('button', { name: 'Revenir au mois courant' }).click();
  await expect(page.getByTestId('balance-caption')).toHaveText('estimé en ce moment');
  await expect(now).toHaveText(before ?? '');
});

test('modifier un mois consulté l’enregistre (et lui seul)', async ({ page }) => {
  await openApp(page, 'budget');
  const key = await monthKey(page);
  await page.getByRole('button', { name: 'Mois suivant', exact: true }).click();
  await expect(page.getByTestId('balance-caption')).toContainText('estimé au début de');
  await setEuros(page, 'salary-a', '2300');
  await expect.poll(async () => (await persisted(page)).budget.months.length).toBe(2);
  const months = (await persisted(page)).budget.months as { monthKey: string; salaryACents: number }[];
  expect(months.find((m) => m.monthKey !== key)?.salaryACents).toBe(230_000);
});

test('annuler le retrait d’une dépense cochée : même place, toujours cochée, même solde', async ({ page }) => {
  await openApp(page, 'budget');
  const rent = page.getByRole('checkbox', { name: 'Loyer + charges payé', exact: true });
  await rent.click();
  await expect(rent).toHaveAttribute('aria-checked', 'true');
  const now = page.getByTestId('balance-now');
  const progress = page.getByTestId('payments-progress');
  const balance = await now.textContent();
  const done = await progress.textContent();
  const ids = async () => ((await persisted(page)).budget.months[0].expenses as { id: string }[]).map((e) => e.id);
  const order = await ids();

  await page.getByRole('button', { name: 'Retirer Loyer + charges', exact: true }).click();
  await expect(rent).toHaveCount(0);
  await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();

  await expect(rent).toHaveAttribute('aria-checked', 'true');
  await expect(now).toHaveText(balance ?? '');
  await expect(progress).toHaveText(done ?? '');
  await expect.poll(ids).toEqual(order);
});

test('solde jamais recalé : invitation douce, qui disparaît après un recalage', async ({ page }) => {
  await openApp(page, 'budget');
  const hint = page.getByTestId('balance-unconfirmed');
  await expect(hint).toContainText('recalez quand vous regardez le vrai compte');
  await page.getByRole('button', { name: 'Recaler sur le compte', exact: true }).click();
  const dialog = sheet(page, 'Recaler sur le compte');
  await page.locator('#recalibrate-amount').fill('1200');
  await dialog.getByRole('button', { name: 'Recaler', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(hint).toHaveCount(0);
});
