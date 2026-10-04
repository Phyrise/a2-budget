/**
 * Corrections V3.2 du Calendrier : le 29 février (saisie rapide sans année,
 * aller-retour d'une modification avec année connue) et le libellé du
 * bouton d'ajout (« aujourd’hui », pas « le aujourd’hui »).
 */
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function openCalendar(page: Page) {
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

test.describe('Calendrier — 29 février et libellés', () => {
  test('bouton d’ajout : « Ajouter un événement aujourd’hui »', async ({ page }) => {
    await openCalendar(page);
    const add = page.locator('.cal-day-panel .section-head button');
    await expect(add).toHaveAttribute('aria-label', 'Ajouter un événement aujourd’hui');
  });

  test('« anniv de Léa le 29 février » : le prochain 29 février, fêté dès cette année, sans âge', async ({ page }) => {
    const errors = trackErrors(page);
    await openCalendar(page);
    await page.locator('#cal-quick-input').fill('anniv de Léa le 29 février');
    await page.locator('#cal-quick-input').press('Enter');
    const dialog = sheet(page, 'Nouvel événement');
    await expect(dialog).toBeVisible();
    const now = await page.evaluate(() => ({ y: new Date().getFullYear(), m: new Date().getMonth(), d: new Date().getDate() }));
    let next = now.y;
    while (!isLeap(next) || (next === now.y && (now.m > 1 || (now.m === 1 && now.d > 29)))) next += 1;
    await expect(dialog.locator('#event-date')).toHaveValue(`${next}-02-29`);
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();

    let lastLeap = now.y;
    while (!isLeap(lastLeap)) lastLeap -= 1;
    const event = (await persisted(page)).calendar.events[0];
    expect(event).toMatchObject({ kind: 'anniversaire', yearly: true, yearKnown: false, date: `${lastLeap}-02-29` });
    expect(errors).toEqual([]);
  });

  test('modifier un anniversaire du 29 février depuis un 28 février garde le 29', async ({ page }) => {
    await openCalendar(page);
    await page.getByRole('button', { name: /^Ajouter un événement/ }).click();
    const dialog = sheet(page, 'Nouvel événement');
    await dialog.locator('#event-title').fill('Léa');
    await dialog.locator('label.cal-kind-chip', { hasText: 'Anniversaire' }).click();
    await dialog.locator('#event-date').fill('2028-02-29');
    await dialog.locator('#event-birth-year').fill('1990');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    // 1990 n'avait pas de 29 février : c'est expliqué, rien n'est enregistré.
    await expect(dialog.locator('#event-birth-year-error')).toContainText('pas de 29');
    await dialog.locator('#event-birth-year').fill('1992');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await persisted(page)).calendar.events[0]).toMatchObject({ date: '1992-02-29', yearKnown: true });

    // Février 2027 (non bissextile) : l'occurrence est le 28 ; on ne change que le titre.
    await openCalendar(page); // repart du mois en cours
    const nowY = await page.evaluate(() => new Date().getFullYear());
    const nowM = await page.evaluate(() => new Date().getMonth());
    const steps = (2027 - nowY) * 12 + (1 - nowM);
    const dir = steps >= 0 ? 'Mois suivant' : 'Mois précédent';
    for (let i = 0; i < Math.abs(steps); i += 1) await page.getByRole('button', { name: dir }).click();
    await page.locator('[data-date="2027-02-28"]').click();
    const row = page.locator('.cal-day-panel .cal-event--birthday');
    await expect(row).toContainText('Anniversaire de Léa');
    await expect(row.locator('.cal-event__age')).toHaveText('35 ans');
    await row.getByRole('button').click();
    const edit = sheet(page, 'Modifier l’événement');
    await expect(edit.locator('#event-date')).toHaveValue('2027-02-28');
    await edit.locator('#event-title').fill('Léa M.');
    await edit.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(edit).toBeHidden();
    expect((await persisted(page)).calendar.events[0]).toMatchObject({ title: 'Léa M.', date: '1992-02-29' });
  });
});
