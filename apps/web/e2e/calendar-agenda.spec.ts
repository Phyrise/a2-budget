/**
 * Calendrier → Google Agenda (V5.10) : un événement enregistré se copie par
 * le lien « Mon agenda » (nouvel onglet) ; les Réglages exportent tout le
 * calendrier en .ics (anniversaires de A et B compris).
 */
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { APP, PHONE, closeSheet, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

test('« Mon agenda » : lien Google prérempli ; export .ics depuis les Réglages', async ({ page }) => {
  const errors = trackErrors(page);
  // Mardi 6 octobre 2026 : « samedi » = le 10.
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();

  await page.getByRole('button', { name: /^Ajouter un événement/ }).click();
  const create = sheet(page, 'Nouvel événement');
  await create.locator('#event-sentence').fill('dîner chez Léa samedi 20h');
  // Pas de lien tant que l'événement n'existe pas.
  await expect(create.getByRole('link', { name: /Mon agenda/ })).toHaveCount(0);
  await create.locator('#event-place').fill('Montreuil, 93');
  await create.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(create).toBeHidden();

  await page.locator('.cal-day-panel .cal-event', { hasText: 'Dîner chez Léa' }).click();
  const edit = sheet(page, 'Modifier l’événement');
  const link = edit.getByRole('link', { name: /Mon agenda/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  const href = new URL((await link.getAttribute('href'))!);
  expect(href.origin + href.pathname).toBe('https://calendar.google.com/calendar/render');
  expect(href.searchParams.get('action')).toBe('TEMPLATE');
  expect(href.searchParams.get('text')).toBe('Dîner chez Léa');
  expect(href.searchParams.get('dates')).toBe('20261010T200000/20261010T210000');
  expect(href.searchParams.get('location')).toBe('Montreuil, 93');
  await closeSheet(page, 'Modifier l’événement');

  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = sheet(page, 'Réglages');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    settings.getByRole('button', { name: 'Exporter le calendrier (.ics)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('a2home-calendrier-2026-10-06.ics');
  const path = await download.path();
  if (path === null) throw new Error('Calendrier téléchargé inaccessible.');
  const ics = await readFile(path, 'utf8');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics).toContain('BEGIN:VEVENT\r\n');
  expect(ics).toContain('SUMMARY:Dîner chez Léa\r\n');
  expect(ics).toContain('DTSTART:20261010T200000\r\n');
  expect(ics).toContain('LOCATION:Montreuil\\, 93\r\n');
  // Anniversaires d'AL et d'AC (Réglages), annuels.
  expect(ics).toContain('SUMMARY:Anniversaire d’AL\r\n');
  expect(ics).toContain('SUMMARY:Anniversaire d’AC\r\n');
  expect(ics.match(/RRULE:FREQ=YEARLY/g)).toHaveLength(2);
  expect(errors).toEqual([]);
});
