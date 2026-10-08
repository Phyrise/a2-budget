import { expect, test } from '@playwright/test';
import { APP, PHONE, openApp, sheet } from './helpers';

test.use({ viewport: PHONE });

/**
 * V5, build sans configuration Firebase (celui de cette suite) : l'app
 * d'aujourd'hui. Ni accueil, ni section « Compte », aucune requête vers
 * Google ou Firebase, aucun choix de compte écrit. Le compte lui-même est
 * testé sur les émulateurs (e2e-sync/).
 */
test('sans configuration Firebase : ni accueil ni compte, rien vers Google', async ({ page, context }) => {
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));

  await openApp(page);
  await expect(page.getByRole('main', { name: 'A² Home' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continuer en invité' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = sheet(page, 'Réglages');
  await expect(settings.getByRole('heading', { name: 'Anniversaires' })).toBeVisible();
  await expect(settings.getByRole('region', { name: 'Compte' })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('a2-budget:account:v1'))).toBeNull();
  const servers = requests.filter((url) => {
    const { hostname } = new URL(url);
    return /(^|\.)(googleapis\.com|google\.com|gstatic\.com|firebaseapp\.com|firebaseio\.com|firebase\.com)$/.test(hostname);
  });
  expect(servers).toEqual([]);
  const origin = new URL(APP, page.url()).origin;
  expect(requests.filter((url) => /^https?:/.test(url) && !url.startsWith(`${origin}/`))).toEqual([]);
});
