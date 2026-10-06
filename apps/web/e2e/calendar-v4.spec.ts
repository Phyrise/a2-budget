/**
 * Calendrier V4 (retours d'Arthur) : un seul « + » ; la note d'un événement
 * se voit (plume + première ligne) ; les tâches de la maison à date fixe
 * apparaissent (pas les quotidiennes), cochables le jour même, barrées une
 * fois faites, en lecture les autres jours ; « Afficher les tâches » est
 * mémorisé. États de départ construits avec @a2/core (validateAppState).
 */
import { addDays, addEvent, createTask, emptyAppState, isoWeekday, localDateKey, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, persisted, trackErrors } from './helpers';

test.use({ viewport: PHONE });

function seeded(): AppState {
  const now = new Date();
  const created = localDateKey(addDays(now, -10));
  const wd = isoWeekday(now);
  const tomorrow = (wd % 7) + 1;
  const s = emptyAppState();
  const tasks = [
    createTask({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'b', recurrence: 'weekly', weeklyDay: wd }, created),
    createTask({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: tomorrow }, created),
    createTask({ id: 't-vaisselle', title: 'Faire la vaisselle', assignee: 'both', recurrence: 'daily' }, created),
  ];
  const r = addEvent([], {
    id: 'evt-canape',
    title: 'Livraison du canapé',
    date: localDateKey(addDays(now, 1)),
    kind: 'maison',
    who: 'a',
    note: '\nEntre 8 h et 13 h\nCode porte 4521',
    createdAt: now.toISOString(),
  });
  if (!r.ok) throw new Error(r.reason);
  const state: AppState = { ...s, chores: { ...s.chores, tasks }, calendar: { events: r.events } };
  const v = validateAppState(JSON.parse(JSON.stringify(state)));
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

async function openSeeded(page: Page) {
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('v4-cal-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'calendar', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('v4-cal-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(seeded()) },
  );
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();
}

test.describe('Calendrier V4', () => {
  test('un seul « + », et la note se voit en petit', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page);
    await expect(page.locator('.calendar button[aria-label^="Ajouter"]')).toHaveCount(1);
    await expect(page.locator('#cal-quick-input')).toHaveCount(0);
    const row = page.locator('.cal-upcoming-section .cal-event', { hasText: 'Livraison du canapé' });
    await expect(row.locator('.cal-event__note')).toHaveText('Entre 8 h et 13 h');
    await expect(row.locator('.cal-event__note-icon')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('tâches : cochables le jour même, barrées ensuite, en lecture les autres jours', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page);
    const today = page.locator('.cal-day-panel');
    const plants = today.locator('.cal-task', { hasText: 'Arroser les plantes' });
    await expect(plants).toBeVisible();
    await expect(page.locator('.calendar').getByText('Faire la vaisselle')).toHaveCount(0);
    // Demain : en lecture, dans « À venir ».
    const bins = page.locator('.cal-upcoming-section .cal-task', { hasText: 'Sortir les poubelles' });
    await expect(bins).toBeVisible();
    await expect(bins.getByRole('checkbox')).toHaveCount(0);
    // La grille porte un petit anneau sur aujourd'hui.
    await expect(page.locator('.cal-day.is-today .cal-day__task')).toHaveCount(1);

    const box = plants.getByRole('checkbox');
    await box.click();
    await expect(box).toHaveAttribute('aria-checked', 'true');
    await expect(plants).toHaveClass(/is-done/);
    await expect(page.locator('.toast')).toContainText('Fait : Arroser les plantes');
    const state = await persisted(page);
    expect(state.chores.completions.some((c: { taskId: string }) => c.taskId === 't-plantes')).toBe(true);
    // Toujours affichée, barrée.
    await expect(plants.locator('.cal-task__title')).toHaveCSS('text-decoration-line', 'line-through');
    expect(errors).toEqual([]);
  });

  test('« Afficher les tâches » est mémorisé', async ({ page }) => {
    await openSeeded(page);
    const toggle = page.getByRole('button', { name: 'Afficher les tâches' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.cal-task')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Afficher les tâches' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.cal-task')).toHaveCount(0);
  });
});
