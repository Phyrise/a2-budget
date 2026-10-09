/**
 * V5.3 — la quête vit DANS la scène de l'onglet : pour chaque onglet et
 * chaque emplacement (mode développeur « Place 1..3 »), l'objet est posé
 * dans la feuille (pas sur le bandeau), visible sans long défilement, au-dessus
 * de la scène, et ne recouvre ni bouton, ni champ, ni montant.
 */
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, UI_KEY, trackErrors } from './helpers';
import { openDev } from './devPanel';

test.use({ viewport: PHONE });

const KINDS = [
  { tab: 'budget', label: 'Rocher (Budget)' },
  { tab: 'courses', label: 'Colis (Courses)' },
  { tab: 'calendar', label: 'Pousse (Calendrier)' },
] as const;

async function open(page: Page) {
  await page.addInitScript(
    ({ ui }) => {
      if (sessionStorage.getItem('scenes-seeded')) return;
      localStorage.setItem(ui, JSON.stringify({ module: 'budget', forestMotion: 'still', offlineAnnounced: true, devMode: true }));
      sessionStorage.setItem('scenes-seeded', '1');
    },
    { ui: UI_KEY },
  );
  await page.goto(`${APP}?module=budget`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

async function spawn(page: Page, label: string, spot: number) {
  const dev = await openDev(page, 'Quêtes');
  await dev.getByRole('button', { name: `Place ${spot + 1}` }).click();
  await dev.getByRole('button', { name: label }).click();
  await expect(dev).toHaveCount(0);
}

/** Ce que l'objet recouvre (boutons, champs, montants), et s'il est bien au-dessus. */
async function check(page: Page) {
  return page.evaluate(() => {
    const q = document.querySelector<HTMLElement>('.quest')!;
    const r = q.getBoundingClientRect();
    const sheet = q.closest('.screen-sheet')!.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of document.querySelectorAll('.screen-sheet button, .screen-sheet input, .screen-sheet textarea, .screen-sheet .amount')) {
      if (q.contains(el) || el.closest('.soot-stage')) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      if (r.left < b.right - 1 && b.left < r.right - 1 && r.top < b.bottom - 1 && b.top < r.bottom - 1) hits.push(el.className || el.tagName);
    }
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.6);
    return {
      hits,
      onTop: top !== null && q.contains(top),
      inSheet: r.top >= sheet.top,
      docBottom: r.bottom + window.scrollY,
      maxBottom: window.innerHeight * 1.3,
      perch: Number(q.dataset.perch),
    };
  });
}

for (const { tab, label } of KINDS) {
  test(`${tab} : chaque emplacement est dans la scène, libre et visible`, async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    if (tab === 'courses') {
      await page.locator('nav').getByRole('button', { name: 'Courses', exact: true }).click();
      for (const t of ['2 pommes', 'lait', 'pain']) {
        await page.fill('#grocery-input', t);
        await page.keyboard.press('Enter');
      }
    }
    const seen = new Set<string>();
    for (const spot of [0, 1, 2]) {
      await spawn(page, label, spot);
      const quest = page.locator(`.screen-sheet.${tab} .quest`);
      await expect(quest).toHaveAttribute('data-spot', String(spot));
      await expect(quest).toHaveAttribute('data-perch', /\d/);
      await page.evaluate(() => window.scrollTo(0, 0));
      const c = await check(page);
      expect(c.perch, `${tab} place ${spot + 1} dans la scène`).toBeGreaterThanOrEqual(0);
      expect(c.inSheet).toBe(true);
      expect(c.hits, `${tab} place ${spot + 1} ne recouvre rien`).toEqual([]);
      expect(c.docBottom).toBeLessThanOrEqual(c.maxBottom);
      await quest.scrollIntoViewIfNeeded();
      expect((await check(page)).onTop).toBe(true);
      const box = (await quest.boundingBox())!;
      seen.add(`${Math.round(box.x)}:${Math.round(box.y + (await page.evaluate(() => window.scrollY)))}`);
    }
    // Trois places distinctes.
    expect(seen.size).toBe(3);
    // Toucher marche toujours : AL aide (invité), effet partiel.
    await page.locator(`.screen-sheet.${tab} .quest`).click();
    await expect(page.locator(`.screen-sheet.${tab} .quest`)).toHaveAttribute('data-status', 'half');
    expect(errors).toEqual([]);
  });
}

test('courses, liste vide : le colis tombe dans la scène de Kiki', async ({ page }) => {
  await open(page);
  await spawn(page, 'Colis (Courses)', 0);
  const quest = page.locator('.screen-sheet.courses .quest');
  await expect(quest).toHaveAttribute('data-perch', '0');
  const c = await check(page);
  expect(c.hits).toEqual([]);
  const art = (await page.locator('.kiki-empty__art').boundingBox())!;
  const q = (await quest.boundingBox())!;
  expect(q.y + q.height).toBeGreaterThan(art.y + art.height / 2);
  expect(q.y + q.height).toBeLessThanOrEqual(art.y + art.height + 4);
});
