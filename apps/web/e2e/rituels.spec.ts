/**
 * Rituels V3 : cercle de la semaine (tenu puis relu), carnet (V4 : sans
 * triche — silhouettes à part, aucune URL de vrai sprite avant la
 * rencontre ; collection des lanternes de pierre ; V4.2 : avancée en
 * petites barres, « Tout voir » du mode développeur, sans rien écrire). La
 * lanterne elle-même : rituels-lanterne.spec.ts.
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

async function openSeeded(page: Page, devMode = false) {
  const state = JSON.stringify(seedState());
  await page.addInitScript(
    ({ key, ui, value, dev }) => {
      if (sessionStorage.getItem('rituels-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: false, offlineAnnounced: true, devMode: dev }));
      sessionStorage.setItem('rituels-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: state, dev: devMode },
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

  test('carnet de la forêt', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page);
    await rituals(page).getByRole('button', { name: 'Carnet de la forêt' }).click();
    const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
    await expect(carnet).toBeVisible();
    await expect(carnet.getByRole('heading', { name: 'Créatures' })).toBeVisible();
    // Plus de phrase sous le titre : une fine séparation ; pas de « Tout voir » hors mode développeur.
    await expect(carnet).not.toContainText('Ce que la forêt a vu');
    await expect(carnet.locator('.carnet-rule')).toHaveCount(1);
    await expect(carnet.getByRole('button', { name: 'Tout voir' })).toHaveCount(0);
    await expect(carnet).toContainText('Les kodama');
    expect(await carnet.getByText('pas encore rencontrée').count()).toBeGreaterThanOrEqual(4);
    await expect(carnet.getByRole('heading', { name: 'Le cèdre' })).toBeVisible();
    await expect(carnet.locator('.carnet-stage')).toHaveCount(7);
    await expect(carnet.locator('.carnet-stage.is-current')).toHaveCount(1);
    await expect(carnet.getByRole('heading', { name: 'Souvenirs' })).toBeVisible();
    await expect(carnet).toContainText('Le premier cercle sera le plus doux.');

    // Sans triche : chaque créature pas encore rencontrée est une silhouette à
    // part, et l'URL d'aucun vrai sprite de créature n'est dans la page.
    const met: string[] = (await persisted(page)).forest.unlockedCreatureIds;
    const unmetIds = ['moss-ling', 'seed-spirit', 'leaf-sprite', 'ember-wisp', 'mushroom-pip', 'water-drip'].filter((id) => !met.includes(id));
    expect(unmetIds.length).toBeGreaterThanOrEqual(4);
    const unmet = carnet.locator('.carnet-creature.is-unmet img');
    await expect(unmet).toHaveCount(unmetIds.length);
    for (const src of await unmet.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src))) {
      expect(src).toMatch(/silhouette-/);
    }
    const leaked = await page.evaluate(
      (ids) =>
        Array.from(document.querySelectorAll('img'))
          .map((i) => i.src)
          .filter((src) => ids.some((id) => src.includes(`/${id}-`)) && !/silhouette-/.test(src)),
      unmetIds,
    );
    expect(leaked).toEqual([]);
    // Ni glisser, ni menu contextuel sur les images du carnet.
    expect(await unmet.first().getAttribute('draggable')).toBe('false');
    const blocked = await unmet.first().evaluate((img) => {
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      img.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(blocked).toBe(true);
    // Les stades à venir : de la brume, pas la peinture ; une petite barre au lieu de « À venir ».
    await expect(carnet.locator('.carnet-stage.is-future img')).toHaveCount(0);
    await expect(carnet.locator('.carnet-stages')).not.toContainText('À venir');
    await expect(carnet.locator('.carnet-stage.is-future [role="progressbar"]')).toHaveCount(6);

    // Lanternes : la première est posée dans la forêt, les six autres sont
    // des silhouettes avec une petite barre (« 0 sur 3 lanternes »), sans
    // leur vraie peinture.
    await expect(carnet.getByRole('heading', { name: 'Lanternes' })).toBeVisible();
    await expect(carnet.locator('.carnet-lantern')).toHaveCount(7);
    await expect(carnet.locator('.carnet-lantern.is-locked')).toHaveCount(6);
    await expect(carnet.locator('.carnet-lantern.is-locked').first()).toContainText(/^Une lanterne dans la brume0\s+sur 3\s+lanternes$/);
    await expect(carnet.locator('.carnet-lantern.is-locked [role="progressbar"]')).toHaveCount(6);
    await expect(carnet.getByRole('button', { name: /La Kasuga moussue, posée dans la forêt/ })).toHaveAttribute('aria-pressed', 'true');
    const lockedSrcs = await carnet.locator('.carnet-lantern.is-locked img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
    expect(lockedSrcs).toHaveLength(6);
    for (const src of lockedSrcs) expect(src).toMatch(/-silhouette/);
    expect(errors).toEqual([]);
  });

  test('carnet, mode développeur : « Tout voir » montre tout, sans rien écrire', async ({ page }) => {
    const errors = trackErrors(page);
    await openSeeded(page, true);
    const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    await rituals(page).getByRole('button', { name: 'Carnet de la forêt' }).click();
    const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
    const all = carnet.getByRole('button', { name: 'Tout voir' });
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await all.click();
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(carnet.locator('.carnet-creature.is-unmet')).toHaveCount(0);
    await expect(carnet).toContainText('Boule-de-Mousse');
    await expect(carnet.locator('.carnet-stage img')).toHaveCount(7);
    await expect(carnet).toContainText('Le millénaire');
    await expect(carnet).toContainText('Le gardien de la forêt vous a rendu visite');
    // Lanternes verrouillées : visibles, mais on ne peut pas les poser.
    await expect(carnet.locator('.carnet-lantern.is-revealed')).toHaveCount(6);
    await expect(carnet).toContainText('La lanterne des esprits');
    await expect(carnet.locator('.carnet-lantern__pick')).toHaveCount(1);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(before);
    // Refermer : le carnet redevient le vrai.
    await page.keyboard.press('Escape');
    await rituals(page).getByRole('button', { name: 'Carnet de la forêt' }).click();
    await expect(carnet.getByRole('button', { name: 'Tout voir' })).toHaveAttribute('aria-pressed', 'false');
    await expect(carnet.locator('.carnet-lantern.is-revealed')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
