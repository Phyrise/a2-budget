import { expect, test, type Page } from '@playwright/test';
import { PHONE, closeSheet, openApp, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

async function createTask(page: Page, title: string, who: 'a' | 'b' | 'both' | 'unassigned', recurrence: 'none' | 'daily' | 'weekly' | 'monthly') {
  await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const dialog = sheet(page, 'Nouvelle tâche');
  await expect(dialog).toBeVisible();
  // V4.1 : le focus va au titre de la feuille, pas dans le champ (pas de clavier) ;
  // « Une fois » par défaut.
  await expect(dialog.getByRole('heading', { name: 'Nouvelle tâche' })).toBeFocused();
  await expect(dialog.locator('#task-title')).not.toBeFocused();
  await expect(dialog.locator('#task-recurrence-none')).toBeChecked();
  await dialog.locator('#task-title').fill(title);
  await dialog.locator(`#task-who-${who}`).check();
  await dialog.locator(`#task-recurrence-${recurrence}`).check();
  return dialog;
}

const todayRow = (page: Page, title: string) => page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: title });

/** Ouvre la feuille d'édition par le menu ⋯ de la ligne (V3). */
async function editViaMenu(page: Page, title: string) {
  await page.getByRole('button', { name: `Options : ${title}`, exact: true }).click();
  const menu = sheet(page, title);
  await menu.getByRole('button', { name: /^Modifier/ }).click();
  await expect(menu).toBeHidden();
}

test.describe('Maison — parcours', () => {
  test('créer, cocher, annuler, recocher, recharger', async ({ page }) => {
    await openApp(page);
    await expect(page.getByText('La clairière vous attend')).toBeVisible();

    // Une saisie vide est refusée avec un message.
    await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
    const empty = sheet(page, 'Nouvelle tâche');
    await empty.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(empty.locator('#task-title-error')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(empty).toBeHidden();

    const dialog = await createTask(page, 'Arroser le basilic', 'a', 'daily');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.toast')).toContainText('aujourd’hui');

    const row = todayRow(page, 'Arroser le basilic');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Chaque jour');

    // Cocher : coche instantanée, puis la tâche rejoint « Fait aujourd’hui ».
    const check = page.getByRole('checkbox', { name: 'Arroser le basilic', exact: true });
    await check.click();
    await expect(check).toHaveAttribute('aria-checked', 'true');
    await expect(row).toHaveCount(0, { timeout: 5_000 });
    const done = page.getByRole('button', { name: /Fait aujourd’hui/ });
    await expect(done).toContainText('1');
    await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(1);
    // V4.2 : pas de phrase sous la branche tant qu'elle ne penche pas.
    await expect(page.locator('.balance__title')).toHaveCount(0);

    // Annuler depuis « Fait aujourd’hui ».
    await done.click();
    await page.getByRole('checkbox', { name: 'Arroser le basilic (annuler)' }).click();
    await expect(todayRow(page, 'Arroser le basilic')).toBeVisible();
    await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(0);

    // Recocher puis recharger : le fait est conservé.
    await page.getByRole('checkbox', { name: 'Arroser le basilic', exact: true }).click();
    await expect(todayRow(page, 'Arroser le basilic')).toHaveCount(0, { timeout: 5_000 });
    await page.reload();
    await expect(page.locator('.screen-sheet')).toBeVisible();
    await expect(todayRow(page, 'Arroser le basilic')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Fait aujourd’hui/ })).toContainText('1');

    // L'historique de la maison montre le geste, sans score.
    await page.getByRole('button', { name: 'Historique de la maison', exact: true }).click();
    const history = sheet(page, 'Historique de la maison');
    await expect(history.locator('.history-entry')).toHaveCount(1);
    await expect(history.locator('.history-entry')).toContainText('Arroser le basilic');
    await closeSheet(page, 'Historique de la maison');
  });

  test('modifier puis supprimer une tâche ; une tâche future va dans « À venir »', async ({ page }) => {
    await openApp(page);
    let dialog = await createTask(page, 'Sortir les poubelles', 'b', 'none');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(todayRow(page, 'Sortir les poubelles')).toBeVisible();

    // Édition : titre et récurrence hebdomadaire sur un autre jour.
    await editViaMenu(page, 'Sortir les poubelles');
    dialog = sheet(page, 'Modifier la tâche');
    await expect(dialog).toBeVisible();
    await dialog.locator('#task-title').fill('Sortir le verre');
    await dialog.locator("#task-recurrence-weekly").check();
    const tomorrowIso = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.getDay() === 0 ? 7 : d.getDay();
    });
    await dialog.locator(`#task-weekday-${tomorrowIso}`).check();
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(todayRow(page, 'Sortir le verre')).toHaveCount(0);
    // « À venir » replié : l'aperçu suffit (« Demain : Sortir le verre »).
    const fold = page.locator('.upcoming-fold .disclosure__toggle');
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(fold).toContainText('Demain');
    await expect(fold).toContainText('Sortir le verre');

    // Suppression confirmée depuis la feuille d'édition (via « À venir » → tâche du jour recréée).
    dialog = await createTask(page, 'Appeler le plombier', 'unassigned', 'none');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await editViaMenu(page, 'Appeler le plombier');
    dialog = sheet(page, 'Modifier la tâche');
    await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: /Supprimer cette tâche/ });
    await confirm.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(todayRow(page, 'Appeler le plombier')).toHaveCount(0);
    await expect.poll(async () => (await persisted(page)).chores.tasks.length).toBe(1);
  });

  // La pause (V3.1) se met depuis l'en-tête ou les Réglages : voir maison-v31.spec.ts.
});
