/**
 * Fêtes (V4.3) : anniversaires préremplis (le 19 de chaque mois, AL le
 * 19 août, AC le 27 décembre), modifiables au crayon dans les Réglages,
 * annuels virtuels au calendrier (jamais écrits), lampion du couple dans la
 * grille, fête d'AL une fois par jour à l'ouverture.
 */
import { expect, test } from '@playwright/test';
import { APP, PHONE, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

test('calendrier : AC annoncé un mois avant, lampion du 19, rien d’écrit ; le toucher ouvre les Réglages', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2026-12-10T10:00:00'));
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();

  const upcoming = page.locator('.cal-upcoming-section');
  await expect(upcoming.getByText('Anniversaire d’AC')).toBeVisible();
  await expect(upcoming.getByText('Anniversaire d’AL')).toHaveCount(0);
  await expect(page.locator('[data-date="2026-12-19"]')).toHaveAttribute('aria-label', /anniversaire du couple/);
  await expect(page.locator('[data-date="2026-12-19"] .lampion')).toHaveCount(1);
  await expect(page.locator('[data-date="2026-12-18"] .lampion')).toHaveCount(0);
  await expect(page.locator('[data-date="2026-12-27"]')).toHaveAttribute('aria-label', /Anniversaire d’AC/);

  await upcoming.getByRole('button', { name: /Anniversaire d’AC/ }).click();
  await expect(sheet(page, 'Réglages')).toBeVisible();
  const state = await persisted(page);
  expect(state.calendar).toBeUndefined();
  expect(state.anniversaries).toEqual({ coupleDay: 19, a: { month: 8, day: 19 }, b: { month: 12, day: 27 } });
  expect(errors).toEqual([]);
});

test('Réglages : anniversaires au crayon, saisie libre, date illisible refusée', async ({ page }) => {
  await page.goto(`${APP}?module=budget`);
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = sheet(page, 'Réglages');
  const section = settings.locator('section', { has: page.getByRole('heading', { name: 'Anniversaires' }) });
  await expect(section.getByLabel('Anniversaire du couple, chaque mois')).toHaveValue('tous les 19');
  await expect(section.getByLabel('Anniversaire d’AL')).toHaveValue('19 août');
  await expect(section.getByLabel('Anniversaire d’AC')).toHaveValue('27 décembre');

  const al = section.getByLabel('Anniversaire d’AL');
  await al.fill('3/3');
  await al.press('Enter');
  await expect(al).toHaveValue('3 mars');
  const couple = section.getByLabel('Anniversaire du couple, chaque mois');
  await couple.fill('le 21');
  await couple.press('Enter');
  await expect(couple).toHaveValue('tous les 21');
  await expect.poll(async () => (await persisted(page)).anniversaries).toEqual({ coupleDay: 21, a: { month: 3, day: 3 }, b: { month: 12, day: 27 } });

  const ac = section.getByLabel('Anniversaire d’AC');
  await ac.fill('demain');
  await ac.press('Enter');
  await expect(page.locator('.toast')).toContainText('Date non reconnue');
  await expect(ac).toHaveValue('27 décembre');
  expect((await persisted(page)).anniversaries.b).toEqual({ month: 12, day: 27 });
});

test('le 19 août : Jiji fête AL une fois dans la journée, un toucher la ferme', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2027-08-19T09:00:00'));
  await page.goto(`${APP}?module=maison`);
  const party = page.getByRole('button', { name: 'Joyeux anniversaire, AL (fermer)' });
  await expect(party).toBeVisible();
  await expect(page.locator('.party-hat')).toHaveCount(1);
  await party.click();
  await expect(page.locator('.party')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('.party')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('ordinateur', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('le train des eaux traverse la peinture du Budget à la première ouverture du mois, une fois', async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.setFixedTime(new Date('2026-11-01T09:00:00'));
    await page.goto(`${APP}?module=budget`);
    await expect(page.locator('.chihiro-train__run')).toHaveCount(1);
    await expect(page.locator('.chihiro-train')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('a2-budget:fetes:v1') ?? '{}').trainSeen)).toBe('2026-11');

    await page.reload();
    await expect(page.locator('.screen-sheet')).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.locator('.chihiro-train__run')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
