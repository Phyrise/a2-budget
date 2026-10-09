/**
 * V5.6 — chacun choisit son compagnon dans les Réglages (à côté du prénom) :
 * toucher le compagnon de la carte ouvre quatre choix, le choix actuel
 * cerclé, celui de l'autre grisé. Le choix vaut partout (Maison…) et survit
 * au rechargement. En invité, les deux cartes proposent le choix.
 */
import { expect, test } from '@playwright/test';
import { PHONE, closeSheet, openApp, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

test('Réglages : AL choisit Teto, partout dans l’app, même après rechargement', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page, 'maison');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = sheet(page, 'Réglages');
  const cardA = settings.locator('.settings-person--a');
  const cardB = settings.locator('.settings-person--b');

  const toggleA = cardA.getByRole('button', { name: /^Changer de compagnon/ });
  await expect(toggleA.locator('img')).toHaveAttribute('src', /jiji-idle/);
  await toggleA.click();
  await expect(toggleA).toHaveAttribute('aria-expanded', 'true');
  const pickA = cardA.getByRole('radiogroup');
  await expect(pickA.getByRole('radio')).toHaveCount(4);
  await expect(pickA.getByRole('radio', { name: 'Jiji', exact: true })).toHaveAttribute('aria-checked', 'true');
  // Calcifer est à AC : grisé, pas choisissable.
  await expect(pickA.getByRole('radio', { name: /^Calcifer/ })).toBeDisabled();
  // La rangée tient dans la carte (390 px, aucun débordement).
  const card = (await cardA.boundingBox())!;
  const row = (await pickA.boundingBox())!;
  expect(row.x + row.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);

  await pickA.getByRole('radio', { name: 'Teto', exact: true }).click();
  await expect(cardA.getByRole('radiogroup')).toHaveCount(0);
  await expect(toggleA.locator('img')).toHaveAttribute('src', /teto-idle/);
  await expect(cardA.locator('.settings-person__companion')).toHaveText('avec Teto');

  // Chez AC, Teto est désormais pris.
  const toggleB = cardB.getByRole('button', { name: /^Changer de compagnon/ });
  await toggleB.click();
  const pickB = cardB.getByRole('radiogroup');
  await expect(pickB.getByRole('radio', { name: /^Teto/ })).toBeDisabled();
  await expect(pickB.getByRole('radio', { name: 'Calcifer', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(pickB.getByRole('radio', { name: 'Jiji', exact: true })).toBeEnabled();
  await toggleB.click();
  await expect(cardB.getByRole('radiogroup')).toHaveCount(0);

  await closeSheet(page, 'Réglages');
  expect((await persisted(page)).budget.settings.personA.companion).toBe('teto');

  // Ailleurs : Teto perché sur la feuille de la Maison.
  const teto = page.locator('.perch').getByRole('button', { name: 'Caresser Teto' });
  await expect(teto.locator('img')).toHaveAttribute('src', /teto-/);
  await expect(page.locator('.perch').getByRole('button', { name: 'Caresser Jiji' })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.perch').getByRole('button', { name: 'Caresser Teto' }).locator('img')).toHaveAttribute('src', /teto-/);
  expect(errors).toEqual([]);
});
