/**
 * QA « lettres du cercle » (V5.2) sur les émulateurs : AL écrit sa part →
 * AC (deux appareils) voit l'enveloppe et la pastille, l'ouvre ; « lu » sur
 * ses deux appareils. AC écrit ensuite sa part de la même semaine : rien
 * n'est écrasé, AL reçoit sa lettre.
 * Lancer : `node apps/web/scripts/qa-sync.mjs --all` (ou ce fichier seul).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ALEXIA, APP, chooseSetup, fakeGoogle, readDoc, resetEmulators, setupScreen, syncIndicator, waitForEmulators, SYNC_READY } from './helpers';
import { closePhones, go, syncedState, twoPhones, type Phone } from './phones';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

/** Un appareil de plus pour un membre qui a déjà rejoint le foyer. */
async function anotherDevice(browser: Browser, email: string): Promise<Phone> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(APP);
  await fakeGoogle(page, email);
  await expect(setupScreen(page)).toBeVisible();
  await chooseSetup(page, 'La rejoindre');
  await expect(syncIndicator(page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  return { context, page };
}

const circleCard = (page: Page) => page.locator('section.rituals .ritual-card--circle');
const envelope = (page: Page) => page.getByTestId('circle-letter');
const navDot = (page: Page) => page.getByTestId('nav-letter-dot');

/** Écrit sa part : seule sa voix est proposée. */
async function writeMyPart(page: Page, role: 'a' | 'b', words: { thanks: string; burden: string; note: string }) {
  await circleCard(page).click();
  const dialog = page.getByRole('dialog', { name: 'Cercle de la semaine' });
  await expect(dialog).toContainText('Étape 1 sur 3');
  await expect(dialog.locator(`.circle-voice--${role === 'a' ? 'b' : 'a'}`)).toHaveCount(0);
  await dialog.locator(`.circle-voice--${role} textarea`).fill(words.thanks);
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await dialog.locator(`.circle-voice--${role} textarea`).fill(words.burden);
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await dialog.getByLabel('Un mot gentil').fill(words.note);
  await dialog.getByRole('button', { name: 'Clore le cercle' }).click();
  await expect(dialog).toContainText('va recevoir ta lettre');
  await dialog.getByRole('button', { name: 'Retourner dans la forêt' }).click();
  await expect(dialog).toBeHidden();
}

test('lettres du cercle : AL écrit, AC reçoit sur ses deux appareils, puis répond sans rien écraser', async ({ browser }) => {
  test.setTimeout(180_000); // trois appareils
  const { al, ac } = await twoPhones(browser);
  const ac2 = await anotherDevice(browser, ALEXIA);
  for (const p of [al.page, ac.page, ac2.page]) await go(p, 'Maison');
  await expect(envelope(ac.page)).toHaveCount(0);

  await writeMyPart(al.page, 'a', { thanks: 'Merci pour les crêpes', burden: 'Un besoin : du calme', note: 'Je t’aime fort' });
  await expect(envelope(al.page)).toHaveCount(0); // pas de lettre à soi-même

  // AC : enveloppe, pastille sur l'onglet, petit toast — sur ses deux appareils.
  for (const p of [ac.page, ac2.page]) {
    await expect(envelope(p)).toBeVisible();
    await expect(navDot(p)).toBeVisible();
  }
  await expect(ac.page.locator('.letter-toast')).toBeVisible();

  // AC ouvre la lettre (toucher la carte) : les mots d'AL.
  await circleCard(ac.page).click();
  const letter = ac.page.getByRole('dialog', { name: 'Une lettre de AL' });
  await expect(letter).toContainText('Merci pour les crêpes');
  await expect(letter).toContainText('Je t’aime fort');
  await expect(letter).toContainText('Un besoin');
  // « Lu » : plus d'enveloppe, ni ici ni sur l'autre appareil d'AC.
  await expect(envelope(ac.page)).toHaveCount(0);
  await expect(envelope(ac2.page)).toHaveCount(0);
  await expect(navDot(ac2.page)).toHaveCount(0);
  await expect.poll(async () => (await readDoc('households/a2home/memberState/b'))?.circleSeen).toBeTruthy();

  // « Écrire ma part » depuis la lettre : le cercle s'ouvre sur la voix d'AC seulement.
  await letter.getByRole('button', { name: 'Écrire ma part' }).click();
  const circle = ac.page.getByRole('dialog', { name: 'Cercle de la semaine' });
  await expect(circle).toContainText('Étape 1 sur 3');
  await circle.getByRole('button', { name: 'Plus tard' }).click();
  await writeMyPart(ac.page, 'b', { thanks: 'Merci pour ta patience', burden: 'Rien de lourd', note: 'Bisous' });

  // AL reçoit la lettre d'AC ; la part d'AL est intacte partout.
  await expect(envelope(al.page)).toBeVisible();
  await circleCard(al.page).click();
  await expect(al.page.getByRole('dialog', { name: 'Une lettre de AC' })).toContainText('Bisous');
  for (const p of [al.page, ac.page, ac2.page]) {
    await expect
      .poll(async () => {
        const circles = ((await syncedState(p)).rituals?.circles ?? []) as Array<{ author?: string; notes?: Array<{ text: string }> }>;
        return circles.map((c) => `${c.author}:${c.notes?.[0]?.text}`).sort().join(' | ');
      })
      .toBe('a:Je t’aime fort | b:Bisous');
  }
  await closePhones(al, ac, ac2);
});
