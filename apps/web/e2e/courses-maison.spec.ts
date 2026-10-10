/**
 * Lien Courses ↔ Maison (invité, 100 % local). V5.2 : la tâche « Courses »
 * se crée d'un geste dans Maison, montre les articles restants et ouvre
 * Courses. V5.3 : elle est permanente — pas de « Quand ? », jamais au
 * Calendrier ; chaque fois (panier vidé ou ligne cochée) demande « qui ? »
 * et ajoute un fait, deux fois le même jour comprises. V5.4 : faite, elle
 * quitte « à faire » ; un article ajouté ensuite la ramène ; plus de rappel
 * dans le bandeau de Courses. Sans tâche liée, aucune question.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, goTo, openApp, persisted, pickWho, sheet, trackErrors } from './helpers';

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

/** Maison : crée la tâche Courses liée à la liste. */
async function addGroceryTask(page: Page) {
  await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const dialog = sheet(page, 'Nouvelle tâche');
  await dialog.getByRole('button', { name: 'Liée à la liste de courses' }).click();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe('Courses ↔ Maison', () => {
  test('tâche Courses : faite → quitte « à faire », un article ajouté la ramène', async ({ page }) => {
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
    // V5.4 : plus de rappel de la tâche dans le bandeau.
    await expect(page.locator('.grocery-task-pill')).toHaveCount(0);
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

    // Maison : plus dans « à faire », mais dans « Fait aujourd’hui ».
    await goTo(page, 'Maison');
    await expect(row).toHaveCount(0);
    const doneList = page.getByRole('button', { name: /Fait aujourd’hui/ });
    await expect(doneList).toContainText('1');

    // Un article ajouté après : elle revient.
    await goTo(page, 'Courses');
    await quickAdd(page, 'Beurre');
    await goTo(page, 'Maison');
    await expect(row).toHaveCount(1);

    // 2e fois depuis Maison : cocher → « qui ? » → ensemble ; la ligne s'en va.
    await row.getByRole('checkbox', { name: 'Courses' }).click();
    await pickWho(page, 'both');
    await expect(row).toHaveCount(0, { timeout: 5_000 });
    await expect(doneList).toContainText('2');

    // Annuler la dernière (« Fait aujourd’hui ») la ramène ; la première reste.
    await doneList.click();
    await page.getByRole('checkbox', { name: 'Courses (annuler)' }).first().click();
    await expect(row).toHaveCount(1);
    await expect(doneList).toContainText('1');
    await row.getByRole('checkbox', { name: 'Courses' }).click();
    await pickWho(page, 'both');
    await expect(row).toHaveCount(0, { timeout: 5_000 });

    // 3e fois le même jour, depuis Courses : Jiji.
    await goTo(page, 'Courses');
    await emptyBasket(page, 'Lait');
    await expect(who).toBeVisible({ timeout: 10_000 });
    await who.locator('.who-did__choice[data-who="a"]').click();
    await expect(who).toBeHidden();

    const state = await persisted(page);
    const task = state.chores.tasks.find((t: { groceries?: boolean }) => t.groceries === true);
    expect(task.title).toBe('Courses');
    const done = state.chores.completions.filter((c: { taskId: string }) => c.taskId === task.id);
    expect(done).toHaveLength(3);
    expect(new Set(done.map((c: { dueDate: string }) => c.dueDate)).size).toBe(3);
    expect(done.map((c: { doneBy?: string; assignee: string }) => c.doneBy ?? c.assignee)).toEqual(['b', 'both', 'a']);

    // Jamais au Calendrier.
    await goTo(page, 'Calendrier');
    await expect(page.locator('.cal-day-panel .cal-task', { hasText: 'Courses' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Annuler après « Vider le panier » : articles, historique et fait Maison reviennent', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'maison');
    await addGroceryTask(page);
    await goTo(page, 'Courses');
    await quickAdd(page, 'Pain', 'Lait', 'Œufs');
    await emptyBasket(page, 'Pain', 'Lait');
    await pickWho(page, 'a');
    const toast = page.locator('.toast');
    await expect(toast).toContainText('Fait : Courses');
    await expect(page.locator('.item-row')).toHaveCount(1);
    let state = await persisted(page);
    expect(state.chores.completions).toHaveLength(1);
    expect(state.groceries.history.map((p: { label: string }) => p.label).sort()).toEqual(['Lait', 'Pain']);

    await toast.getByRole('button', { name: 'Annuler' }).click();
    // Les articles reviennent au panier, cochés, dans leur ordre.
    await expect(page.locator('.item-list--basket .item-row')).toHaveCount(2);
    await expect(page.getByRole('checkbox', { name: 'Pain', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Lait', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Œufs', exact: true })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Vider le panier' })).toBeVisible();
    state = await persisted(page);
    expect(state.groceries.items.map((i: { label: string; done: boolean }) => `${i.label}:${i.done}`)).toEqual(['Pain:true', 'Lait:true', 'Œufs:false']);
    expect(state.groceries.history ?? []).toEqual([]);
    expect(state.chores.completions).toEqual([]);

    // Maison : la tâche est de nouveau « à faire », plus rien dans « Fait aujourd’hui ».
    await goTo(page, 'Maison');
    await expect(page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: 'Courses' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Fait aujourd’hui/ })).toHaveCount(0);

    // Revider ensuite fonctionne comme avant.
    await goTo(page, 'Courses');
    await page.getByRole('button', { name: 'Vider le panier' }).click();
    await pickWho(page, 'b');
    await expect(toast).toContainText('Fait : Courses');
    state = await persisted(page);
    expect(state.chores.completions).toHaveLength(1);
    expect(state.groceries.history).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test('« Qui ? » fermé sans choisir : « Panier vidé » reste annulable', async ({ page }) => {
    await openApp(page, 'maison');
    await addGroceryTask(page);
    await goTo(page, 'Courses');
    await quickAdd(page, 'Riz');
    await emptyBasket(page, 'Riz');
    const who = sheet(page, 'Qui ?');
    await expect(who).toBeVisible({ timeout: 10_000 });
    await who.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(who).toBeHidden();
    const toast = page.locator('.toast');
    await expect(toast).toContainText('Panier vidé');
    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('checkbox', { name: 'Riz', exact: true })).toBeChecked();
    const state = await persisted(page);
    expect(state.groceries.history ?? []).toEqual([]);
    expect(state.chores.completions).toEqual([]);
  });

  test('sans tâche liée : vider le panier ne demande rien', async ({ page }) => {
    await openApp(page, 'courses');
    await quickAdd(page, 'Riz');
    await emptyBasket(page, 'Riz');
    await expect(page.locator('.toast')).toContainText('rangé', { timeout: 10_000 });
    await expect(sheet(page, 'Qui ?')).toHaveCount(0);
    // Annulable : le riz revient au panier.
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('checkbox', { name: 'Riz', exact: true })).toBeChecked();
    expect((await persisted(page)).groceries.history ?? []).toEqual([]);
  });
});
