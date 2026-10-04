/**
 * Calendrier commun (V3.2) : ajouter un dîner par la saisie rapide, un
 * anniversaire annuel (âge affiché, retour l'année suivante), naviguer de
 * mois (boutons et clavier), supprimer puis annuler.
 */
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, persisted, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function openCalendar(page: Page) {
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();
}

const monthName = (offset: number) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1));

/** Clé locale « YYYY-MM-DD » d'aujourd'hui + n jours (calculée dans la page). */
async function dayKey(page: Page, delta: number): Promise<string> {
  return page.evaluate((d) => {
    const t = new Date();
    const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }, delta);
}

async function addViaQuick(page: Page, text: string) {
  await page.locator('#cal-quick-input').fill(text);
  await page.locator('#cal-quick-input').press('Enter');
  const dialog = sheet(page, 'Nouvel événement');
  await expect(dialog).toBeVisible();
  return dialog;
}

const dayPanel = (page: Page) => page.locator('.cal-day-panel');

test.describe('Calendrier — parcours', () => {
  test('ajouter un dîner en une phrase', async ({ page }) => {
    const errors = trackErrors(page);
    await openCalendar(page);
    await expect(page.getByText('Le calendrier est tout calme')).toBeVisible();

    const dialog = await addViaQuick(page, 'dîner chez Léa samedi 20h');
    await expect(dialog.locator('#event-title')).toHaveValue('Dîner chez Léa');
    await expect(dialog.locator('#event-time')).toHaveValue('20:00');
    await expect(dialog.locator('input[name="event-kind"][value="repas"]')).toBeChecked();
    await dialog.locator('#event-place').fill('Montreuil');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.toast')).toContainText('Ajouté au calendrier');

    // Le samedi qui vient est choisi et montre le dîner.
    const saturday = await page.evaluate(() => {
      const t = new Date();
      const iso = ((t.getDay() + 6) % 7) + 1;
      const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((6 - iso + 7) % 7));
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    });
    await expect(page.locator(`.cal-grid [role="gridcell"]:has([data-date="${saturday}"])`)).toHaveAttribute('aria-selected', 'true');
    const row = dayPanel(page).locator('.cal-event', { hasText: 'Dîner chez Léa' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('20 h');
    await expect(row).toContainText('Montreuil');

    const state = await persisted(page);
    expect(state.calendar.events).toHaveLength(1);
    expect(state.calendar.events[0]).toMatchObject({ title: 'Dîner chez Léa', date: saturday, time: '20:00', kind: 'repas', allDay: false });
    expect(errors).toEqual([]);
  });

  test('un anniversaire annuel revient l’année suivante, avec l’âge', async ({ page }) => {
    await openCalendar(page);
    await page.getByRole('button', { name: /^Ajouter un événement/ }).click();
    const dialog = sheet(page, 'Nouvel événement');
    await expect(dialog).toBeVisible();
    await dialog.locator('#event-title').fill('Léa');
    await dialog.locator('label.cal-kind-chip', { hasText: 'Anniversaire' }).click();
    // « Tous les ans » s'active tout seul pour un anniversaire.
    await expect(dialog.getByRole('switch', { name: 'Tous les ans' })).toHaveAttribute('aria-checked', 'true');
    const date = await dayKey(page, 3);
    await dialog.locator('#event-date').fill(date);
    // 1988 est bissextile : un 29 février reste valide.
    await dialog.locator('#event-birth-year').fill('1988');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();

    const age = Number(date.slice(0, 4)) - 1988;
    const row = page.locator('.cal-day-panel .cal-event--birthday');
    await expect(row).toContainText('Anniversaire de Léa');
    await expect(row.locator('.cal-event__age')).toHaveText(`${age} ans`);
    const state = await persisted(page);
    expect(state.calendar.events[0]).toMatchObject({ title: 'Léa', kind: 'anniversaire', yearly: true, date: `1988${date.slice(4)}` });

    // Douze mois plus tard : de nouveau là, un an de plus.
    for (let i = 0; i < 12; i += 1) await page.getByRole('button', { name: 'Mois suivant' }).click();
    // Un 29 février tombe le 28 les années non bissextiles.
    const nextYear = `${Number(date.slice(0, 4)) + 1}${date.slice(4) === '-02-29' ? '-02-28' : date.slice(4)}`;
    await page.locator(`[data-date="${nextYear}"]`).click();
    await expect(row).toContainText('Anniversaire de Léa');
    await expect(row.locator('.cal-event__age')).toHaveText(`${age + 1} ans`);
  });

  test('naviguer de mois, aux boutons et au clavier', async ({ page }) => {
    await openCalendar(page);
    const title = page.locator('#calendar-title');
    await expect(title).toContainText(new RegExp(monthName(0), 'i'));
    await expect(page.getByText('Ensemble', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Mois suivant' }).click();
    await expect(title).toContainText(new RegExp(monthName(1), 'i'));
    await expect(page.locator('#cal-day-title')).toHaveText(new RegExp(`^En ${monthName(1)}`, 'i'));
    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await expect(title).toContainText(new RegExp(monthName(-1), 'i'));

    await page.getByRole('button', { name: 'Revenir à aujourd’hui' }).click();
    await expect(title).toContainText(new RegExp(monthName(0), 'i'));
    const today = page.locator('.cal-day.is-today');
    await expect(today).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('#cal-day-title')).toHaveText('Aujourd’hui');

    // Clavier : flèche droite = lendemain (focalisé), Page suiv. = mois suivant.
    await today.focus();
    await page.keyboard.press('ArrowRight');
    const tomorrow = await dayKey(page, 1);
    await expect(page.locator(`[data-date="${tomorrow}"]`)).toBeFocused();
    await expect(page.locator('#cal-day-title')).toHaveText('Demain');
    await page.keyboard.press('PageDown');
    await expect(title).toContainText(new RegExp(monthName(1), 'i'));
  });

  test('supprimer puis annuler', async ({ page }) => {
    await openCalendar(page);
    const dialog = await addViaQuick(page, 'ciné demain 21h');
    await expect(dialog.locator('input[name="event-kind"][value="sortie"]')).toBeChecked();
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog).toBeHidden();
    const row = dayPanel(page).locator('.cal-event', { hasText: 'Ciné' });
    await expect(row).toBeVisible();

    await row.getByRole('button').click();
    const edit = sheet(page, 'Modifier l’événement');
    await expect(edit).toBeVisible();
    await edit.getByRole('button', { name: 'Supprimer' }).click();
    await expect(edit).toBeHidden();
    await expect(row).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Retiré du calendrier : Ciné');
    expect((await persisted(page)).calendar.events).toHaveLength(0);

    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(row).toBeVisible();
    expect((await persisted(page)).calendar.events).toHaveLength(1);
  });
});
