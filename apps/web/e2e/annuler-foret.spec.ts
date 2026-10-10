/**
 * V5.9 — annuler une tâche l'annule aussi dans la forêt (question d'Arthur),
 * pour chaque chemin : Maison (décocher pendant l'envol, puis depuis « Fait
 * aujourd'hui »), Calendrier (toast « Annuler »), Courses (« Annuler » après
 * « Vider le panier »).
 *
 * Vérifié à chaque fois :
 * - la luciole quitte la forêt : plus dans l'état, et côté moteur (si WebGL)
 *   la lumière en vol s'éteint puis disparaît — annulée EN PLEIN VOL ;
 * - l'objectif de la semaine revient à sa valeur d'avant (palier et anneau) ;
 * - ce qui reste (voulu : la forêt ne recule jamais) : soins cumulés,
 *   vitalité, stade passé grâce à ce soin ; le crédit annulé est « tombstoné »
 *   (il compte pour le plafond du jour, recocher ne redonne rien).
 *
 * État de départ (@a2/core) : deux soins déjà faits aujourd'hui (autres
 * tâches) → « La forêt se repose » ; le troisième fait une journée pleine
 * (« va bien ») et fait passer le stade 2 (soins cumulés 9 → 10).
 */
import { GROWTH_THRESHOLDS, addDays, createTask, emptyAppState, isoWeekday, localDateKey, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, goTo, persisted, pickWho, trackErrors } from './helpers';

const DESKTOP = { width: 1280, height: 800 } as const;
const STAGE2 = GROWTH_THRESHOLDS[1]!;

function seeded(): AppState {
  const now = new Date();
  const today = localDateKey(now);
  const created = localDateKey(addDays(now, -10));
  const s = emptyAppState();
  const tasks = [
    createTask({ id: 't-basilic', title: 'Arroser le basilic', assignee: 'a', recurrence: 'daily' }, created),
    createTask({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'b', recurrence: 'weekly', weeklyDay: isoWeekday(now) }, created),
    createTask({ id: 't-courses', title: 'Courses', assignee: 'both', recurrence: 'none', groceries: true }, created),
  ];
  const state: AppState = {
    ...s,
    chores: { ...s.chores, tasks },
    forest: {
      ...s.forest,
      lifetimeCare: STAGE2 - 1,
      vitality: 24,
      growthStage: 1,
      currentStreak: 1,
      longestStreak: 1,
      lastMeaningfulActionDate: today,
      lastProcessedDay: today,
      creditLedger: {
        // Soins anciens (hors de cette semaine et de la précédente) : 9 soins cumulés en tout.
        ...Object.fromEntries(
          Array.from({ length: STAGE2 - 3 }, (_, i) => {
            const day = localDateKey(addDays(now, -20 + Math.floor(i / 3)));
            return [`ancien-${i}|${day}`, { grantedOn: day, status: 'active' as const }];
          }),
        ),
        [`autre-1|${today}`]: { grantedOn: today, status: 'active' },
        [`autre-2|${today}`]: { grantedOn: today, status: 'active' },
      },
    },
  };
  const v = validateAppState(JSON.parse(JSON.stringify(state)));
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

async function openSeeded(page: Page, module: 'maison' | 'calendar' | 'courses') {
  await page.addInitScript(
    ({ key, ui, value, module }) => {
      if (sessionStorage.getItem('annuler-foret-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module, guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('annuler-foret-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(seeded()), module },
  );
  await page.goto(`${APP}?module=${module}`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

type EngineLights = { size: number; flying: string[] } | null;

/** Lumières vivantes du moteur (build e2e : `window.__worldEngine`) ; null sans WebGL. */
function engineLights(page: Page): Promise<EngineLights> {
  return page.evaluate(() => {
    const e = (window as unknown as { __worldEngine?: { lights: { size: number; flying(n: number): { id: string }[] } } }).__worldEngine;
    if (!e) return null;
    return { size: e.lights.size, flying: e.lights.flying(performance.now() / 1000).map((f) => f.id) };
  });
}

/** Objectif de la semaine tel que l'affiche la carte (palier + anneau). */
async function weeklyGoal(page: Page): Promise<{ level: string; arc: string | null }> {
  const card = page.locator('.weekly-goal');
  await expect(card).toBeVisible();
  const level = ((await card.getAttribute('class')) ?? '').match(/weekly-goal--(\w+)/)?.[1] ?? '';
  return { level, arc: await card.locator('.weekly-goal__arc').getAttribute('stroke-dasharray') };
}

/**
 * Annule PENDANT le vol : à armer AVANT de répondre à « Qui ? ». Dans la
 * page, attend que la luciole vole et que le bouton d'annulation
 * (`selector`, dont le parent contient `withText` si fourni) existe, puis
 * clique aussitôt — sans les allers-retours lents du test, le vol (≈1,7 s)
 * serait parfois déjà fini. Résout à vrai si le moteur tourne (WebGL) : le
 * vol a alors été vu au moment du clic ; faux sans WebGL (clic simple, seul
 * l'état est vérifié).
 */
async function armUndoInFlight(page: Page, selector: string, withText?: string, minK = 0): Promise<boolean> {
  const flyingAtUndo = await page.evaluate(
    async ({ selector, withText, minK }) => {
      const e = (window as unknown as { __worldEngine?: { lights: { flying(n: number): { id: string; k: number }[] } } }).__worldEngine;
      const find = () =>
        Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
          (el) => withText === undefined || (el.parentElement?.textContent ?? '').includes(withText),
        );
      // `minK` : attendre que le vol soit avancé (0..1) — annulation juste avant l'atterrissage.
      const flying = () => (e ? e.lights.flying(performance.now() / 1000).filter((f) => f.k >= minK).map((f) => f.id) : []);
      const t0 = performance.now();
      while (performance.now() - t0 < 15_000 && (find() === undefined || (e !== undefined && flying().length === 0))) {
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      }
      const ids = flying();
      find()?.click();
      return e ? ids : null;
    },
    { selector, withText, minK },
  );
  if (flyingAtUndo === null) return false;
  expect(flyingAtUndo, 'la luciole vole au moment de l’annulation').toHaveLength(1);
  return true;
}

/** Après l'annulation : la lumière s'éteint puis le moteur n'en garde aucune. */
async function expectNoForestLight(page: Page, observed: boolean) {
  if (!observed) return;
  await expect.poll(async () => engineLights(page), { timeout: 5_000 }).toEqual({ size: 0, flying: [] });
}

/** État persistant : plus de fait, crédit annulé, croissance acquise (voulu). */
async function expectUndoneState(page: Page, taskId: string) {
  await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(0);
  const { forest } = await persisted(page);
  const entries = Object.entries(forest.creditLedger as Record<string, { status: string }>);
  const credit = entries.find(([k]) => k.startsWith(`${taskId}|`));
  expect(credit?.[1].status).toBe('tombstoned');
  // La forêt ne recule jamais : soin cumulé, vitalité et stade passé restent.
  expect(forest.lifetimeCare).toBe(STAGE2);
  expect(forest.vitality).toBe(36);
  expect(forest.growthStage).toBe(2);
}

test.describe('Annuler une tâche : la forêt suit', () => {
  test('Maison (téléphone) : décocher pendant l’envol, puis depuis « Fait aujourd’hui »', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const errors = trackErrors(page);
    await openSeeded(page, 'maison');
    const before = await weeklyGoal(page);
    expect(before.level).toBe('resting');

    const check = page.getByRole('checkbox', { name: 'Arroser le basilic', exact: true });
    await check.click();
    // Décocher la case pendant que la luciole vole (la ligne s'attarde).
    const undo = armUndoInFlight(page, '.task-list:not(.task-list--done) [role="checkbox"][aria-label="Arroser le basilic"][aria-checked="true"]');
    await pickWho(page, 'a');
    const flying = await undo;
    await expect(check).toHaveAttribute('aria-checked', 'false');
    await expectUndoneState(page, 't-basilic');
    await expectNoForestLight(page, flying);
    expect(await weeklyGoal(page)).toEqual(before);

    // Recocher : nouvelle luciole (le soin, déjà compté, n'est pas redonné).
    await check.click();
    await pickWho(page, 'a');
    await expect(page.getByRole('button', { name: /Fait aujourd’hui/ })).toContainText('1', { timeout: 5_000 });
    if (flying) await expect.poll(async () => (await engineLights(page))?.size, { timeout: 5_000 }).toBe(1);
    expect(await weeklyGoal(page)).toEqual(before);
    // Annuler depuis « Fait aujourd’hui », luciole posée.
    await page.getByRole('button', { name: /Fait aujourd’hui/ }).click();
    await page.getByRole('checkbox', { name: 'Arroser le basilic (annuler)' }).click();
    await expectUndoneState(page, 't-basilic');
    await expectNoForestLight(page, flying);
    expect(await weeklyGoal(page)).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('Maison : le premier coche fait passer le palier, l’annulation le ramène', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSeeded(page, 'maison');
    const before = await weeklyGoal(page);
    await page.getByRole('checkbox', { name: 'Arroser le basilic', exact: true }).click();
    await pickWho(page, 'a');
    await expect.poll(async () => (await weeklyGoal(page)).level).toBe('good');
    expect((await weeklyGoal(page)).arc).not.toBe(before.arc);
    await expect.poll(async () => (await persisted(page)).forest.growthStage).toBe(2);
    await page.getByRole('button', { name: /Fait aujourd’hui/ }).click();
    await page.getByRole('checkbox', { name: 'Arroser le basilic (annuler)' }).click();
    await expect.poll(async () => weeklyGoal(page)).toEqual(before);
  });

  test('Calendrier (ordinateur) : « Annuler » du toast pendant l’envol', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const errors = trackErrors(page);
    await openSeeded(page, 'maison');
    const before = await weeklyGoal(page);
    await goTo(page, 'Calendrier');
    const box = page.locator('.cal-day-panel .cal-task', { hasText: 'Arroser les plantes' }).getByRole('checkbox');
    await box.click();
    const undo = armUndoInFlight(page, '.toast .toast__action', 'Une luciole de plus');
    await pickWho(page, 'b');
    const flying = await undo;
    await expect(box).toHaveAttribute('aria-checked', 'false');
    await expectUndoneState(page, 't-plantes');
    await expectNoForestLight(page, flying);
    await goTo(page, 'Maison');
    expect(await weeklyGoal(page)).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('Calendrier (ordinateur) : « Annuler » juste avant l’atterrissage, la forêt figée finit le fondu', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openSeeded(page, 'calendar');
    const box = page.locator('.cal-day-panel .cal-task', { hasText: 'Arroser les plantes' }).getByRole('checkbox');
    await box.click();
    // Fondu (1,6 s) plus long que le reste du vol : la scène figée doit le finir après l'atterrissage.
    const undo = armUndoInFlight(page, '.toast .toast__action', 'Une luciole de plus', 0.5);
    await pickWho(page, 'b');
    const flying = await undo;
    await expectUndoneState(page, 't-plantes');
    await expectNoForestLight(page, flying);
  });

  test('Calendrier : décoché à la case, « Annuler » du toast ne recoche pas', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSeeded(page, 'calendar');
    const box = page.locator('.cal-day-panel .cal-task', { hasText: 'Arroser les plantes' }).getByRole('checkbox');
    await box.click();
    await pickWho(page, 'b');
    await expect(box).toHaveAttribute('aria-checked', 'true');
    await box.click();
    await expect(box).toHaveAttribute('aria-checked', 'false');
    await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(0);
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(box).toHaveAttribute('aria-checked', 'false');
    expect((await persisted(page)).chores.completions).toEqual([]);
  });

  test('Courses (ordinateur) : « Annuler » après « Vider le panier », pendant l’envol', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const errors = trackErrors(page);
    await openSeeded(page, 'maison');
    const before = await weeklyGoal(page);
    await goTo(page, 'Courses');
    const input = page.locator('#grocery-input');
    await input.fill('Pain');
    await input.press('Enter');
    await page.getByRole('checkbox', { name: 'Pain', exact: true }).click();
    await page.getByRole('button', { name: 'Vider le panier' }).click();
    const undo = armUndoInFlight(page, '.toast .toast__action', 'Une luciole de plus');
    await pickWho(page, 'a');
    const flying = await undo;
    await expect(page.getByRole('checkbox', { name: 'Pain', exact: true })).toBeChecked();
    await expectUndoneState(page, 't-courses');
    await expectNoForestLight(page, flying);
    await goTo(page, 'Maison');
    expect(await weeklyGoal(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
});
