/**
 * V5.2 — lien Courses ↔ Maison (invité, 100 % local) : la tâche « Courses »
 * se crée d'un geste dans Maison, montre les articles restants et ouvre
 * Courses ; vider le panier demande « qui ? » et la tâche est faite dans
 * Maison et le Calendrier. Sans tâche liée, aucune question.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, goTo, openApp, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function quickAdd(page: Page, ...texts: string[]) {
  const input = page.locator('#grocery-input');
  for (const text of texts) {
    await input.fill(text);
    await input.press('Enter');
    await expect(input).toHaveValue('');
  }
}

async function emptyBasket(page: Page, ...labels: string[]) {
  for (const label of labels) await page.getByRole('checkbox', { name: label, exact: true }).click();
  await expect(page.locator('.item-list--basket .item-row')).toHaveCount(labels.length);
  await page.getByRole('button', { name: 'Vider le panier' }).click();
}

test.describe('Courses ↔ Maison', () => {
  test('tâche liée : compteur, « qui ? », faite dans Maison et le Calendrier', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'maison');
    await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
    const dialog = sheet(page, 'Nouvelle tâche');
    const chip = dialog.getByRole('button', { name: 'Liée à la liste de courses' });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.locator('#task-title')).toHaveValue('Courses');
    await expect(dialog.locator('#task-recurrence-weekly')).toBeChecked();
    await expect(dialog.locator('#task-weekmode-flexible')).toBeChecked();
    // Un jour précis (aujourd'hui par défaut) : visible dans le Calendrier.
    await dialog.locator('#task-weekmode-fixed').check();
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();

    const row = page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: 'Courses' });
    await expect(row.getByRole('button', { name: 'Liste de courses : vide' })).toBeVisible();
    // Une seule tâche liée : la suggestion n'est plus offerte.
    await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
    await expect(dialog.getByRole('button', { name: 'Liée à la liste de courses' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(dialog).toBeHidden();

    await row.getByRole('button', { name: 'Liste de courses : vide' }).click();
    await expect(page.locator('#courses-title')).toBeVisible();
    await expect(page.locator('#grocery-task-pill')).toContainText('Aujourd’hui');
    await quickAdd(page, 'Pain', 'Lait');
    await goTo(page, 'Maison');
    await expect(row.getByRole('button', { name: /^Liste de courses : 2\s+articles$/ })).toBeVisible();

    await goTo(page, 'Courses');
    await emptyBasket(page, 'Pain');
    const who = sheet(page, 'Qui ?');
    await expect(who).toBeVisible({ timeout: 10_000 });
    await expect(who.locator('.companion')).toHaveCount(3);
    await who.locator('.who-did__choice[data-who="b"]').click();
    await expect(who).toBeHidden();
    await expect(page.locator('.toast')).toContainText('Fait : Courses');
    await expect(page.locator('#grocery-task-pill')).not.toHaveClass(/is-open/);

    const state = await persisted(page);
    const task = state.chores.tasks.find((t: { groceries?: boolean }) => t.groceries === true);
    expect(task.title).toBe('Courses');
    const done = state.chores.completions.filter((c: { taskId: string }) => c.taskId === task.id);
    expect(done).toHaveLength(1);
    expect(done[0].doneBy).toBe('b');
    expect(state.forest.lifetimeCare).toBeGreaterThan(0);

    await goTo(page, 'Maison');
    await expect(page.locator('.task-list--done .task-row').filter({ hasText: 'Courses' })).toBeVisible();
    await goTo(page, 'Calendrier');
    const cal = page.locator('.cal-day-panel .cal-task', { hasText: 'Courses' });
    await expect(cal).toHaveClass(/is-done/);
    expect(errors).toEqual([]);
  });

  test('sans tâche liée : vider le panier ne demande rien', async ({ page }) => {
    await openApp(page, 'courses');
    await expect(page.locator('#grocery-task-pill')).toHaveCount(0);
    await quickAdd(page, 'Riz');
    await emptyBasket(page, 'Riz');
    await expect(page.locator('.toast')).toContainText('rangé', { timeout: 10_000 });
    await expect(sheet(page, 'Qui ?')).toHaveCount(0);
  });
});
