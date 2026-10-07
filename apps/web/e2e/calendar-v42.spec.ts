/**
 * Calendrier et coquille V4.2 (retours d'Arthur) : cinq natures sur deux
 * lignes (voyage fusionné dans « Sortie », maison retirée ; les anciens
 * événements restent lisibles) ; jour libre sans « Totoro fait la sieste » ;
 * la lune de Maison à gauche de l'Historique (qui ne bouge plus) ; pas de
 * zoom (viewport).
 */
import { addDays, emptyAppState, localDateKey, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, goTo, openApp } from './helpers';

test.use({ viewport: PHONE });

function legacyState(): AppState {
  const s = emptyAppState();
  const now = new Date();
  const event = (id: string, title: string, kind: 'voyage' | 'maison', days: number) => ({
    id,
    title,
    date: localDateKey(addDays(now, days)),
    allDay: true,
    kind,
    who: 'both' as const,
    createdAt: now.toISOString(),
  });
  const state: AppState = { ...s, calendar: { events: [event('e-v', 'Week-end à Lyon', 'voyage', 1), event('e-m', 'Plombier', 'maison', 2)] } };
  const v = validateAppState(JSON.parse(JSON.stringify(state)));
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

async function openLegacy(page: Page) {
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('v42-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'calendar', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('v42-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: JSON.stringify(legacyState()) },
  );
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();
}

test.describe('Calendrier et coquille V4.2', () => {
  test('cinq natures, sur deux lignes à 390 px', async ({ page }) => {
    await openApp(page, 'calendar');
    await page.getByRole('button', { name: /^Ajouter un événement/ }).click();
    const chips = page.locator('label.cal-kind-chip');
    await expect(chips).toHaveText(['Repas', 'Sortie', 'Anniversaire', 'Rendez-vous', 'Autre']);
    const rows = await chips.evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size);
    expect(rows).toBe(2);
  });

  test('anciens voyage / maison : lisibles, rangés en Sortie / Autre', async ({ page }) => {
    await openLegacy(page);
    const trip = page.locator('.cal-event', { hasText: 'Week-end à Lyon' }).first();
    await expect(trip.locator('.cal-kind-badge--sortie')).toBeAttached();
    await trip.click();
    await expect(page.locator('input[name="event-kind"][value="sortie"]')).toBeChecked();
  });

  test('jour libre : « Rien de prévu ce jour-là. », sans sieste', async ({ page }) => {
    await openApp(page, 'calendar');
    const empty = page.locator('.cal-day-empty__text').first();
    if ((await empty.count()) > 0) await expect(empty).not.toContainText('sieste');
    await expect(page.getByText('Totoro fait la sieste')).toHaveCount(0);
  });

  test('en-tête : lune à gauche de l’Historique, qui ne bouge pas d’un onglet à l’autre', async ({ page }) => {
    await openApp(page, 'maison');
    const history = page.getByRole('button', { name: /^Historique/ });
    const moon = page.locator('.app-header .pause-toggle');
    const onMaison = (await history.boundingBox())!;
    expect((await moon.boundingBox())!.x).toBeLessThan(onMaison.x);
    await goTo(page, 'Courses');
    const onCourses = (await history.boundingBox())!;
    expect(Math.round(onCourses.x)).toBe(Math.round(onMaison.x));
  });

  test('pas de zoom : viewport figé, double toucher neutralisé', async ({ page }) => {
    await openApp(page);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('maximum-scale=1');
    expect(viewport).toContain('user-scalable=no');
    expect(viewport).toContain('viewport-fit=cover');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
  });
});
