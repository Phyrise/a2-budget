/**
 * QA « deux téléphones » — V5.1 quêtes communes, sur les émulateurs : AL
 * fait apparaître une quête (mode développeur, écrite dans le foyer), AC la
 * voit en temps réel ; AL aide (tête de Jiji des deux côtés), AC aide :
 * réglée des deux côtés, +3 kompeitō chacun, document Firestore complet.
 * Lancer : `node apps/web/scripts/qa-sync.mjs` (build émulateurs compris).
 */
import { expect, test, type Page } from '@playwright/test';
import { listDocs, openSettings, resetEmulators, waitForEmulators } from './helpers';
import { closePhones, go, twoPhones } from './phones';
import { openDev } from '../e2e/devPanel';

test.beforeAll(async () => {
  await waitForEmulators();
});

test.beforeEach(async () => {
  await resetEmulators();
});

const quest = (page: Page) => page.locator('.screen-sheet.calendar .quest');
const jarCount = async (page: Page) =>
  Number((await page.locator('[aria-label^="Bocal de kompeitō"]').first().getAttribute('aria-label'))?.match(/(\d+)/)?.[1] ?? 'NaN');

async function enableDev(page: Page): Promise<void> {
  const settings = await openSettings(page);
  const toggle = settings.getByRole('switch', { name: 'Mode développeur' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
}

test('quête à deux : AL la fait apparaître, les deux aident, récompense des deux côtés', async ({ browser }) => {
  const { al, ac } = await twoPhones(browser);
  await go(al.page, 'Budget');
  await go(ac.page, 'Budget');
  const jars = { al: await jarCount(al.page), ac: await jarCount(ac.page) };

  // AL fait apparaître une pousse (Calendrier) : écrite dans le foyer partagé.
  await enableDev(al.page);
  await (await openDev(al.page, 'Quêtes')).getByRole('button', { name: 'Pousse (Calendrier)' }).click();
  await expect(al.page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name: 'Calendrier', exact: true })).toHaveAttribute('aria-current', 'page');
  await go(ac.page, 'Calendrier');
  await expect(quest(al.page)).toHaveAttribute('data-status', 'waiting');
  await expect(quest(ac.page)).toHaveAttribute('data-status', 'waiting');
  const id = await quest(ac.page).getAttribute('data-quest');
  expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-pousse-d[a-z0-9]+$/);

  // AL aide : effet partiel et tête de Jiji, des deux côtés.
  await quest(al.page).click();
  for (const p of [al.page, ac.page]) {
    await expect(quest(p)).toHaveAttribute('data-status', 'half');
    await expect(quest(p).locator('.quest__head--a')).toHaveCount(1);
  }
  // Toucher encore ne compte pas deux fois.
  await quest(al.page).click();
  await expect(quest(al.page)).toHaveAttribute('data-status', 'half');

  // AC aide : réglée des deux côtés, petite fête.
  await quest(ac.page).click();
  await Promise.all([al.page, ac.page].map((p) => expect(quest(p).locator('.quest__head')).toHaveCount(2)));
  await Promise.all([al.page, ac.page].map((p) => expect(p.locator('.quest')).toHaveCount(0, { timeout: 8000 })));

  // Le document partagé : les deux aides, doneAt, créée par AL.
  await expect.poll(async () => {
    const doc = (await listDocs('households/a2home/quests'))[id!];
    const helpers = (doc?.helpers ?? {}) as Record<string, unknown>;
    return [doc?.createdBy, typeof helpers.a, typeof helpers.b, typeof doc?.doneAt].join(',');
  }).toBe('a,string,string,string');

  // +3 kompeitō chacun, dans le bocal partagé : +6 vus des deux côtés.
  await go(al.page, 'Budget');
  await go(ac.page, 'Budget');
  await expect.poll(() => jarCount(al.page)).toBe(jars.al + 6);
  await expect.poll(() => jarCount(ac.page)).toBe(jars.ac + 6);
  await closePhones(al, ac);
});
