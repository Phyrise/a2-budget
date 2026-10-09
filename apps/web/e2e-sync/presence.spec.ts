/**
 * QA « deux téléphones » V5.1 : présence de l'autre (sa tête sur l'icône de
 * son onglet), avatar de l'autre sur la barre du bas (V5.2), coucou, et bocal de
 * kompeitō partagé (somme des gestes des deux, jamais compté deux fois).
 * Lancer : `node apps/web/scripts/qa-sync.mjs` (build émulateurs compris).
 */
import { expect, test, type Page } from '@playwright/test';
import { readDoc, resetEmulators, waitForEmulators } from './helpers';
import { closePhones, go, transfer, twoPhones } from './phones';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

const navButton = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name, exact: true });

test('AL change d’onglet : AC voit Jiji sur l’icône ; même onglet : coucou', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(ac.page, 'Budget');
  await go(al.page, 'Maison');

  // Chez AC : la tête de Jiji (rôle a) sur l'icône Maison, nulle part ailleurs.
  await expect(navButton(ac.page, 'Maison').locator('.partner-head[data-who="a"]')).toBeVisible();
  await expect(ac.page.locator('.partner-head')).toHaveCount(1);
  // Le nom du bouton ne change pas (tête décorative).
  await expect(navButton(ac.page, 'Maison')).toHaveAccessibleName('Maison');

  // AL suit sur Courses : la tête le suit.
  await go(al.page, 'Courses');
  await expect(navButton(ac.page, 'Courses').locator('.partner-head')).toBeVisible();
  await expect(navButton(ac.page, 'Maison').locator('.partner-head')).toHaveCount(0);

  // Même onglet : chacun voit le compagnon de l'autre entrer sur la barre du bas (V5.2).
  await go(al.page, 'Budget');
  const toAl = ac.page.getByRole('button', { name: 'Coucou à AL' });
  await expect(toAl).toBeVisible();
  await expect(al.page.getByRole('button', { name: 'Coucou à AC' })).toBeVisible();
  await expect(ac.page.getByTestId('partner-avatar')).toHaveCount(1);
  // Il a fini d'entrer (sinon il est encore hors de l'écran) et il est à portée de doigt.
  await expect(ac.page.getByTestId('partner-avatar')).not.toHaveAttribute('data-phase', 'enter', { timeout: 8_000 });
  await expect(toAl).toBeInViewport();

  // Coucou d'AC (toucher Jiji) : Jiji saute avec un ♡ chez AC ; chez AL, son
  // Jiji saute dans l'en-tête et Calcifer (l'avatar d'AC) fait coucou.
  await toAl.click({ force: true });
  await expect(ac.page.getByTestId('partner-avatar-heart')).toBeVisible();
  await expect(al.page.locator('.presence.is-poked .presence__heart')).toBeVisible();
  await expect(al.page.getByRole('status').filter({ hasText: 'Coucou de AC' })).toHaveCount(1);
  await expect(al.page.locator('[data-testid="partner-avatar"][data-react="wave"]')).toHaveCount(1);

  // AL ferme l'app (arrière-plan) : il n'est plus là chez AC.
  await al.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(toAl).toHaveCount(0);
  await expect(ac.page.locator('.partner-head')).toHaveCount(0);
  await closePhones(al, ac);
});

test('bocal partagé : la somme des gestes des deux, sans double compte', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(al.page, 'Budget');
  await go(ac.page, 'Budget');
  const count = (page: Page) => page.getByTestId('konpeito-count');
  await expect(count(al.page)).toHaveText('20');
  await expect(count(ac.page)).toHaveText('20');

  // Chacun coche son virement : +1 chacun, le virement de l'autre reçu n'ajoute rien.
  await transfer(al.page, 'AL').click();
  await expect(count(ac.page)).toHaveText('21');
  await transfer(ac.page, 'AC').click();
  await expect(count(al.page)).toHaveText('22');
  await expect(count(ac.page)).toHaveText('22');

  // Après rechargement, le total vient du serveur (pas de la copie locale).
  await ac.page.reload();
  await expect(count(ac.page)).toHaveText('22');
  await closePhones(al, ac);
});

test('V5.6 : AL choisit Teto dans ses Réglages, AC voit Teto (tête, avatar) et ne peut plus le prendre', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(ac.page, 'Budget');
  await go(al.page, 'Maison');

  // AL : seule sa carte propose le choix (connecté).
  await al.page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settingsAl = al.page.getByRole('dialog', { name: 'Réglages', exact: true });
  await expect(settingsAl.locator('.settings-person--b').getByRole('button', { name: /^Changer de compagnon/ })).toHaveCount(0);
  await settingsAl.locator('.settings-person--a').getByRole('button', { name: /^Changer de compagnon/ }).click();
  await settingsAl.getByRole('radio', { name: 'Teto', exact: true }).click();
  await expect(settingsAl.locator('.settings-person--a .settings-person__companion')).toHaveText('avec Teto');
  // V5.7 : le choix est écrit dans la fiche du compte d'AL.
  await expect.poll(async () => (await readDoc('households/a2home/memberState/a'))?.companion).toBe('teto');

  // Chez AC : la tête d'AL sur l'icône Maison est Teto.
  await expect(navButton(ac.page, 'Maison').locator('.partner-head img')).toHaveAttribute('src', /teto-/);

  // Même onglet : c'est Teto qui vient sur la barre du bas.
  await go(ac.page, 'Maison');
  await al.page.keyboard.press('Escape');
  await expect(ac.page.getByTestId('partner-avatar')).toHaveAttribute('data-companion', 'teto');

  // AC : Teto est pris, grisé dans son choix.
  await ac.page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settingsAc = ac.page.getByRole('dialog', { name: 'Réglages', exact: true });
  await settingsAc.locator('.settings-person--b').getByRole('button', { name: /^Changer de compagnon/ }).click();
  await expect(settingsAc.getByRole('radio', { name: /^Teto/ })).toBeDisabled();
  await closePhones(al, ac);
});
