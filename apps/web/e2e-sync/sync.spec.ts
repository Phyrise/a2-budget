/**
 * Synchronisation (V5) sur les émulateurs : première connexion (sauvegarde,
 * envoi des données locales, ou adoption des données communes), deux
 * téléphones, rechargement, hors ligne, déconnexion au choix.
 * Build `dist-emu/` (playwright.sync.config.ts).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ALEXIA, APP, ARTHUR, BACKUP_KEY, STATE_KEY, SYNC_KEY, accountSection, chooseSetup, expectApp, fakeGoogle, listDocs, openSettings, quickAdd, readDoc, resetEmulators, setupScreen, syncIndicator, toBuy, waitForEmulators, welcome, SYNC_READY } from './helpers';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

/** Un téléphone en invité, avec quelques données à lui. */
async function guestWithData(page: Page, name: string, grocery: string): Promise<void> {
  await page.goto(APP);
  await welcome(page).getByRole('button', { name: 'Continuer en invité' }).click();
  await expectApp(page);
  const settings = await openSettings(page);
  const field = settings.locator('#person-name-a');
  await field.fill(name);
  await field.press('Enter');
  await page.keyboard.press('Escape');
  await page.goto(`${APP}?module=courses`);
  await quickAdd(page, grocery);
  await expect(toBuy(page, grocery)).toBeVisible();
  await expect.poll(async () => (await stored(page, STATE_KEY)) ?? '').toContain(grocery);
}

/** Un téléphone connecté qui rejoint le foyer (y met ses données s'il est vide). */
async function member(browser: Browser, email: string, choice: 'Y mettre mes données' | 'La rejoindre') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${APP}?module=courses`);
  await fakeGoogle(page, email);
  await expect(setupScreen(page)).toBeVisible();
  await chooseSetup(page, choice);
  return { context, page };
}

test('première connexion : données locales sauvegardées puis envoyées au foyer vide', async ({ page }) => {
  await guestWithData(page, 'Arthur', 'Clémentines');
  const before = await stored(page, STATE_KEY);

  await openSettings(page);
  await accountSection(page).getByRole('button', { name: 'Se connecter avec Google' }).isVisible();
  await fakeGoogle(page, ARTHUR);
  const setup = setupScreen(page);
  await expect(setup.getByRole('status')).toHaveText('Elle est encore vide.');
  // Copie de sécurité faite avant tout choix.
  expect(await stored(page, BACKUP_KEY)).toBe(before);
  await chooseSetup(page, 'Y mettre mes données');

  // Le foyer a reçu les données du téléphone.
  await expect.poll(async () => (await readDoc('households/a2home/meta/migration'))?.status).toBe('done');
  const budget = await readDoc('households/a2home/settings/budget');
  expect(budget).toMatchObject({ personA: { name: 'Arthur' } });
  const groceries = Object.values(await listDocs('households/a2home/groceries'));
  expect(groceries.map((g) => g.label)).toContain('Clémentines');
  expect(await readDoc('households/a2home/checkpoints/' + new Date().toLocaleDateString('sv-SE'))).toMatchObject({ genesis: true });

  // Rechargé : la copie commune, tout de suite, sans écran de choix ; les données locales intactes.
  const listens: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/Listen/channel')) {
      listens.push(decodeURIComponent((request.postData() ?? '').replace(/\+/g, ' ')));
    }
  });
  await page.goto(`${APP}?module=courses`);
  await expectApp(page);
  await expect(toBuy(page, 'Clémentines')).toBeVisible();
  await expect(syncIndicator(page)).toHaveAttribute('title', 'À jour', SYNC_READY);

  // Écouteurs « delta » seulement : chaque requête écoutée part d'un curseur sur syncedAt.
  const sent = listens.join('\n');
  const queries = sent.match(/"structuredQuery"/g)?.length ?? 0;
  expect(queries).toBeGreaterThanOrEqual(14);
  expect(sent.match(/"startAt"/g)?.length).toBe(queries);
  expect(sent.match(/"fieldPath":"syncedAt"/g)?.length).toBeGreaterThanOrEqual(queries);
  expect(await stored(page, STATE_KEY)).toBe(before);
  expect(await stored(page, SYNC_KEY)).toContain('Clémentines');
});

test('deux téléphones : le geste de l’un apparaît chez l’autre, et reste après rechargement', async ({ browser }) => {
  const al = await member(browser, ARTHUR, 'Y mettre mes données');
  const ac = await member(browser, ALEXIA, 'La rejoindre');

  // AC ajoute : AL le voit arriver, sans recharger ; signé AC.
  await quickAdd(ac.page, 'Riz');
  await expect(toBuy(al.page, 'Riz')).toBeVisible();
  const riz = Object.values(await listDocs('households/a2home/groceries')).find((g) => g.label === 'Riz');
  expect(riz).toMatchObject({ addedBy: 'b', updatedBy: expect.any(String) });

  // AL coche : AC le voit ; après rechargement, toujours là.
  await al.page.getByRole('checkbox', { name: 'Riz' }).click();
  await expect(toBuy(ac.page, 'Riz')).toHaveCount(0);
  await ac.page.reload();
  await expectApp(ac.page);
  await expect(toBuy(ac.page, 'Riz')).toHaveCount(0);
  await expect(ac.page.locator('.item-list--basket .item-row')).toContainText('Riz');

  await al.context.close();
  await ac.context.close();
});

test('hors ligne : le geste est gardé, même au rechargement, puis part au retour du réseau', async ({ browser }) => {
  const al = await member(browser, ARTHUR, 'Y mettre mes données');
  const ac = await member(browser, ALEXIA, 'La rejoindre');
  const labels = async () => Object.values(await listDocs('households/a2home/groceries')).map((g) => g.label);

  // Service worker prêt : l'app se rouvre sans réseau.
  await al.page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await al.page.reload();
  await expectApp(al.page);
  await al.page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour', SYNC_READY);

  await al.context.setOffline(true);
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'Hors ligne — tout est gardé');
  await expect(syncIndicator(al.page)).toContainText('Hors ligne — tout est gardé');
  await quickAdd(al.page, 'Pain');
  await expect(toBuy(al.page, 'Pain')).toBeVisible();
  await al.page.waitForTimeout(800); // file d'écritures du SDK et copie locale enregistrées

  await al.page.reload();
  await expectApp(al.page);
  await expect(toBuy(al.page, 'Pain')).toBeVisible();
  expect(await labels()).not.toContain('Pain');

  await al.context.setOffline(false);
  await expect.poll(labels, { timeout: 30_000 }).toContain('Pain');
  await expect(toBuy(ac.page, 'Pain')).toBeVisible();
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour', SYNC_READY);

  await al.context.close();
  await ac.context.close();
});

test('se déconnecter : retour au mode local, avec ses données d’avant ou la copie commune', async ({ page }) => {
  await guestWithData(page, 'Arthur', 'Clémentines');
  const before = await stored(page, STATE_KEY);
  await fakeGoogle(page, ARTHUR);
  await chooseSetup(page, 'Y mettre mes données');
  await page.goto(`${APP}?module=courses`);
  await quickAdd(page, 'Kiwis');
  await expect.poll(async () => (await stored(page, SYNC_KEY)) ?? '').toContain('Kiwis');

  // « Mes données d'avant » : l'invité retrouve son téléphone tel quel.
  await openSettings(page);
  await accountSection(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await accountSection(page).getByRole('button', { name: 'Mes données d’avant' }).click();
  await expectApp(page);
  await expect(syncIndicator(page)).toHaveCount(0);
  await expect(toBuy(page, 'Clémentines')).toBeVisible();
  await expect(toBuy(page, 'Kiwis')).toHaveCount(0);
  expect(await stored(page, STATE_KEY)).toBe(before);

  // Reconnexion : la copie commune revient directement, sans écran de choix.
  await fakeGoogle(page, ARTHUR);
  await expect(toBuy(page, 'Kiwis')).toBeVisible();
  await expect(setupScreen(page)).toHaveCount(0);

  // « La copie commune » : elle devient les données du téléphone ; celles d'avant restent à l'abri.
  await openSettings(page);
  await accountSection(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await accountSection(page).getByRole('button', { name: 'La copie commune' }).click();
  await expectApp(page);
  await expect(syncIndicator(page)).toHaveCount(0);
  await expect(toBuy(page, 'Kiwis')).toBeVisible();
  await expect.poll(async () => (await stored(page, STATE_KEY)) ?? '').toContain('Kiwis');
  expect(await stored(page, BACKUP_KEY)).toBe(before);
});

test('qui a fait quoi : le compte connecté signe ses gestes ; chacun ne décoche que les siens', async ({ browser }) => {
  const al = await member(browser, ARTHUR, 'Y mettre mes données');
  const ac = await member(browser, ALEXIA, 'La rejoindre');
  const completions = async () => Object.values(await listDocs('households/a2home/completions'));

  // AL crée une tâche « libre » (personne n'est désigné).
  await al.page.goto(`${APP}?module=maison`);
  await expectApp(al.page);
  await al.page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const sheet = al.page.getByRole('dialog', { name: 'Nouvelle tâche' });
  await sheet.locator('#task-title').fill('Sortir le compost');
  await sheet.locator('#task-who-unassigned').check();
  await sheet.locator('#task-recurrence-daily').check();
  await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();

  // AC la coche sur son téléphone : c'est elle qui l'a faite (« qui ? » sans réponse → son compte).
  await ac.page.goto(`${APP}?module=maison`);
  await expectApp(ac.page);
  await ac.page.getByRole('checkbox', { name: 'Sortir le compost', exact: true }).click();
  await expect.poll(async () => (await completions()).length).toBe(1);
  expect((await completions())[0]).toMatchObject({ doneBy: 'b', role: 'b' });

  // Chez AL, elle est faite ; AL ne peut pas la décocher à la place d'AC.
  const done = al.page.getByRole('button', { name: /Fait aujourd’hui/ });
  await expect(done).toContainText('1');
  await done.click();
  await al.page.getByRole('checkbox', { name: 'Sortir le compost (annuler)' }).click();
  await expect(al.page.locator('.toast')).toContainText('qui l’a cochée');
  await al.page.waitForTimeout(800);
  expect((await completions())[0]?.undoneAt).toBeUndefined();
  await expect(al.page.getByRole('checkbox', { name: 'Sortir le compost (annuler)' })).toHaveAttribute('aria-checked', 'true');

  // AC la décoche : annulée (jamais supprimée), elle revient chez AL.
  await ac.page.getByRole('button', { name: /Fait aujourd’hui/ }).click();
  await ac.page.getByRole('checkbox', { name: 'Sortir le compost (annuler)' }).click();
  await expect.poll(async () => (await completions())[0]?.undoneBy).toBe('b');
  await expect(al.page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: 'Sortir le compost' })).toBeVisible();

  await al.context.close();
  await ac.context.close();
});
