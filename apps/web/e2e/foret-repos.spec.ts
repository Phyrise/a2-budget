/**
 * V5.10 — forêt cachée hors Maison (docs/PERF.md piste 6, world/rest.ts).
 *
 * Téléphone : sous le bandeau peint de Courses, la forêt ne dessine plus
 * rien (doigt qui bouge, redimensionnement compris) ; après le délai, sa
 * mémoire graphique est rendue (moteur détruit, contexte WebGL perdu) ; au
 * retour sur Maison elle revient, lucioles du jour à jour, sans rafale de vols.
 * Un aller-retour rapide ne recharge rien. Arrière-plan : même chose (délai
 * plus court). Ordinateur : inchangé.
 *
 * Délais raccourcis dans le build e2e (`window.__forestRestDelays`).
 */
import { addDays, createTask, emptyAppState, localDateKey, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, goTo, persisted, pickWho, trackErrors } from './helpers';
import { openDev } from './devPanel';

const DESKTOP = { width: 1280, height: 800 } as const;
const DELAYS = { covered: 4000, background: 1500 };

function seeded(): AppState {
  const created = localDateKey(addDays(new Date(), -10));
  const s = emptyAppState();
  const tasks = [
    createTask({ id: 't-basilic', title: 'Arroser le basilic', assignee: 'a', recurrence: 'daily' }, created),
    createTask({ id: 't-courses', title: 'Courses', assignee: 'both', recurrence: 'none', groceries: true }, created),
  ];
  const state: AppState = { ...s, chores: { ...s.chores, tasks } };
  const v = validateAppState(JSON.parse(JSON.stringify(state)));
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

async function open(page: Page, prefs: Record<string, unknown> = {}, module = 'maison') {
  await page.addInitScript(
    ({ key, ui, value, delays, prefs }) => {
      (window as unknown as { __forestRestDelays: unknown }).__forestRestDelays = delays;
      // Contextes WebGL créés par la page (fuites : les anciens doivent être perdus).
      const contexts: unknown[] = [];
      (window as unknown as { __glContexts: unknown[] }).__glContexts = contexts;
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        const ctx = (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
        if (ctx && /webgl/.test(type) && !contexts.includes(ctx)) contexts.push(ctx);
        return ctx;
      } as typeof get;
      // Arrière-plan simulé (document.hidden + visibilitychange).
      let hidden = false;
      const proto = Document.prototype;
      const realHidden = Object.getOwnPropertyDescriptor(proto, 'hidden')!;
      const realState = Object.getOwnPropertyDescriptor(proto, 'visibilityState')!;
      Object.defineProperty(proto, 'hidden', { configurable: true, get() { return hidden || realHidden.get!.call(this); } });
      Object.defineProperty(proto, 'visibilityState', { configurable: true, get() { return hidden ? 'hidden' : realState.get!.call(this); } });
      (window as unknown as { __setHidden: (v: boolean) => void }).__setHidden = (v) => {
        hidden = v;
        document.dispatchEvent(new Event('visibilitychange'));
      };
      if (sessionStorage.getItem('foret-repos-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'maison', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true, devMode: true, ...prefs }));
      sessionStorage.setItem('foret-repos-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(seeded()), delays: DELAYS, prefs },
  );
  await page.goto(`${APP}?module=${module}`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

type Engine = { frames: number; lights: number; flying: number; mark: number | null } | null;

/** Moteur vivant (build e2e : `window.__worldEngine`) ; null s'il est libéré (ou sans WebGL). */
function engine(page: Page): Promise<Engine> {
  return page.evaluate(() => {
    const e = (window as unknown as {
      __worldEngine?: { stats(): { frames: number }; lights: { size: number; flying(n: number): unknown[] }; __mark?: number };
    }).__worldEngine;
    if (!e) return null;
    return { frames: e.stats().frames, lights: e.lights.size, flying: e.lights.flying(performance.now() / 1000).length, mark: e.__mark ?? null };
  });
}

/** Toile montrée (fondu peinture → toile terminé ou en cours). */
async function canvasShown(page: Page) {
  await expect
    .poll(() => page.evaluate(() => {
      const canvas = document.querySelector('.living-forest canvas');
      // Toile absente : pas montrée (et non l'opacité de <body>).
      return canvas ? Number(getComputedStyle(canvas).opacity) : 0;
    }), { timeout: 15_000 })
    .toBeGreaterThan(0.5);
}

const markEngine = (page: Page, mark: number) =>
  page.evaluate((m) => {
    const e = (window as unknown as { __worldEngine?: { __mark?: number } }).__worldEngine;
    if (e) e.__mark = m;
  }, mark);

/** Contextes WebGL de la page encore vivants. */
const liveContexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __glContexts: { isContextLost(): boolean }[] }).__glContexts.filter((c) => !c.isContextLost()).length);

async function hasWebGL(page: Page): Promise<boolean> {
  await page.waitForTimeout(1500);
  return (await engine(page)) !== null;
}

test.describe('Forêt cachée hors Maison', () => {
  test('téléphone : plus d’images sous le bandeau, mémoire rendue après le délai, retour à jour', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const errors = trackErrors(page);
    await open(page);
    test.skip(!(await hasWebGL(page)), 'sans WebGL');
    await canvasShown(page);

    // Une luciole du jour avant de partir.
    await page.getByRole('checkbox', { name: 'Arroser le basilic', exact: true }).click();
    await pickWho(page, 'a');
    await expect.poll(async () => (await engine(page))?.lights).toBe(1);
    await expect.poll(async () => (await engine(page))?.flying, { timeout: 5_000 }).toBe(0);
    await markEngine(page, 1);

    // Courses : plus une image, même doigt qui bouge et redimensionnement.
    await goTo(page, 'Courses');
    await page.waitForTimeout(300);
    const frozen = (await engine(page))!.frames;
    for (let i = 0; i < 15; i += 1) await page.mouse.move(60 + i * 15, 600 - i * 10);
    await page.setViewportSize({ width: PHONE.width, height: PHONE.height - 60 });
    await page.waitForTimeout(400);
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(400);
    expect((await engine(page))?.frames).toBe(frozen);

    // Aller-retour rapide : même moteur, rien rechargé.
    await goTo(page, 'Maison');
    await expect.poll(async () => (await engine(page))?.frames).toBeGreaterThan(frozen);
    expect((await engine(page))?.mark).toBe(1);
    await goTo(page, 'Courses');

    // Après le délai : moteur libéré, toile retirée, contexte WebGL rendu.
    await expect.poll(() => engine(page), { timeout: DELAYS.covered + 5_000 }).toBeNull();
    await expect(page.locator('.living-forest canvas')).toHaveCount(0);
    expect(await liveContexts(page)).toBe(0);

    // Une luciole gagnée pendant ce temps (Courses : « Vider le panier »).
    const input = page.locator('#grocery-input');
    await input.fill('Pain');
    await input.press('Enter');
    await page.getByRole('checkbox', { name: 'Pain', exact: true }).click();
    await page.getByRole('button', { name: 'Vider le panier' }).click();
    await pickWho(page, 'b');
    await expect.poll(async () => (await persisted(page)).chores.completions.length).toBe(2);

    // Panneau DEV : état clair.
    const dev = await openDev(page, 'Saisons');
    await expect(dev.getByTestId('dev-render')).toContainText('libérées');
    await page.keyboard.press('Escape');
    await expect(dev).toBeHidden();

    // Retour sur Maison : la forêt revient (fondu), les deux lucioles posées, aucun vol rejoué.
    await goTo(page, 'Maison');
    await canvasShown(page);
    const back = await engine(page);
    expect(back?.mark).toBeNull();
    expect(back?.lights).toBe(2);
    expect(back?.flying).toBe(0);
    expect(back!.frames).toBeGreaterThan(0);
    expect(await liveContexts(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('téléphone : arrière-plan, mémoire rendue plus vite, puis retour (« 30 images/s » et « Immobile » gardés)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const errors = trackErrors(page);
    await open(page, { forestFps30: true, forestMotion: 'still' });
    test.skip(!(await hasWebGL(page)), 'sans WebGL');
    await canvasShown(page);
    await page.evaluate(() => (window as unknown as { __setHidden: (v: boolean) => void }).__setHidden(true));
    await expect.poll(() => engine(page), { timeout: DELAYS.background + 5_000 }).toBeNull();
    expect(await liveContexts(page)).toBe(0);
    await page.evaluate(() => (window as unknown as { __setHidden: (v: boolean) => void }).__setHidden(false));
    await canvasShown(page);
    expect((await engine(page))!.frames).toBeGreaterThan(0);
    const cfg = await page.evaluate(() => {
      const e = (window as unknown as { __worldEngine: { cfg: { maxFps: number; motion: string } } }).__worldEngine;
      return { maxFps: e.cfg.maxFps, motion: e.cfg.motion };
    });
    expect(cfg).toEqual({ maxFps: 30, motion: 'still' });
    expect(await liveContexts(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('téléphone : ouverte directement sur Courses, ni toile ni moteur chargé avant Maison', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const errors = trackErrors(page);
    const engineChunks: string[] = [];
    page.on('request', (r) => {
      if (/\/engine[-.][^/]*\.js/.test(r.url())) engineChunks.push(r.url());
    });
    await open(page, {}, 'courses');
    await expect(page.locator('#courses-title')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('.living-forest canvas')).toHaveCount(0);
    expect(engineChunks).toEqual([]);
    expect(await engine(page)).toBeNull();
    // Premier passage sur Maison : la forêt se charge.
    await goTo(page, 'Maison');
    await expect(page.locator('.living-forest canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('ordinateur : inchangé (moteur gardé derrière Courses)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const errors = trackErrors(page);
    await open(page);
    test.skip(!(await hasWebGL(page)), 'sans WebGL');
    await canvasShown(page);
    await markEngine(page, 7);
    await goTo(page, 'Courses');
    await page.waitForTimeout(DELAYS.covered + 1000);
    expect((await engine(page))?.mark).toBe(7);
    await expect(page.locator('.living-forest canvas')).toHaveCount(1);
    await goTo(page, 'Maison');
    expect((await engine(page))?.mark).toBe(7);
    expect(errors).toEqual([]);
  });
});
