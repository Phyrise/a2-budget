/**
 * QA « deux téléphones » V5.7 : le compagnon choisi reste lié au compte.
 * Le choix vit dans la fiche `memberState/{rôle}` de chacun (docs/SYNC_DESIGN.md
 * §24) : il survit au rechargement, aux réglages modifiés par l'autre, à un
 * téléphone resté sur une ancienne version qui réécrit les réglages, et revient
 * du serveur sur un nouvel appareil.
 * Lancer : `node apps/web/scripts/qa-sync.mjs` (build émulateurs compris).
 */
import { expect, test, type Page } from '@playwright/test';
import { APP, ARTHUR, SYNC_READY, chooseSetup, fakeGoogle, readDoc, resetEmulators, setupScreen, syncIndicator, waitForEmulators } from './helpers';
import { closePhones, go, syncedState, twoPhones } from './phones';
import { openDev } from '../e2e/devPanel';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

const FIRESTORE = 'http://127.0.0.1:8180/v1/projects/demo-a2home/databases/(default)/documents';

/** Choisit le compagnon de `who` dans ses Réglages, puis les ferme. */
async function pick(page: Page, who: 'a' | 'b', name: string): Promise<void> {
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages', exact: true });
  await settings.locator(`.settings-person--${who}`).getByRole('button', { name: /^Changer de compagnon/ }).click();
  await settings.getByRole('radio', { name, exact: true }).click();
  await expect(settings.locator(`.settings-person--${who} .settings-person__companion`)).toHaveText(`avec ${name}`);
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
}

/** Compagnon affiché pour `who` dans les Réglages (lu puis refermé). */
async function shown(page: Page, who: 'a' | 'b'): Promise<string> {
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages', exact: true });
  const text = (await settings.locator(`.settings-person--${who} .settings-person__companion`).textContent()) ?? '';
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  return text.trim();
}

/** Compagnon d'AL vu par AC : tête d'AL sur l'icône de son onglet. */
async function expectPartnerHead(page: Page, id: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Modules de la maison' });
  await expect(nav.locator('.partner-head img')).toHaveAttribute('src', new RegExp(`${id}-`));
}

/** Le choix d'AL est écrit dans sa fiche (serveur). */
async function expectStored(id: string): Promise<void> {
  await expect.poll(async () => (await readDoc('households/a2home/memberState/a'))?.companion).toBe(id);
}

test('AL choisit Hin puis recharge : toujours Hin (fiche du compte)', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await pick(al.page, 'a', 'Hin');
  await expectStored('hin');
  // Réglages réécrits sans compagnon et copie locale effacée : seule la fiche du serveur peut le rendre.
  await oldAppRewrite();
  await al.page.evaluate(() => window.localStorage.removeItem('a2-budget:companions:v1'));
  await al.page.reload();
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  expect(await shown(al.page, 'a')).toBe('avec Hin');
  await closePhones(al, ac);
});

test('AL choisit Teto, AC change son salaire : AL reste Teto chez les deux', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(al.page, 'Budget');
  await go(ac.page, 'Budget');
  await pick(al.page, 'a', 'Teto');
  await expectStored('teto');
  await expectPartnerHead(ac.page, 'teto');

  await ac.page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = ac.page.getByRole('dialog', { name: 'Réglages', exact: true });
  const salary = settings.locator('#base-salary-b');
  await salary.click();
  await salary.press('ControlOrMeta+a');
  await salary.pressSequentially('2345');
  await salary.press('Enter');
  const name = settings.locator('#person-name-b');
  await name.fill('Lexi');
  await name.press('Enter');
  await ac.page.keyboard.press('Escape');
  await expect
    .poll(async () => (await readDoc('households/a2home/settings/budget'))?.personB as { name?: string; baseSalaryCents?: number } | undefined)
    .toMatchObject({ name: 'Lexi', baseSalaryCents: 234_500 });

  // Reçu chez AL (copie locale de la synchronisation).
  await expect.poll(async () => (await syncedState(al.page)).budget?.settings?.personB?.name).toBe('Lexi');
  expect(await shown(al.page, 'a')).toBe('avec Teto');
  expect(await shown(ac.page, 'a')).toBe('avec Teto');
  await expectPartnerHead(ac.page, 'teto');
  await closePhones(al, ac);
});

/** Réécrit `settings/budget` comme une ancienne version : mêmes réglages, sans `companion`. */
async function oldAppRewrite(): Promise<void> {
  const url = `${FIRESTORE}/households/a2home/settings/budget`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
  expect(res.ok).toBe(true);
  const body = (await res.json()) as { fields: Record<string, any> };
  const fields = { ...body.fields };
  for (const p of ['personA', 'personB']) {
    const person = { ...(fields[p]?.mapValue?.fields ?? {}) };
    delete person.companion;
    fields[p] = { mapValue: { fields: person } };
  }
  fields.syncedAt = { timestampValue: new Date().toISOString() };
  fields.updatedAt = { stringValue: new Date().toISOString() };
  const write = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  expect(write.ok).toBe(true);
}

test('ancienne version : réglages réécrits sans compagnon, AL reste Teto chez les deux', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(al.page, 'Budget');
  await go(ac.page, 'Budget');
  await pick(al.page, 'a', 'Teto');
  await expectStored('teto');
  await expectPartnerHead(ac.page, 'teto');

  await oldAppRewrite();
  await expect.poll(async () => ((await readDoc('households/a2home/settings/budget'))?.personA as { companion?: string })?.companion).toBeUndefined();
  // La réécriture arrive aux deux (écouteurs) ; on recharge AC pour tout relire.
  await ac.page.reload();
  await expect(syncIndicator(ac.page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  expect(await shown(al.page, 'a')).toBe('avec Teto');
  expect(await shown(ac.page, 'a')).toBe('avec Teto');
  await expectPartnerHead(ac.page, 'teto');
  await closePhones(al, ac);
});

test('AL choisit Hin, ancienne version passe, AL rouvre sur un autre appareil : Hin revient du serveur', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await pick(al.page, 'a', 'Hin');
  await expectStored('hin');
  await closePhones(al);
  // Les réglages ne le disent plus : seule la fiche du compte le garde.
  await oldAppRewrite();

  // Nouvel appareil (aucune copie locale), même compte.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(APP);
  await fakeGoogle(page, ARTHUR);
  await expect(setupScreen(page)).toBeVisible();
  await chooseSetup(page, 'La rejoindre');
  await expect(syncIndicator(page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  await expect.poll(() => shown(page, 'a')).toBe('avec Hin');
  // AC n'a jamais choisi : Calcifer.
  expect(await shown(ac.page, 'b')).toBe('avec Calcifer');
  await closePhones({ context, page }, ac);
});

/** Un choix écrit dans les réglages seulement, comme la V5.6. */
async function v56Choice(role: 'personA' | 'personB', id: string): Promise<void> {
  const url = `${FIRESTORE}/households/a2home/settings/budget?updateMask.fieldPaths=${role}.companion&updateMask.fieldPaths=syncedAt`;
  const write = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: { [role]: { mapValue: { fields: { companion: { stringValue: id } } } }, syncedAt: { timestampValue: new Date().toISOString() } },
    }),
  });
  expect(write.ok).toBe(true);
}

test('reprise : un choix de la V5.6 (réglages seulement) passe dans la fiche au démarrage', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await v56Choice('personA', 'teto');
  await al.page.reload();
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  await expectStored('teto');
  // AC ne reprend jamais le choix d'AL (seul le propriétaire écrit sa fiche).
  expect((await readDoc('households/a2home/memberState/b'))?.companion).toBeUndefined();
  await expect.poll(() => shown(al.page, 'a')).toBe('avec Teto');
  await expect.poll(() => shown(ac.page, 'a')).toBe('avec Teto');
  await closePhones(al, ac);
});

test('remise à zéro (mode développeur) : les réglages repartent de zéro, le compagnon d’AL reste', async ({ browser }) => {
  test.setTimeout(180_000);
  const { al, ac } = await twoPhones(browser);
  await go(ac.page, 'Budget');
  await pick(al.page, 'a', 'Teto');
  await expectStored('teto');
  await expectPartnerHead(ac.page, 'teto');

  // Mode développeur (préférence d'interface), puis « Tout remettre à zéro ».
  await al.page.evaluate(() => {
    const ui = JSON.parse(localStorage.getItem('a2-budget:ui:v1') ?? '{}') as Record<string, unknown>;
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ ...ui, devMode: true }));
  });
  await al.page.reload();
  await expect(syncIndicator(al.page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  await go(al.page, 'Maison');
  const dev = await openDev(al.page, 'Remise à zéro');
  await dev.getByRole('button', { name: 'Tout remettre à zéro' }).click();
  await dev.getByRole('button', { name: 'Sûr ?' }).click();
  await expect.poll(async () => (await readDoc('households/a2home'))?.resetting, { timeout: 30_000 }).toBe(false);
  await al.page.keyboard.press('Escape');
  for (const p of [al.page, ac.page]) await expect(syncIndicator(p)).toHaveAttribute('title', 'À jour', SYNC_READY);

  await expectStored('teto');
  await expect.poll(() => shown(al.page, 'a')).toBe('avec Teto');
  await expect.poll(() => shown(ac.page, 'a')).toBe('avec Teto');
  await ac.page.reload();
  await expect(syncIndicator(ac.page)).toHaveAttribute('title', 'À jour', SYNC_READY);
  await expect.poll(() => shown(ac.page, 'a')).toBe('avec Teto');
  await closePhones(al, ac);
});

