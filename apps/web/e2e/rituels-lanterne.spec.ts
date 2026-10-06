/**
 * Lanterne de pierre (V4), horloge accélérée : plus de grande fenêtre — un
 * bandeau compact au-dessus de la navigation pendant que la forêt reste
 * visible. Lancement depuis la carte Lanterne et depuis le menu ⋯ d'une
 * tâche ; pause, floraison, tâche cochée ; nouvelle lanterne débloquée,
 * posée dans la forêt, retrouvée dans le carnet.
 * L'état de départ est construit avec @a2/core (valide pour validateAppState).
 */
import {
  addDays,
  addFocusSession,
  createTask,
  emptyAppState,
  localDateKey,
  validateAppState,
  type AppState,
  type FocusState,
} from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, persisted, trackErrors } from './helpers';

test.use({ viewport: PHONE });

function seedState(previousSessions = 0): AppState {
  const now = new Date();
  let s = emptyAppState();
  const created = localDateKey(addDays(now, -10));
  const tasks = [
    createTask({ id: 't-basilic', title: 'Arroser le basilic', assignee: 'b', recurrence: 'daily', effort: 1 }, created),
    createTask({ id: 't-bureau', title: 'Ranger le bureau', assignee: 'a', recurrence: 'none', effort: 2 }, created),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  let focus: FocusState | undefined;
  for (let i = 0; i < previousSessions; i += 1) {
    const day = addDays(now, -(i + 1));
    day.setHours(19, 0, 0, 0);
    focus = addFocusSession(focus, { id: `f-${i}`, startedAt: day.toISOString(), minutes: 10, who: 'both' }).focus;
  }
  if (focus) s = { ...s, focus };
  const v = validateAppState(s);
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return s;
}

async function openSeeded(page: Page, previousSessions = 0, introSeen = false) {
  const state = JSON.stringify(seedState(previousSessions));
  await page.addInitScript(
    ({ key, ui, value, seen }) => {
      if (sessionStorage.getItem('lanterne-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(
        ui,
        JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: false, offlineAnnounced: true, lanternIntroSeen: seen }),
      );
      sessionStorage.setItem('lanterne-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: state, seen: introSeen },
  );
  await page.goto(`${APP}?module=maison`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

const rituals = (page: Page) => page.locator('section.rituals');
const bar = (page: Page) => page.locator('.lantern-bar');

test.describe('Lanterne de pierre', () => {
  test('depuis la carte : bandeau compact, pause, floraison et tâche cochée', async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.install();
    await openSeeded(page);
    const card = rituals(page).getByRole('button', { name: /^Lanterne/ });
    await expect(card).toContainText('Un minuteur doux pour s’y mettre');
    await card.click();
    const setup = page.getByRole('dialog', { name: 'Allumer une lanterne', exact: true });
    await expect(setup).toBeVisible();

    // Première fois : l'explication en trois gestes, puis la préparation.
    const intro = setup.locator('.lantern-intro');
    await expect(intro.locator('.lantern-intro__step')).toHaveCount(3);
    await expect(intro).toContainText('La lanterne s’allume dans la forêt');
    await setup.getByRole('button', { name: 'Choisir une durée' }).click();
    await expect(intro).toHaveCount(0);
    await expect(setup).toContainText('La Kasuga moussue s’allumera dans la forêt');

    await setup.locator('#lantern-minutes-5').check();
    await setup.getByRole('button', { name: 'Ranger le bureau' }).click();
    await expect(setup.locator('#lantern-who-a')).toBeChecked();
    await setup.getByRole('button', { name: /^Lancer 5\s+minutes$/ }).click();

    // Plus de grande fenêtre : la feuille se ferme, le bandeau garde le temps.
    await expect(setup).toBeHidden();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const running = page.getByRole('region', { name: 'Lanterne allumée' });
    await expect(running).toBeVisible();
    await expect(running.locator('.lantern-bar__time')).toHaveText(/^(5:00|4:5\d)$/);
    await expect(running).toContainText('Ranger le bureau');
    // Juste au-dessus de la navigation, la forêt reste visible.
    const barBox = (await bar(page).boundingBox())!;
    const navBox = (await page.getByRole('navigation', { name: 'Modules de la maison' }).boundingBox())!;
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);
    expect(barBox.height).toBeLessThan(110);

    // Le temps vient de l'horloge : deux minutes plus tard, il en reste trois.
    await page.clock.fastForward('02:00');
    await expect(running.locator('.lantern-bar__time')).toHaveText(/^(3:00|2:5\d)$/);

    // Pause : le temps s'arrête.
    await running.getByRole('button', { name: 'Pause' }).click();
    const frozen = await running.locator('.lantern-bar__time').textContent();
    await page.clock.fastForward('01:00');
    await expect(running.locator('.lantern-bar__time')).toHaveText(frozen ?? '');
    await expect(running).toContainText('En pause');
    await running.getByRole('button', { name: 'Reprendre' }).click();
    await expect(rituals(page).getByRole('button', { name: /Lanterne allumée/ })).toContainText('min');

    // Au bout du temps, le bandeau fleurit.
    await page.clock.fastForward('03:10');
    const done = page.getByRole('region', { name: 'Fin de la lanterne' });
    await expect(done).toBeVisible();
    await expect(done).toContainText('La lanterne a fleuri');
    await expect.poll(async () => (await persisted(page)).focus?.sessions?.length ?? 0).toBe(1);
    const session = (await persisted(page)).focus.sessions[0];
    expect(session).toMatchObject({ minutes: 5, who: 'a', taskId: 't-bureau', label: 'Ranger le bureau' });
    await expect(done).not.toContainText('Nouvelle lanterne');

    // Proposition de cocher la tâche liée.
    await expect(done).toContainText('Cocher « Ranger le bureau » ?');
    await done.getByRole('button', { name: 'Cocher', exact: true }).click();
    await expect(done).toContainText('C’est fait');
    await expect
      .poll(async () => (await persisted(page)).chores.completions.some((c: { taskId: string }) => c.taskId === 't-bureau'))
      .toBe(true);
    await done.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(bar(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('depuis le menu ⋯ d’une tâche : durée au choix, une seule lanterne à la fois', async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.install();
    await openSeeded(page, 0, true);
    await page.getByRole('button', { name: /Options : Ranger le bureau/ }).click();
    const menu = page.getByRole('dialog', { name: 'Ranger le bureau', exact: true });
    await expect(menu.getByRole('button', { name: /Allumer une lanterne de 10 minutes pour Ranger le bureau/ })).toBeVisible();
    await menu.getByRole('button', { name: '15 minutes', exact: true }).click();
    await menu.getByRole('button', { name: /Allumer une lanterne de 15 minutes pour Ranger le bureau/ }).click();
    await expect(menu).toBeHidden();
    const running = page.getByRole('region', { name: 'Lanterne allumée' });
    await expect(running.locator('.lantern-bar__time')).toHaveText(/^(15:00|14:5\d)$/);
    await expect(running).toContainText('Ranger le bureau');

    // Une lanterne brûle déjà : le menu le dit, sans en proposer une seconde.
    await page.getByRole('button', { name: /Options : Arroser le basilic/ }).click();
    const other = page.getByRole('dialog', { name: 'Arroser le basilic', exact: true });
    await expect(other).toContainText('Une lanterne brûle déjà');
    await expect(other.getByRole('button', { name: /Allumer une lanterne/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(other).toBeHidden();

    // Arrêtée avant la première minute : rien à mémoriser, le bandeau s'en va.
    await running.getByRole('button', { name: 'Arrêter la lanterne' }).click();
    await expect(bar(page)).toHaveCount(0);
    expect((await persisted(page)).focus?.sessions?.length ?? 0).toBe(0);
    expect(errors).toEqual([]);
  });

  test('nouvelle lanterne débloquée : la poser dans la forêt, la retrouver dans le carnet', async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.install();
    await openSeeded(page, 2, true);
    await rituals(page).getByRole('button', { name: /^Lanterne/ }).click();
    const setup = page.getByRole('dialog', { name: 'Allumer une lanterne', exact: true });
    await setup.locator('#lantern-minutes-5').check();
    await setup.getByRole('button', { name: /^Lancer 5\s+minutes$/ }).click();
    await page.clock.fastForward('05:10');

    const done = page.getByRole('region', { name: 'Fin de la lanterne' });
    await expect(done).toContainText('Nouvelle lanterne débloquée');
    await expect(done).toContainText('Yukimi, la lanterne à neige');
    await done.getByRole('button', { name: 'La poser', exact: true }).click();
    await expect.poll(async () => (await persisted(page)).focus?.selectedLantern).toBe('yukimi');
    await expect(done).toContainText('Dans la forêt');

    await done.getByRole('button', { name: 'Le carnet', exact: true }).click();
    const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
    await expect(carnet).toBeVisible();
    await expect(carnet.locator('.carnet-lantern-preview')).toContainText('Yukimi, la lanterne à neige');
    await expect(carnet.locator('.carnet-lantern.is-locked')).toHaveCount(5);
    // Choisir une autre lanterne débloquée : elle est posée dans la forêt.
    await carnet.getByRole('button', { name: 'Poser La Kasuga moussue dans la forêt' }).click();
    await expect.poll(async () => (await persisted(page)).focus?.selectedLantern).toBe('kasuga-moss');
    await expect(carnet.locator('.carnet-lantern-preview')).toContainText('La Kasuga moussue');
    expect(errors).toEqual([]);
  });
});
