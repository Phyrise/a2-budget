/**
 * QA « deux téléphones » (docs/SYNC_DESIGN.md §11) sur les émulateurs :
 * AL et AC en temps réel dans les deux sens, hors ligne des deux côtés puis
 * fusion, même objet modifié en même temps, invité sur un 3e téléphone,
 * session gardée au rechargement et à la réouverture (PWA).
 * Lancer : `node apps/web/scripts/qa-sync.mjs` (build émulateurs compris).
 */
import { expect, test } from '@playwright/test';
import { APP, accountSection, expectApp, fakeGoogle, isServerRequest, openSettings, quickAdd, recordRequests, resetEmulators, setupScreen, syncIndicator, toBuy, waitForEmulators, welcome } from './helpers';
import { addEvent, addFreeDailyTask, checkTask, closePhones, dayEvent, go, sameCopies, setEuros, syncedState, todo, transfer, twoPhones } from './phones';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

test('temps réel dans les deux sens : tâche, course, événement, virement', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);

  // Tâche : AL la crée, AC la voit ; AL la coche, AC la voit faite.
  await go(al.page, 'Maison');
  await go(ac.page, 'Maison');
  await addFreeDailyTask(al.page, 'Arroser le basilic');
  await expect(todo(ac.page, 'Arroser le basilic')).toBeVisible();
  await checkTask(al.page, 'Arroser le basilic');
  await expect(todo(ac.page, 'Arroser le basilic')).toHaveCount(0);
  // Et l'inverse.
  await addFreeDailyTask(ac.page, 'Changer les draps');
  await expect(todo(al.page, 'Changer les draps')).toBeVisible();
  await checkTask(ac.page, 'Changer les draps');
  await expect(todo(al.page, 'Changer les draps')).toHaveCount(0);

  // Courses, dans les deux sens.
  await go(al.page, 'Courses');
  await go(ac.page, 'Courses');
  await quickAdd(al.page, 'Clémentines');
  await expect(toBuy(ac.page, 'Clémentines')).toBeVisible();
  await quickAdd(ac.page, 'Farine');
  await expect(toBuy(al.page, 'Farine')).toBeVisible();

  // Événement, dans les deux sens.
  await go(al.page, 'Calendrier');
  await go(ac.page, 'Calendrier');
  await addEvent(al.page, 'dîner chez Léa 20h');
  await expect(dayEvent(ac.page, 'Dîner chez Léa')).toBeVisible();
  await addEvent(ac.page, 'cinéma 18h');
  await expect(dayEvent(al.page, 'Cinéma')).toBeVisible();

  // Virements : chacun coche le sien, l'autre le voit (même mois, champs différents).
  await go(al.page, 'Budget');
  await go(ac.page, 'Budget');
  await transfer(al.page, 'AL').click();
  await expect(transfer(ac.page, 'AL')).toHaveAttribute('aria-checked', 'true');
  await transfer(ac.page, 'AC').click();
  await expect(transfer(al.page, 'AC')).toHaveAttribute('aria-checked', 'true');
  await expect(transfer(al.page, 'AL')).toHaveAttribute('aria-checked', 'true');

  // Les deux copies sont identiques, forêt comprise.
  await expect.poll(() => sameCopies(al.page, ac.page)).toBe(true);
  await closePhones(al, ac);
});

test('hors ligne des deux côtés : fusion au retour, rien de perdu, forêt identique', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(al.page, 'Maison');
  await go(ac.page, 'Maison');
  await addFreeDailyTask(al.page, 'Vider le lave-vaisselle');
  await addFreeDailyTask(al.page, 'Sortir les poubelles');
  await expect(todo(ac.page, 'Sortir les poubelles')).toBeVisible();
  // Le mois est ouvert des deux côtés avant la coupure, avec un salaire de départ.
  await go(al.page, 'Budget');
  await setEuros(al.page, 'salary-a', '2000');
  await go(ac.page, 'Budget');
  await expect(ac.page.locator('#salary-a-value')).toContainText('2');

  await al.context.setOffline(true);
  await ac.context.setOffline(true);
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'Hors ligne — tout est gardé');
  await expect(syncIndicator(ac.page)).toHaveAttribute('title', 'Hors ligne — tout est gardé');

  // Chacun ses gestes, et le même champ changé des deux côtés (salaire d'AL).
  await transfer(al.page, 'AL').click();
  await setEuros(al.page, 'salary-a', '2200');
  await transfer(ac.page, 'AC').click();
  await setEuros(ac.page, 'salary-a', '2500');
  await go(al.page, 'Maison');
  await checkTask(al.page, 'Vider le lave-vaisselle');
  await go(ac.page, 'Maison');
  await checkTask(ac.page, 'Sortir les poubelles');
  await go(al.page, 'Courses');
  await quickAdd(al.page, 'Pommes');
  await go(ac.page, 'Courses');
  await quickAdd(ac.page, 'Poires');
  await al.page.waitForTimeout(600); // copie locale enregistrée (400 ms)

  // AL revient d'abord, AC ensuite : chacun reçoit tout ; pour le même champ, le dernier arrivé gagne.
  await al.context.setOffline(false);
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour', { timeout: 30_000 });
  await ac.context.setOffline(false);
  await expect(syncIndicator(ac.page)).toHaveAttribute('title', 'À jour', { timeout: 30_000 });

  for (const page of [al.page, ac.page]) {
    await expect(toBuy(page, 'Pommes')).toBeVisible();
    await expect(toBuy(page, 'Poires')).toBeVisible();
    await go(page, 'Maison');
    await expect(todo(page, 'Vider le lave-vaisselle')).toHaveCount(0);
    await expect(todo(page, 'Sortir les poubelles')).toHaveCount(0);
    await go(page, 'Budget');
    await expect(transfer(page, 'AL')).toHaveAttribute('aria-checked', 'true');
    await expect(transfer(page, 'AC')).toHaveAttribute('aria-checked', 'true');
  }
  // Le salaire est un champ du mois : AC est arrivée en dernier, sa valeur gagne partout.
  const salaryA = async (page: typeof al.page) => {
    const budget = (await syncedState(page)).budget;
    return budget?.months?.find((m: { monthKey: string }) => m.monthKey === budget.selectedMonth)?.salaryACents;
  };
  await expect.poll(() => salaryA(al.page)).toBe(250_000);
  await expect.poll(() => salaryA(ac.page)).toBe(250_000);

  // Mêmes données et même forêt sur les deux téléphones (deux tâches comptées).
  await expect.poll(() => sameCopies(al.page, ac.page)).toBe(true);
  const state = await syncedState(al.page);
  expect(state.chores.completions.filter((c: { undoneAt?: string }) => !c.undoneAt)).toHaveLength(2);
  await closePhones(al, ac);
});

test('invité sur un 3e téléphone : aucune requête serveur ; un compte non invité est refusé', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);

  const guest = await browser.newContext();
  const urls = recordRequests(guest);
  const page = await guest.newPage();
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto(APP);
  await welcome(page).getByRole('button', { name: 'Continuer en invité' }).click();
  await expectApp(page);
  // Pendant ce temps, le foyer vit.
  await go(al.page, 'Courses');
  await go(ac.page, 'Courses');
  await quickAdd(al.page, 'Lait');
  await expect(toBuy(ac.page, 'Lait')).toBeVisible();
  await go(page, 'Courses');
  await quickAdd(page, 'Chocolat');
  await expect(toBuy(page, 'Lait')).toHaveCount(0);
  await page.reload();
  await expectApp(page);
  await expect(toBuy(page, 'Chocolat')).toBeVisible();
  expect(urls.filter(isServerRequest)).toEqual([]);
  // Le chunk du SDK n'est jamais chargé par la page (le service worker peut le garder en cache, sans l'exécuter).
  expect(scripts.filter((url) => /\/session-[^/]*\.js$/.test(url))).toEqual([]);
  await guest.close();

  // Un compte hors liste : mot doux, déconnecté, retour à l'accueil.
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await other.goto(APP);
  await fakeGoogle(other, 'quelquun@example.com');
  await expect(welcome(other).getByRole('status')).toHaveText('Ce compte n’est pas invité.');
  await expect(setupScreen(other)).toHaveCount(0);
  await stranger.close();
  await closePhones(al, ac);
});

test('session gardée : rechargement, réouverture (PWA) et ouverture hors ligne', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(al.page, 'Courses');
  await go(ac.page, 'Courses');
  await quickAdd(al.page, 'Café');

  // Rechargement : ni accueil ni choix, la copie commune tout de suite.
  await al.page.reload();
  await expectApp(al.page);
  await expect(setupScreen(al.page)).toHaveCount(0);
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour');

  // Réouverture de l'app (onglet fermé, nouvel onglet, comme l'icône de l'écran d'accueil).
  await al.page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await al.page.close();
  const again = await al.context.newPage();
  await again.goto(`${APP}?module=courses`);
  await expectApp(again);
  await expect(toBuy(again, 'Café')).toBeVisible();
  await expect(syncIndicator(again)).toHaveAttribute('title', 'À jour');
  await openSettings(again);
  await expect(accountSection(again)).toContainText('arthur.longuefosse@gmail.com');
  await again.keyboard.press('Escape');

  // Ouverture sans réseau : la session et les données restent ; le geste part au retour.
  await again.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await al.context.setOffline(true);
  await again.reload();
  await expectApp(again);
  await expect(toBuy(again, 'Café')).toBeVisible();
  await quickAdd(again, 'Thé');
  await al.context.setOffline(false);
  await expect(toBuy(ac.page, 'Thé')).toBeVisible({ timeout: 30_000 });
  await closePhones(al, ac);
});
