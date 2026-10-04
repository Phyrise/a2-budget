/**
 * Maison V3.1 (retours d'Arthur) : « À venir » replié avec aperçu, dépliable,
 * « +7 autres » par jour, suppression depuis « À venir » ; carte « Le partage
 * de la semaine » expliquée ; plus de bouton de pause en bas de Maison (la
 * carte « La maison est en pause » réveille la forêt).
 * États de départ construits avec @a2/core (validateAppState).
 */
import { addDays, createTask, emptyAppState, isoWeekday, localDateKey, pauseForest, validateAppState, type AppState, type HouseholdTask } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, goTo, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

const BUSY = [
  'Changer les draps',
  'Laver les vitres',
  'Passer la serpillière',
  'Détartrer la bouilloire',
  'Trier le courrier',
  'Ranger le garage',
  'Nettoyer le four',
  'Arroser le balcon',
  'Repasser les chemises',
  'Vider le frigo',
];

/** Une tâche demain, dix le même jour dans six jours. */
function busyState(paused = false): AppState {
  const now = new Date();
  const wd = isoWeekday(now);
  const inDays = (n: number) => ((wd - 1 + n) % 7) + 1;
  const created = localDateKey(addDays(now, -10));
  const s = emptyAppState();
  const tasks: HouseholdTask[] = [
    createTask({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'b', recurrence: 'weekly', weeklyDay: inDays(1) }, created),
    ...BUSY.map((title, i) =>
      createTask({ id: `t-busy-${i}`, title, assignee: i % 2 === 0 ? 'a' : 'b', recurrence: 'weekly', weeklyDay: inDays(6) }, created),
    ),
  ];
  const state: AppState = { ...s, chores: { ...s.chores, tasks }, forest: paused ? pauseForest(s.forest, localDateKey(now)) : s.forest };
  const v = validateAppState(state);
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

async function openSeeded(page: Page, state: AppState) {
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('v31-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('v31-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(state) },
  );
  await page.goto(`${APP}?module=maison`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

test.describe('Maison V3.1', () => {
  test('« À venir » replié, déplié, « +7 autres », puis suppression d’une tâche à venir', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page, busyState());
    const section = page.locator('.upcoming-section');
    await expect(section.locator('.section-head__meta')).toHaveText(/Cette semaine · 11\s+tâches/);
    const toggle = section.locator('.upcoming-fold .disclosure__toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toContainText('Demain');
    await expect(toggle).toContainText('Sortir les poubelles');
    // Replié : rien d'actionnable dans la liste.
    await expect(section.locator('.upcoming-fold .disclosure__panel')).toHaveAttribute('inert', '');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const busyDay = section.locator('.upcoming__day').filter({ hasText: 'Changer les draps' });
    await expect(busyDay.locator('.upcoming__item')).toHaveCount(3);
    const more = busyDay.locator('.upcoming__more');
    await expect(more).toHaveText(/\+7\s+autres/);
    await more.click();
    await expect(busyDay.locator('.upcoming__item')).toHaveCount(10);
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    // L'état ouvert est gardé en changeant de module.
    await goTo(page, 'Budget');
    await goTo(page, 'Maison');
    await expect(page.locator('.upcoming-fold .disclosure__toggle')).toHaveAttribute('aria-expanded', 'true');

    // Toucher une tâche à venir : son édition, d'où on peut la supprimer.
    await page.getByRole('button', { name: /Modifier «\s*Changer les draps\s*»/ }).click();
    const dialog = sheet(page, 'Modifier la tâche');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#task-title')).toHaveValue('Changer les draps');
    await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: /Supprimer cette tâche/ });
    await confirm.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.upcoming__item').filter({ hasText: 'Changer les draps' })).toHaveCount(0);
    await expect.poll(async () => (await persisted(page)).chores.tasks.length).toBe(10);
    await expect(page.locator('.upcoming-section .section-head__meta')).toHaveText(/10\s+tâches/);
    expect(errors).toEqual([]);
  });

  test('le partage de la semaine s’explique, sans chiffre', async ({ page }) => {
    await openSeeded(page, busyState());
    const balance = page.locator('.balance');
    await expect(balance.getByRole('heading', { name: 'Le partage de la semaine' })).toBeVisible();
    await expect(balance.locator('.balance__lead')).toContainText('Chaque tâche faite pèse selon son effort');
    const how = balance.getByRole('button', { name: /Comment ça marche/ });
    await expect(how).toHaveAttribute('aria-expanded', 'false');
    await how.click();
    await expect(how).toHaveAttribute('aria-expanded', 'true');
    await expect(balance.locator('.balance-how')).toContainText('Une tâche faite ensemble se partage en deux');
    await expect(balance).not.toContainText(/\d/);
  });

  test('pause : plus de bouton en bas de Maison ; la carte réveille la forêt', async ({ page }) => {
    await openSeeded(page, busyState(true));
    await expect(page.locator('.screen-sheet').getByRole('button', { name: /Mettre la maison en pause/ })).toHaveCount(0);
    const card = page.locator('.pause-card');
    await expect(card).toBeVisible();
    await expect(page.locator('.maison-hero__mood')).toHaveText('La forêt dort');
    await card.getByRole('button', { name: 'Réveiller la forêt', exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect.poll(async () => (await persisted(page)).forest.paused).toBe(false);
    await expect(page.locator('.screen-sheet').getByRole('button', { name: /Mettre la maison en pause/ })).toHaveCount(0);
  });
});
