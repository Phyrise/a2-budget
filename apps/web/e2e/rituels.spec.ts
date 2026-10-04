/**
 * Rituels V3 : cercle de la semaine (tenu puis relu), lanterne (horloge
 * accélérée : en cours, pause, floraison, cocher la tâche liée), carnet.
 * L'état de départ est construit avec @a2/core (valide pour validateAppState).
 */
import { addDays, createTask, emptyAppState, localDateKey, toggleTaskToday, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, persisted, trackErrors } from './helpers';

test.use({ viewport: PHONE });

/** Deux tâches ; AC a arrosé le basilic hier et aujourd'hui. */
function seedState(): AppState {
  const now = new Date();
  let s = emptyAppState();
  const created = localDateKey(addDays(now, -10));
  const tasks = [
    createTask({ id: 't-basilic', title: 'Arroser le basilic', assignee: 'b', recurrence: 'daily', effort: 1 }, created),
    createTask({ id: 't-bureau', title: 'Ranger le bureau', assignee: 'a', recurrence: 'none', effort: 2 }, created),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  const yesterday = addDays(now, -1);
  yesterday.setHours(18, 0, 0, 0);
  s = toggleTaskToday(s, 't-basilic', yesterday, 'c-1').state;
  s = toggleTaskToday(s, 't-basilic', now, 'c-2').state;
  const v = validateAppState(s);
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return s;
}

async function openSeeded(page: Page) {
  const state = JSON.stringify(seedState());
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('rituels-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: false, offlineAnnounced: true }));
      sessionStorage.setItem('rituels-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: state },
  );
  await page.goto(`${APP}?module=maison`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

const rituals = (page: Page) => page.locator('section.rituals');

test.describe('Rituels', () => {
  test('tenir un cercle complet, puis le relire', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page);
    await rituals(page).getByRole('button', { name: 'Cercle de la semaine', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Cercle de la semaine' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Étape 1 sur 3');

    // Merci : AL choisit une suggestion tirée de la semaine, AC écrit librement.
    const alVoice = dialog.locator('.circle-voice--a');
    const chip = alVoice.locator('.ritual-chip').first();
    await expect(chip).toContainText('basilic');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(alVoice.locator('textarea')).toHaveValue(/basilic/);
    await dialog.locator('.circle-voice--b textarea').fill('Merci pour ta douceur cette semaine');
    await dialog.getByRole('button', { name: 'Continuer' }).click();

    // Ce qui pèse : facultatif, rassurant.
    await expect(dialog).toContainText('Le dire, c’est déjà alléger.');
    await dialog.locator('.circle-voice--b textarea').fill('Le travail a été lourd.');
    await dialog.getByRole('button', { name: 'Continuer' }).click();

    // Ajuster : intention commune, puis clôture.
    await expect(dialog).toContainText('Étape 3 sur 3');
    await dialog.getByRole('button', { name: 'Une balade ensemble' }).click();
    await dialog.getByRole('button', { name: 'Clore le cercle' }).click();
    await expect(dialog).toContainText('Merci d’avoir pris ce moment.');

    await expect
      .poll(async () => (await persisted(page)).rituals?.circles?.length ?? 0)
      .toBe(1);
    const circle = (await persisted(page)).rituals.circles[0];
    expect(circle.gratitude).toHaveLength(2);
    expect(circle.gratitude[0].text).toContain('basilic');
    expect(circle.burdens).toEqual([{ who: 'b', text: 'Le travail a été lourd.' }]);
    expect(circle.intentions).toEqual(['Une balade ensemble']);

    await dialog.getByRole('button', { name: 'Retourner dans la forêt' }).click();
    await expect(dialog).toBeHidden();

    // Après rechargement : le cercle est « tenu » et se relit.
    await page.reload();
    const held = rituals(page).getByRole('button', { name: /Cercle de la semaine, tenu/ });
    await expect(held).toContainText('Tenu');
    await held.click();
    await expect(dialog).toContainText('Relire les mots échangés');
    await expect(dialog).toContainText('Une balade ensemble');
    await expect(dialog).toContainText('Merci pour ta douceur cette semaine');
    await expect(dialog.getByRole('button', { name: 'Le refaire' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('lanterne : en cours, pause, floraison et tâche cochée', async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.install();
    await openSeeded(page);
    await rituals(page).getByRole('button', { name: /Allumer une lanterne/ }).click();
    const setup = page.getByRole('dialog', { name: 'Allumer une lanterne', exact: true });
    await expect(setup).toBeVisible();
    await setup.locator('#lantern-minutes-5').check();
    await setup.getByRole('button', { name: 'Ranger le bureau' }).click();
    await expect(setup.locator('#lantern-who-a')).toBeChecked();
    await setup.getByRole('button', { name: 'Allumer la lanterne' }).click();

    const running = page.getByRole('dialog', { name: 'Lanterne allumée', exact: true });
    await expect(running).toBeVisible();
    await expect(running.locator('.lantern-stage__time')).toHaveText(/^(5:00|4:5\d)$/);
    await expect(running).toContainText('Ranger le bureau');

    // Le temps vient de l'horloge : deux minutes plus tard, il en reste trois.
    await page.clock.fastForward('02:00');
    await expect(running.locator('.lantern-stage__time')).toHaveText(/^(3:00|2:5\d)$/);

    // Pause : le temps s'arrête.
    await running.getByRole('button', { name: 'Pause' }).click();
    const paused = page.getByRole('dialog', { name: 'Lanterne en pause', exact: true });
    await expect(paused).toBeVisible();
    const frozen = await paused.locator('.lantern-stage__time').textContent();
    await page.clock.fastForward('01:00');
    await expect(paused.locator('.lantern-stage__time')).toHaveText(frozen ?? '');
    await paused.getByRole('button', { name: 'Reprendre' }).click();

    // Fermer la feuille : la lanterne continue, la carte affiche le temps restant.
    await running.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(running).toBeHidden();
    await expect(rituals(page).getByRole('button', { name: /Lanterne allumée/ })).toContainText('min');

    // Au bout du temps, la feuille se rouvre sur la floraison.
    await page.clock.fastForward('03:10');
    const done = page.getByRole('dialog', { name: 'Lanterne', exact: true });
    await expect(done).toBeVisible();
    await expect(done).toContainText('La lanterne a fleuri');
    await expect.poll(async () => (await persisted(page)).focus?.sessions?.length ?? 0).toBe(1);
    const session = (await persisted(page)).focus.sessions[0];
    expect(session).toMatchObject({ minutes: 5, who: 'a', taskId: 't-bureau', label: 'Ranger le bureau' });

    // Proposition de cocher la tâche liée.
    await expect(done).toContainText('Cocher « Ranger le bureau » ?');
    await done.getByRole('button', { name: 'Cocher', exact: true }).click();
    await expect(done).toContainText('C’est fait');
    await expect
      .poll(async () => (await persisted(page)).chores.completions.some((c: { taskId: string }) => c.taskId === 't-bureau'))
      .toBe(true);
    await done.getByRole('button', { name: 'Fermer', exact: true }).last().click();
    await expect(done).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('carnet de la forêt', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page);
    await rituals(page).getByRole('button', { name: 'Carnet de la forêt' }).click();
    const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
    await expect(carnet).toBeVisible();
    await expect(carnet.getByRole('heading', { name: 'Créatures' })).toBeVisible();
    await expect(carnet).toContainText('Les kodama');
    expect(await carnet.getByText('pas encore rencontrée').count()).toBeGreaterThanOrEqual(4);
    await expect(carnet.getByRole('heading', { name: 'Le cèdre' })).toBeVisible();
    await expect(carnet.locator('.carnet-stage')).toHaveCount(7);
    await expect(carnet.locator('.carnet-stage.is-current')).toHaveCount(1);
    await expect(carnet.getByRole('heading', { name: 'Souvenirs' })).toBeVisible();
    await expect(carnet).toContainText('Le premier cercle sera le plus doux.');
    expect(errors).toEqual([]);
  });
});
