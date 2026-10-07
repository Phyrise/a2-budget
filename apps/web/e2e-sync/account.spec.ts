/**
 * Compte (V5) sur les émulateurs Firebase : accueil, invité sans aucune
 * requête serveur, connexion d'un compte de la liste blanche (foyer créé),
 * refus doux d'un autre compte. Build `dist-emu/` (playwright.sync.config.ts).
 */
import { expect, test } from '@playwright/test';
import {
  ACCOUNT_KEY,
  ALEXIA,
  APP,
  ARTHUR,
  STATE_KEY,
  accountSection,
  authUsers,
  expectApp,
  fakeGoogle,
  isServerRequest,
  openSettings,
  readDoc,
  recordRequests,
  resetEmulators,
  welcome,
} from './helpers';

test.beforeEach(async () => {
  await resetEmulators();
});

test('accueil → invité : l’app d’aujourd’hui, aucune requête vers Google ou Firebase', async ({ page, context }) => {
  const requests = recordRequests(context);
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });

  await page.goto(APP);
  const home = welcome(page);
  await expect(home.getByRole('heading', { name: 'A² Home' })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  await home.getByRole('button', { name: 'Continuer en invité' }).click();
  await expectApp(page);

  // Données locales : un prénom changé reste sur le téléphone.
  const settings = await openSettings(page);
  await expect(accountSection(page).getByText('Invité', { exact: true })).toBeVisible();
  await expect(accountSection(page).getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  const name = settings.locator('#person-name-a');
  await name.fill('Arthur');
  await name.press('Enter');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k) ?? '', STATE_KEY)).toContain('"Arthur"');

  // Choix mémorisé : plus d'accueil à l'ouverture suivante.
  await page.reload();
  await expectApp(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), ACCOUNT_KEY)).toBe('{"entry":"guest"}');
  await page.waitForTimeout(1500);

  // Ni requête vers Google / Firebase / émulateurs, ni chunk du SDK chargé par la page.
  expect(requests.filter(isServerRequest)).toEqual([]);
  expect(scripts.filter((url) => /\/session-[^/]*\.js$/.test(url))).toEqual([]);
  const sdkKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('firebase')));
  expect(sdkKeys).toEqual([]);
  expect(await authUsers()).toEqual([]);
});

test('connexion Google (faux jeton) d’un compte invité : foyer créé, session gardée', async ({ page }) => {
  await page.goto(APP);
  await expect(welcome(page)).toBeVisible();
  await fakeGoogle(page, ARTHUR);
  await expectApp(page);

  await openSettings(page);
  const account = accountSection(page);
  await expect(account.getByText('AL · Jiji')).toBeVisible();
  await expect(account.getByText(ARTHUR)).toBeVisible();
  await expect(account.getByText('Foyer prêt')).toBeVisible();

  // Le premier membre crée le foyer unique et sa fiche.
  const [user] = await authUsers();
  const home = await readDoc('households/a2home');
  expect(home).toMatchObject({ names: { a: 'AL', b: 'AC' }, schema: 1, minApp: 1, createdByRole: 'a', updatedBy: user?.localId });
  expect(await readDoc('households/a2home/memberState/a')).toMatchObject({ uid: user?.localId });

  // Session gardée sur le téléphone : ni accueil ni reconnexion.
  await page.reload();
  await expectApp(page);
  await openSettings(page);
  await expect(accountSection(page).getByText('AL · Jiji')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), ACCOUNT_KEY)).toBe('{"entry":"google"}');

  // Se déconnecter : l'app reste, en invité.
  await accountSection(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(accountSection(page).getByText('Invité', { exact: true })).toBeVisible();
  await page.reload();
  await expectApp(page);
});

test('second membre : rejoint le foyer sans le recréer', async ({ browser }) => {
  for (const [email, role] of [
    [ARTHUR, 'a'],
    [ALEXIA, 'b'],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(APP);
    await fakeGoogle(page, email);
    await expectApp(page);
    await openSettings(page);
    await expect(accountSection(page).getByText('Foyer prêt')).toBeVisible();
    expect(await readDoc(`households/a2home/memberState/${role}`)).toMatchObject({ uid: expect.any(String) });
    await context.close();
  }
  expect(await readDoc('households/a2home')).toMatchObject({ createdByRole: 'a' });
});

test('compte non invité : mot doux, déconnecté, retour à l’accueil, rien d’écrit', async ({ page }) => {
  await page.goto(APP);
  await fakeGoogle(page, 'quelquun@gmail.com');
  const home = welcome(page);
  await expect(home.getByRole('status')).toHaveText('Ce compte n’est pas invité.');
  await expect(page.locator('.screen-sheet')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('firebase:authUser'))))
    .toEqual([]);
  expect(await readDoc('households/a2home')).toBeNull();

  // Rien n'est mémorisé : l'accueil revient.
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), ACCOUNT_KEY)).toBeNull();

  // Adresse invitée mais non vérifiée par Google : son propre mot.
  await fakeGoogle(page, ALEXIA, false);
  await expect(welcome(page).getByRole('status')).toHaveText('Adresse pas encore vérifiée par Google.');
  expect(await readDoc('households/a2home')).toBeNull();
});

test('les données locales ne sont jamais touchées par la connexion', async ({ page }) => {
  await page.goto(APP);
  await welcome(page).getByRole('button', { name: 'Continuer en invité' }).click();
  await expectApp(page);
  const settings = await openSettings(page);
  const name = settings.locator('#person-name-b');
  await name.fill('Alexia');
  await name.press('Enter');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k) ?? '', STATE_KEY)).toContain('"Alexia"');
  const before = await page.evaluate((k) => localStorage.getItem(k), STATE_KEY);

  await fakeGoogle(page, ALEXIA);
  await expect(accountSection(page).getByText('AC · Calcifer')).toBeVisible();
  await expect(accountSection(page).getByText('Foyer prêt')).toBeVisible();
  await accountSection(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(accountSection(page).getByText('Invité', { exact: true })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), STATE_KEY)).toBe(before);
});
