/**
 * Maison V3 « Prendre soin ensemble » : tour à tour, « s'en occuper » / coup
 * de main (doneBy), « pas aujourd'hui » (annulable), effort corvée, carte
 * d'équilibre. Contre le build de production (`pnpm preview`).
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, persisted, pickWho, sheet } from './helpers';

test.use({ viewport: PHONE });

type Who = 'a' | 'b' | 'both' | 'unassigned';
type Rec = 'none' | 'daily' | 'weekly' | 'monthly';

async function addTask(
  page: Page,
  title: string,
  who: Who,
  recurrence: Rec,
  opts: { rotation?: boolean; effort?: 1 | 2 | 3; flexible?: boolean } = {},
) {
  await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const dialog = sheet(page, 'Nouvelle tâche');
  await expect(dialog).toBeVisible();
  await dialog.locator('#task-title').fill(title);
  await dialog.locator(`#task-who-${who}`).check();
  if (opts.rotation) {
    const toggle = dialog.getByRole('switch', { name: 'Tour à tour' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
  if (opts.effort) await dialog.locator(`#task-effort-${opts.effort}`).check();
  await dialog.locator(`#task-recurrence-${recurrence}`).check();
  if (opts.flexible) await dialog.locator('#task-weekmode-flexible').check();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(dialog).toBeHidden();
}

const todayRow = (page: Page, title: string) => page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: title });

async function openMenu(page: Page, title: string) {
  await page.getByRole('button', { name: `Options : ${title}`, exact: true }).click();
  const dialog = sheet(page, title);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Maison V3 — prendre soin ensemble', () => {
  test('tour à tour : « Tour d’AL », puis la semaine suivante revient à AC', async ({ page }) => {
    await openApp(page, 'maison');
    // Le choix « Tour à tour » n'apparaît qu'avec une personne.
    await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
    const draft = sheet(page, 'Nouvelle tâche');
    await draft.locator('#task-who-both').check();
    await expect(draft.getByRole('switch', { name: 'Tour à tour' })).toHaveCount(0);
    await draft.locator('#task-who-a').check();
    await expect(draft.getByRole('switch', { name: 'Tour à tour' })).toBeVisible();
    await expect(draft.getByText('On alterne à chaque fois, en commençant par AL')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(draft).toBeHidden();

    await addTask(page, 'Sortir les poubelles', 'a', 'weekly', { rotation: true, effort: 2 });
    const row = todayRow(page, 'Sortir les poubelles');
    await expect(row).toContainText('Tour d’AL');
    await expect.poll(async () => (await persisted(page)).chores.tasks[0]).toMatchObject({ rotation: true, effort: 2, assignee: 'a' });

    await page.getByRole('checkbox', { name: 'Sortir les poubelles', exact: true }).click();
    await pickWho(page);
    await expect(row).toHaveCount(0, { timeout: 5_000 });
    const completion = (await persisted(page)).chores.completions[0];
    expect(completion.assignee).toBe('a');
    expect(completion.doneBy).toBeUndefined();
    // L'occurrence suivante (dans 7 jours) revient à AC : Calcifer dans « À venir ».
    const next = page.locator('.upcoming__item').filter({ hasText: 'Sortir les poubelles' });
    await expect(next.locator('.companion--b')).toHaveCount(1);
  });

  test('cocher → « Qui ? » : la personne prévue en avant, coup de main, historique et équilibre', async ({ page }) => {
    await openApp(page, 'maison');
    await addTask(page, 'Appeler le plombier', 'unassigned', 'none');
    await addTask(page, 'Arroser les plantes', 'b', 'daily', { effort: 3 });

    // Fermer « Qui ? » sans choisir : rien n'est coché.
    const who = sheet(page, 'Qui ?');
    await page.getByRole('checkbox', { name: 'Appeler le plombier', exact: true }).click();
    await expect(who).toBeVisible();
    await expect(who.locator('.who-did__choice.is-suggested')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(who).toBeHidden();
    await expect(todayRow(page, 'Appeler le plombier')).toHaveCount(1);
    expect((await persisted(page)).chores.completions).toHaveLength(0);

    // Tâche libre : AC s'en est occupé → doneBy, merci de Jiji.
    await page.getByRole('checkbox', { name: 'Appeler le plombier', exact: true }).click();
    await pickWho(page, 'b');
    await expect(page.locator('.cbubble__name')).toHaveText('Jiji');
    await expect(todayRow(page, 'Appeler le plombier')).toHaveCount(0, { timeout: 5_000 });
    await expect
      .poll(async () => (await persisted(page)).chores.completions.find((c: any) => c.taskTitle === 'Appeler le plombier'))
      .toMatchObject({ assignee: 'unassigned', doneBy: 'b' });

    // Tâche d'AC, faite par AL : AC est mis en avant, AL choisi.
    await page.getByRole('checkbox', { name: 'Arroser les plantes', exact: true }).click();
    await expect(who.locator('.who-did__choice.is-suggested')).toHaveAttribute('data-who', 'b');
    await pickWho(page, 'a');
    await expect(todayRow(page, 'Arroser les plantes')).toHaveCount(0, { timeout: 5_000 });
    await expect
      .poll(async () => (await persisted(page)).chores.completions.find((c: any) => c.taskTitle === 'Arroser les plantes'))
      .toMatchObject({ assignee: 'b', doneBy: 'a' });
    await page.getByRole('button', { name: /Fait aujourd’hui/ }).click();
    const doneRow = page.locator('.task-list--done .task-row').filter({ hasText: 'Arroser les plantes' });
    await expect(doneRow).toContainText('coup de main');
    await expect(doneRow).toContainText('AL');

    // Équilibre : la corvée pèse du côté d'AL, qui l'a faite.
    await expect(page.locator('.balance .balance__title')).toHaveText('AL a beaucoup porté : et si AC prenait le relais ?');

    // Historique : AL.
    await page.getByRole('button', { name: 'Historique de la maison', exact: true }).click();
    const history = sheet(page, 'Historique de la maison');
    const entry = history.locator('.history-entry').filter({ hasText: 'Arroser les plantes' });
    await expect(entry.locator('.history-entry__meta')).toContainText('AL');
    await expect(entry.locator('.companion--a')).toHaveCount(1);
  });

  test('« Pas aujourd’hui » : sans pénalité, annulable, replié, « Pas cette semaine » pour une souple', async ({ page }) => {
    await openApp(page, 'maison');
    await addTask(page, 'Plier le linge', 'b', 'daily');
    await addTask(page, 'Salle de bain', 'a', 'weekly', { flexible: true, effort: 3 });
    await expect(todayRow(page, 'Salle de bain')).toContainText('Cette semaine');

    let menu = await openMenu(page, 'Plier le linge');
    await menu.getByRole('button', { name: /Pas aujourd’hui/ }).click();
    await expect(page.locator('.toast')).toContainText('Pas aujourd’hui, et c’est très bien.');
    await expect(todayRow(page, 'Plier le linge')).toHaveCount(0);
    await expect(page.locator('.skipped__row').filter({ hasText: 'Plier le linge' })).toContainText('pas aujourd’hui');
    await expect.poll(async () => (await persisted(page)).chores.skips?.length ?? 0).toBe(1);
    const before = (await persisted(page)).forest;

    // Annuler depuis le toast.
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(todayRow(page, 'Plier le linge')).toBeVisible();
    await expect.poll(async () => (await persisted(page)).chores.skips?.length ?? 0).toBe(0);

    // Repasser, recharger : la tâche reste repliée ; « Remettre » la ramène.
    menu = await openMenu(page, 'Plier le linge');
    await menu.getByRole('button', { name: /Pas aujourd’hui/ }).click();
    await expect(todayRow(page, 'Plier le linge')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.screen-sheet')).toBeVisible();
    await expect(todayRow(page, 'Plier le linge')).toHaveCount(0);
    await page.getByRole('button', { name: 'Remettre Plier le linge aujourd’hui' }).click();
    await expect(todayRow(page, 'Plier le linge')).toBeVisible();

    // Aucune trace dans la forêt (ni crédit, ni pénalité).
    const after = (await persisted(page)).forest;
    expect(after.lifetimeCare).toBe(before.lifetimeCare);
    expect(after.vitality).toBe(before.vitality);

    // Hebdomadaire souple : « Pas cette semaine ».
    menu = await openMenu(page, 'Salle de bain');
    await menu.getByRole('button', { name: /Pas cette semaine/ }).click();
    await expect(page.locator('.toast')).toContainText('Pas cette semaine, et c’est très bien.');
    await expect(page.locator('.skipped__row').filter({ hasText: 'Salle de bain' })).toContainText('pas cette semaine');
  });

  test('corvée : badge discret, célébration fière, carte d’équilibre bienveillante', async ({ page }) => {
    await openApp(page, 'maison');
    await expect(page.locator('.balance__title')).toHaveCount(0);
    await addTask(page, 'Nettoyer le four', 'b', 'daily', { effort: 3 });
    await addTask(page, 'Arroser les plantes', 'a', 'daily');
    const row = todayRow(page, 'Nettoyer le four');
    await expect(row.locator('.chore-badge')).toHaveText('corvée');
    await expect(todayRow(page, 'Arroser les plantes').locator('.chore-badge')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Nettoyer le four', exact: true }).click();
    await pickWho(page);
    await expect(page.locator('.task-row.is-chore.is-leaving')).toHaveCount(1);
    await expect(page.locator('.perch .companion__figure[data-mood="proud"]')).toHaveCount(2);
    await expect(page.locator('.cbubble__name')).toHaveText('Calcifer');
    await expect.poll(async () => (await persisted(page)).chores.tasks.find((t: any) => t.title === 'Nettoyer le four')?.effort).toBe(3);

    // AC a porté une corvée : phrase bienveillante, jamais de chiffre, et une
    // suggestion applicable en un geste (annulable).
    const balance = page.locator('.balance');
    await expect(balance.locator('.balance__title')).toHaveText('AC a beaucoup porté : et si AL prenait le relais ?');
    await expect(balance).not.toContainText(/\d/);
    const suggestion = balance.locator('.suggestion').filter({ hasText: 'Nettoyer le four' });
    await expect(suggestion).toContainText('tour à tour');
    await suggestion.getByRole('button', { name: /Appliquer/ }).click();
    await expect(page.locator('.toast')).toContainText('passe en tour à tour');
    await expect.poll(async () => (await persisted(page)).chores.tasks.find((t: any) => t.title === 'Nettoyer le four')?.rotation).toBe(true);
    await expect(balance.locator('.suggestion')).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect.poll(async () => (await persisted(page)).chores.tasks.find((t: any) => t.title === 'Nettoyer le four')?.rotation).toBeUndefined();
  });
});
