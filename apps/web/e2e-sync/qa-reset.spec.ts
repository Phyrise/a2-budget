/**
 * QA « remise à zéro » (mode développeur, docs/SYNC_DESIGN.md §22) sur les
 * émulateurs : AL remplit, AC voit ; AL remet tout à zéro → les deux vides,
 * rien ne revient après rechargement (ni l'ancien bocal local d'AC) ; AL
 * écrit une lettre → AC la reçoit. Puis « Effacer les lettres de la
 * semaine » : la lettre disparaît chez AC, réécrite elle revient.
 * Lancer : `node apps/web/scripts/qa-sync.mjs` (ou ce fichier seul).
 */
import { expect, test, type Page } from '@playwright/test';
import { listDocs, readDoc, resetEmulators, syncIndicator, waitForEmulators, SYNC_READY } from './helpers';
import { addFreeDailyTask, closePhones, go, syncedState, todo, twoPhones } from './phones';
import { openDev } from '../e2e/devPanel';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

const HOME = 'households/a2home';
const circleCard = (page: Page) => page.locator('section.rituals .ritual-card--circle');
const envelope = (page: Page) => page.getByTestId('circle-letter');

async function writeMyPart(page: Page, role: 'a' | 'b', note: string) {
  await circleCard(page).click();
  const dialog = page.getByRole('dialog', { name: 'Cercle de la semaine' });
  await expect(dialog).toContainText('Étape 1 sur 3');
  await dialog.locator(`.circle-voice--${role} textarea`).fill(`Merci (${note})`);
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await dialog.getByLabel('Un mot gentil').fill(note);
  await dialog.getByRole('button', { name: 'Clore le cercle' }).click();
  await expect(dialog).toContainText('va recevoir ta lettre');
  await dialog.getByRole('button', { name: 'Retourner dans la forêt' }).click();
  await expect(dialog).toBeHidden();
}

async function readLetter(page: Page, note: string) {
  await expect(envelope(page)).toBeVisible();
  await circleCard(page).click();
  const letter = page.getByRole('dialog', { name: /^Une lettre de/ });
  await expect(letter).toContainText(note);
  await page.keyboard.press('Escape');
  await expect(letter).toBeHidden();
  await expect(envelope(page)).toHaveCount(0);
}

/** Mode développeur (préférence d'interface), puis l'app rouverte. */
async function devMode(page: Page) {
  await page.evaluate(() => {
    const ui = JSON.parse(localStorage.getItem('a2-budget:ui:v1') ?? '{}') as Record<string, unknown>;
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ ...ui, devMode: true }));
  });
  await page.reload();
  await expect(syncIndicator(page)).toHaveAttribute('title', 'À jour', SYNC_READY);
}

async function devTwice(page: Page, label: string) {
  const dev = await openDev(page, 'Remise à zéro');
  await dev.getByRole('button', { name: label }).click();
  await dev.getByRole('button', { name: 'Sûr ?' }).click();
}

const tasksOf = async (page: Page) => ((await syncedState(page)).chores?.tasks ?? []).length as number;

test('remise à zéro : les deux téléphones repartent de zéro, rien ne revient, les lettres repartent', async ({ browser }) => {
  test.setTimeout(240_000);
  const { al, ac } = await twoPhones(browser);
  for (const p of [al.page, ac.page]) await go(p, 'Maison');

  // AL remplit (tâche + lettre), AC voit et lit.
  await addFreeDailyTask(al.page, 'Arroser le ficus');
  await expect(todo(ac.page, 'Arroser le ficus')).toHaveCount(1);
  await writeMyPart(al.page, 'a', 'Avant');
  await readLetter(ac.page, 'Avant');
  await expect.poll(async () => (await readDoc(`${HOME}/memberState/b`))?.circleSeen).toBeTruthy();
  // Un vieux bocal local chez AC : il ne doit jamais revenir au serveur.
  await ac.page.evaluate(() => localStorage.setItem('a2-budget:play:v1', JSON.stringify({ v: 1, jar: 60, caught: 9, golden: 2 })));

  // AL remet tout à zéro.
  await devMode(al.page);
  await go(al.page, 'Maison');
  await devTwice(al.page, 'Tout remettre à zéro');
  await expect.poll(async () => (await readDoc(HOME))?.resetting, { timeout: 30_000 }).toBe(false);
  expect(await readDoc(HOME)).toMatchObject({ resetEpoch: 1 });
  for (const p of [al.page, ac.page]) {
    await expect(syncIndicator(p)).toHaveAttribute('title', 'À jour', SYNC_READY);
    await expect(todo(p, 'Arroser le ficus')).toHaveCount(0);
    await expect.poll(() => tasksOf(p)).toBe(0);
  }
  expect(Object.keys(await listDocs(`${HOME}/tasks`))).toEqual([]);
  expect(Object.keys(await listDocs(`${HOME}/circles`))).toEqual([]);
  expect(await readDoc(`${HOME}/memberState/a`)).toMatchObject({ uid: expect.any(String) }); // appartenance gardée
  expect(await ac.page.evaluate(() => localStorage.getItem('a2-budget:play:v1'))).toBeNull();

  // Rechargés : toujours vides, rien n'est renvoyé.
  for (const p of [al.page, ac.page]) {
    await p.reload();
    await expect(syncIndicator(p)).toHaveAttribute('title', 'À jour', SYNC_READY);
    await go(p, 'Maison');
    await expect(todo(p, 'Arroser le ficus')).toHaveCount(0);
  }
  expect(Object.keys(await listDocs(`${HOME}/tasks`))).toEqual([]);
  expect(((await readDoc(`${HOME}/play/b`))?.given as number | undefined) ?? 0).toBe(0);

  // AL écrit une nouvelle lettre : AC la reçoit.
  await writeMyPart(al.page, 'a', 'Après');
  await readLetter(ac.page, 'Après');

  // Lettres de la semaine effacées : disparues chez AC ; réécrites, elles reviennent.
  await devTwice(al.page, 'Effacer les lettres de la semaine');
  await al.page.keyboard.press('Escape');
  await expect
    .poll(async () => ((await syncedState(ac.page)).rituals?.circles ?? []).length as number)
    .toBe(0);
  await expect.poll(async () => (await readDoc(HOME))?.lettersEpoch).toBe(1);
  await writeMyPart(al.page, 'a', 'Encore');
  await readLetter(ac.page, 'Encore');
  await closePhones(al, ac);
});
