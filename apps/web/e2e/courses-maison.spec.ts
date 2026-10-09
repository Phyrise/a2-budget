/**
 * Lien Courses ↔ Maison (invité, 100 % local). V5.2 : la tâche « Courses »
 * se crée d'un geste dans Maison, montre les articles restants et ouvre
 * Courses. V5.3 : elle est permanente — pas de « Quand ? », jamais au
 * Calendrier ; chaque fois (panier vidé ou ligne cochée) demande « qui ? »
 * et ajoute un fait, deux fois le même jour comprises ; la ligne reste.
 * Sans tâche liée, aucune question.
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
  test('tâche Courses permanente : deux courses le même jour, la ligne reste', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'maison');
    await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
    const dialog = sheet(page, 'Nouvelle tâche');
    const chip = dialog.getByRole('button', { name: 'Liée à la liste de courses' });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.locator('#task-title')).toHaveValue('Courses');
    // Permanente : pas de « Quand ? ».
    await expect(dialog.locator('#task-recurrence-weekly')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();

    const row = page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: 'Courses' });
    await expect(row.getByRole('button', { name: 'Liste de courses : vide' })).toBeVisible();
    // Une tâche Courses existe : la suggestion n'est plus offerte ailleurs.
    await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
    await expect(dialog.getByRole('button', { name: 'Liée à la liste de courses' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(dialog).toBeHidden();

    await row.getByRole('button', { name: 'Liste de courses : vide' }).click();
    await expect(page.locator('#courses-title')).toBeVisible();
    const pill = page.locator('#grocery-task-pill');
    await expect(pill).toBeVisible();
    await quickAdd(page, 'Pain', 'Lait');
    await goTo(page, 'Maison');
    await expect(row.getByRole('button', { name: /^Liste de courses : 2\s+articles$/ })).toBeVisible();

    // 1re fois : panier vidé → « qui ? » → Calcifer.
    await goTo(page, 'Courses');
    await emptyBasket(page, 'Pain');
    const who = sheet(page, 'Qui ?');
    await expect(who).toBeVisible({ timeout: 10_000 });
    await expect(who.locator('.companion')).toHaveCount(3);
    await who.locator('.who-did__choice[data-who="b"]').click();
    await expect(who).toBeHidden();
    await expect(page.locator('.toast')).toContainText('Fait : Courses');
    // La pastille reste, avec le repère de la dernière fois.
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('aujourd’hui');

    // 2e fois le même jour : panier vidé → Jiji.
    await emptyBasket(page, 'Lait');
    await expect(who).toBeVisible({ timeout: 10_000 });
    await who.locator('.who-did__choice[data-who="a"]').click();
    await expect(who).toBeHidden();

    // 3e fois depuis Maison : cocher la ligne → « qui ? » → ensemble ; la ligne reste.
    await goTo(page, 'Maison');
    await expect(row).toBeVisible();
    await expect(row).toContainText('aujourd’hui');
    await row.getByRole('checkbox', { name: 'Courses' }).click();
    await expect(who).toBeVisible();
    await who.locator('.who-did__choice[data-who="both"]').click();
    await expect(who).toBeHidden();
    await expect(page.locator('.toast').filter({ hasText: 'Fait : Courses' })).toBeVisible();
    await page.waitForTimeout(1600);
    await expect(row).toBeVisible();
    await expect(row.getByRole('checkbox', { name: 'Courses' })).toHaveAttribute('aria-checked', 'false');

    const state = await persisted(page);
    const task = state.chores.tasks.find((t: { groceries?: boolean }) => t.groceries === true);
    expect(task.title).toBe('Courses');
    const done = state.chores.completions.filter((c: { taskId: string }) => c.taskId === task.id);
    expect(done).toHaveLength(3);
    expect(new Set(done.map((c: { dueDate: string }) => c.dueDate)).size).toBe(3);
    expect(done.map((c: { doneBy?: string; assignee: string }) => c.doneBy ?? c.assignee)).toEqual(['b', 'a', 'both']);
    expect(state.forest.lifetimeCare).toBe(3);

    // Annuler la dernière (toast) : les deux premières restent.
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect
      .poll(async () => (await persisted(page)).chores.completions.filter((c: { taskId: string }) => c.taskId === task.id).length)
      .toBe(2);
    await expect(row).toBeVisible();

    // Jamais au Calendrier.
    await goTo(page, 'Calendrier');
    await expect(page.locator('.cal-day-panel .cal-task', { hasText: 'Courses' })).toHaveCount(0);
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
