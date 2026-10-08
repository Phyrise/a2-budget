/**
 * V5.2 — cercle de la semaine en invité : on le tient à deux sur le même
 * téléphone, avec le « petit mot » de chacun ; aucune lettre (enveloppe,
 * pastille) puisqu'il n'y a pas d'autre téléphone. La réception des
 * lettres entre deux téléphones : scripts/qa-sync.mjs (émulateurs).
 */
import { emptyAppState, validateAppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, persisted, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function openSeeded(page: Page) {
  const v = validateAppState(emptyAppState());
  if (!v.ok) throw new Error(v.reason);
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('lettres-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: false, offlineAnnounced: true }));
      sessionStorage.setItem('lettres-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(v.state) },
  );
  await page.goto(`${APP}?module=maison`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

test('invité : le cercle à deux voix, avec un petit mot, sans lettre', async ({ page }) => {
  const errors = trackErrors(page);
  await openSeeded(page);
  const rituals = page.locator('section.rituals');
  await rituals.getByRole('button', { name: 'Cercle de la semaine', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cercle de la semaine' });
  await expect(dialog.locator('.circle-voice--a')).toHaveCount(1);
  await expect(dialog.locator('.circle-voice--b')).toHaveCount(1);
  await dialog.locator('.circle-voice--a textarea').fill('Merci pour le dîner');
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await dialog.locator('.circle-voice--b textarea').fill('Un besoin : dormir.');
  await dialog.getByRole('button', { name: 'Continuer' }).click();

  // Le petit mot : un par voix, facultatif.
  await expect(dialog.getByRole('heading', { name: /Un petit mot pour/ })).toHaveCount(2);
  await dialog.getByLabel('Un mot gentil').last().fill('Tu es formidable');
  await dialog.getByRole('button', { name: 'Clore le cercle' }).click();
  await expect(dialog).toContainText('Merci d’avoir pris ce moment.');

  await expect.poll(async () => (await persisted(page)).rituals?.circles?.length ?? 0).toBe(1);
  const circle = (await persisted(page)).rituals.circles[0];
  expect(circle.author).toBeUndefined();
  expect(circle.notes).toEqual([{ from: 'b', to: 'a', text: 'Tu es formidable' }]);
  await expect(dialog).toContainText('Tu es formidable');
  await dialog.getByRole('button', { name: 'Retourner dans la forêt' }).click();

  // En invité, jamais de lettre ni de pastille.
  await expect(page.getByTestId('circle-letter')).toHaveCount(0);
  await expect(page.getByTestId('nav-letter-dot')).toHaveCount(0);
  await page.reload();
  await rituals.getByRole('button', { name: /Cercle de la semaine, tenu/ }).click();
  await expect(dialog).toContainText('Tu es formidable');
  expect(errors).toEqual([]);
});
