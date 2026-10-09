/**
 * Mode développeur — remise à zéro en invité (sur ce téléphone) : effacer
 * les lettres de la semaine (le cercle d'avant reste), puis tout remettre à
 * zéro (données et mémoires locales : quêtes, bocal). Chaque bouton demande
 * un second toucher « Sûr ? ». Connecté (deux téléphones) :
 * e2e-sync/qa-reset.spec.ts.
 */
import { addDays, createTask, emptyAppState, localDateKey, validateAppState, weekStartKey, type Circle } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

const QUESTS_KEY = 'a2-budget:quests:v1';
const PLAY_KEY = 'a2-budget:play:v1';

function circle(weekStart: string, text: string): Circle {
  return { id: `c-${weekStart}`, weekStart, heldAt: `${weekStart}T18:00:00.000Z`, gratitude: [{ from: 'a', to: 'b', text }], burdens: [], intentions: [] };
}

async function openSeeded(page: Page) {
  const today = new Date();
  // La semaine du cercle : le lundi, c'est encore celle d'avant.
  const ref = today.getDay() === 1 ? addDays(today, -1) : today;
  const thisWeek = weekStartKey(ref);
  const before = weekStartKey(addDays(ref, -14));
  const base = emptyAppState();
  const state = {
    ...base,
    chores: { ...base.chores, tasks: [createTask({ id: 'plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily' }, localDateKey(today))] },
    rituals: { circles: [circle(before, 'avant'), circle(thisWeek, 'cette semaine')] },
  };
  const v = validateAppState(state);
  if (!v.ok) throw new Error(v.reason);
  await page.addInitScript(
    ({ key, ui, value, quests, play }) => {
      if (sessionStorage.getItem('reset-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: false, offlineAnnounced: true, devMode: true }));
      localStorage.setItem(quests, JSON.stringify({ shown: ['q1'], rewarded: ['q1'], helped: ['q1'] }));
      localStorage.setItem(play, JSON.stringify({ v: 1, jar: 42, caught: 7, golden: 1 }));
      sessionStorage.setItem('reset-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(v.state), quests: QUESTS_KEY, play: PLAY_KEY },
  );
  await page.goto(`${APP}?module=maison`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
  return { thisWeek, before };
}

async function openDev(page: Page) {
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = sheet(page, 'Mode développeur');
  await expect(dev.getByRole('heading', { name: 'Remise à zéro' })).toBeVisible();
  return dev;
}

test('invité : effacer les lettres de la semaine, puis tout remettre à zéro', async ({ page }) => {
  const errors = trackErrors(page);
  const { thisWeek, before } = await openSeeded(page);
  const weeks = async () => ((await persisted(page)).rituals?.circles ?? []).map((c: Circle) => c.weekStart).sort();
  expect(await weeks()).toEqual([before, thisWeek]);

  // Lettres : un toucher arme (« Sûr ? »), le second efface ; le cercle d'avant reste.
  let dev = await openDev(page);
  const letters = dev.getByRole('button', { name: 'Effacer les lettres de la semaine' });
  await letters.click();
  await expect(dev.getByRole('button', { name: 'Sûr ?' })).toBeVisible();
  expect(await weeks()).toEqual([before, thisWeek]);
  await dev.getByRole('button', { name: 'Sûr ?' }).click();
  await expect.poll(weeks).toEqual([before]);
  expect((await persisted(page)).chores.tasks).toHaveLength(1);

  // Sans second toucher dans les 4 s : rien.
  await dev.getByRole('button', { name: 'Tout remettre à zéro' }).click();
  await expect(dev.getByRole('button', { name: 'Sûr ?' })).toBeVisible();
  await expect(dev.getByRole('button', { name: 'Tout remettre à zéro' })).toBeVisible({ timeout: 6_000 });
  expect((await persisted(page)).chores.tasks).toHaveLength(1);

  // Tout : données et mémoires locales ; les préférences restent.
  await dev.getByRole('button', { name: 'Tout remettre à zéro' }).click();
  await dev.getByRole('button', { name: 'Sûr ?' }).click();
  await expect(dev).toBeHidden();
  await expect.poll(async () => (await persisted(page))?.chores?.tasks?.length ?? -1).toBe(0);
  expect(await weeks()).toEqual([]);
  const keys = await page.evaluate(([q, p, ui]) => [localStorage.getItem(q), localStorage.getItem(p), JSON.parse(localStorage.getItem(ui) ?? '{}').devMode], [QUESTS_KEY, PLAY_KEY, UI_KEY]);
  expect(keys).toEqual([null, null, true]);

  // Rien ne revient au rechargement.
  await page.reload();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  expect((await persisted(page)).chores.tasks).toEqual([]);
  dev = await openDev(page);
  await expect(dev.getByText('Sur ce téléphone.')).toBeVisible();
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});
