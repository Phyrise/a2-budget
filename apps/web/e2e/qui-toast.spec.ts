/**
 * V5.10 — « Qui l'a fait ? » sans feuille (idée d'Arthur) : cocher fait
 * tout de suite, attribué à la personne prévue ; un toast « Fait par … »
 * propose « C'était AC », « Ensemble », « Annuler ». Corriger change
 * l'auteur de CE fait (même id) sans perdre le soin de la forêt ni bouger
 * l'objectif de la semaine ; la luciole change de couleur. Appui long sur
 * la case, ou « Qui l'a fait ? » du menu ⋯ : la feuille complète.
 */
import { addDays, createTask, emptyAppState, localDateKey, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, doneToast, goTo, longPress, persisted, pickInSheet, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

function seeded(): AppState {
  const created = localDateKey(addDays(new Date(), -10));
  const s = emptyAppState();
  return {
    ...s,
    chores: {
      ...s.chores,
      tasks: [
        createTask({ id: 't-vaisselle', title: 'Vaisselle', assignee: 'a', recurrence: 'daily' }, created),
        createTask({ id: 't-plombier', title: 'Appeler le plombier', assignee: 'unassigned', recurrence: 'none' }, created),
        createTask({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'daily' }, created),
        createTask({ id: 't-courses', title: 'Courses', assignee: 'b', recurrence: 'none', groceries: true }, created),
      ],
    },
  };
}

async function openSeeded(page: Page, module: 'maison' | 'courses' = 'maison') {
  await page.addInitScript(
    ({ key, ui, value, module }) => {
      if (sessionStorage.getItem('qui-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module, guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('qui-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(seeded()), module },
  );
  await page.goto(`${APP}?module=${module}`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

const box = (page: Page, title: string) => page.getByRole('checkbox', { name: title, exact: true });

/** Couleur de la luciole côté moteur (build e2e, WebGL) ; null sans moteur. */
function engineWho(page: Page, id: string): Promise<string | null | undefined> {
  return page.evaluate((id) => {
    const e = (window as unknown as { __worldEngine?: { lights: { lights: Map<string, { who: string }> } } }).__worldEngine;
    return e ? (e.lights.lights.get(id)?.who ?? undefined) : null;
  }, id);
}

test.describe('« Qui l’a fait ? » par toast', () => {
  test('cocher : attribué à la personne prévue, sans feuille ; « C’était AC » corrige sans perdre le soin', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page);
    await box(page, 'Vaisselle').click();
    // Coché tout de suite (la ligne s'attarde ~1,3 s avant « Fait aujourd'hui »), sans feuille.
    await expect(page.locator('.task-row.is-leaving[data-task-id="t-vaisselle"]')).toHaveCount(1);
    await expect(sheet(page, 'Qui ?')).toHaveCount(0);
    const toast = doneToast(page);
    await expect(toast).toContainText('Fait par AL');
    // Focus dedans (ou survolé), le toast attend : le temps de lire l'état avant de corriger.
    await toast.locator('.toast__action').first().focus();
    await expect(toast.locator('.toast__action')).toHaveText(['C’était AC', 'Ensemble', 'Annuler']);

    await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(1);
    const before = await persisted(page);
    const fact = before.chores.completions[0];
    expect(fact).toMatchObject({ taskId: 't-vaisselle', assignee: 'a' });
    expect(fact.doneBy).toBeUndefined();
    const goal = await page.locator('.weekly-goal').getAttribute('class');
    const arc = await page.locator('.weekly-goal__arc').getAttribute('stroke-dasharray');

    await toast.getByRole('button', { name: 'C’est AC qui l’a fait' }).click();
    await expect(doneToast(page)).toContainText('Fait par AC');
    await expect(doneToast(page).locator('.toast__action')).toHaveText(['C’était AL', 'Ensemble', 'Annuler']);
    // Le toast tient dans 390 px, cibles ≥ 44 px.
    const tb = (await doneToast(page).boundingBox())!;
    expect(tb.x).toBeGreaterThanOrEqual(0);
    expect(tb.x + tb.width).toBeLessThanOrEqual(PHONE.width);
    for (const b of await doneToast(page).locator('.toast__action').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const after = await persisted(page);
    expect(after.chores.completions).toHaveLength(1);
    expect(after.chores.completions[0]).toMatchObject({ id: fact.id, completedAt: fact.completedAt, doneBy: 'b' });
    // Forêt : le soin reste actif, rien de plus, objectif de la semaine inchangé.
    expect(after.forest).toEqual(before.forest);
    const credit = Object.entries(after.forest.creditLedger as Record<string, { status: string }>).find(([k]) => k.startsWith('t-vaisselle|'));
    expect(credit?.[1].status).toBe('active');
    expect(await page.locator('.weekly-goal').getAttribute('class')).toBe(goal);
    expect(await page.locator('.weekly-goal__arc').getAttribute('stroke-dasharray')).toBe(arc);
    // La luciole change de couleur (si le moteur tourne).
    if ((await engineWho(page, fact.id)) !== null) await expect.poll(() => engineWho(page, fact.id)).toBe('b');

    // « Fait aujourd'hui » suit : AC, coup de main.
    await page.getByRole('button', { name: /Fait aujourd’hui/ }).click();
    const doneRow = page.locator('.task-list--done .task-row').filter({ hasText: 'Vaisselle' });
    await expect(doneRow).toContainText('AC');
    await expect(doneRow).toContainText('coup de main');
    expect(errors).toEqual([]);
  });

  test('personne prévue : libre → soi (AL en invité), à deux → ensemble ; « Annuler » défait', async ({ page }) => {
    await openSeeded(page);
    await box(page, 'Appeler le plombier').click();
    await expect(doneToast(page)).toContainText('Fait par AL');
    await box(page, 'Changer les draps').click();
    await expect(doneToast(page)).toContainText('Fait ensemble');
    await expect(doneToast(page).locator('.toast__action')).toHaveText(['C’était AL', 'C’était AC', 'Annuler']);
    await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(2);
    const plombier = (await persisted(page)).chores.completions.find((c: { taskId: string }) => c.taskId === 't-plombier');
    expect(plombier).toMatchObject({ assignee: 'unassigned', doneBy: 'a' });

    await doneToast(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(box(page, 'Changer les draps')).toHaveAttribute('aria-checked', 'false');
    await expect.poll(async () => (await persisted(page)).chores.completions.map((c: { taskId: string }) => c.taskId)).toEqual(['t-plombier']);
  });

  test('appui long → feuille « Qui ? » sans cocher ; menu ⋯ « Qui l’a fait ? » au clavier', async ({ page }) => {
    await openSeeded(page);
    await longPress(page, box(page, 'Vaisselle'));
    const who = sheet(page, 'Qui ?');
    await expect(who).toBeVisible();
    await expect(box(page, 'Vaisselle')).toHaveAttribute('aria-checked', 'false');
    expect((await persisted(page)).chores.completions).toHaveLength(0);
    await pickInSheet(page, 'both');
    await expect.poll(async () => (await persisted(page)).chores.completions[0]?.doneBy).toBe('both');
    await expect(doneToast(page)).toContainText('Fait ensemble');

    // Menu ⋯ (clavier, lecteur d'écran).
    await page.getByRole('button', { name: 'Options : Appeler le plombier', exact: true }).click();
    const menu = sheet(page, 'Appeler le plombier');
    await menu.getByRole('button', { name: /Qui l’a fait/ }).click();
    await expect(menu).toBeHidden();
    await pickInSheet(page, 'b');
    await expect
      .poll(async () => (await persisted(page)).chores.completions.find((c: { taskId: string }) => c.taskId === 't-plombier')?.doneBy)
      .toBe('b');
  });

  test('Courses : toast après « Vider le panier » ; « C’était AL » corrige, « Annuler » défait tout', async ({ page }) => {
    await openSeeded(page, 'courses');
    const input = page.locator('#grocery-input');
    await input.fill('Pain');
    await input.press('Enter');
    await box(page, 'Pain').click();
    await page.getByRole('button', { name: 'Vider le panier' }).click();
    const toast = doneToast(page);
    await expect(toast).toContainText('Courses faites par AC', { timeout: 10_000 });
    await expect(sheet(page, 'Qui ?')).toHaveCount(0);
    await toast.getByRole('button', { name: 'C’est AL qui l’a fait' }).click();
    await expect(doneToast(page)).toContainText('Courses faites par AL');
    await expect.poll(async () => (await persisted(page)).chores.completions[0]?.doneBy).toBe('a');
    await doneToast(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(box(page, 'Pain')).toBeChecked();
    const state = await persisted(page);
    expect(state.chores.completions).toEqual([]);
    expect(state.groceries.history ?? []).toEqual([]);
    await goTo(page, 'Maison');
  });
});
