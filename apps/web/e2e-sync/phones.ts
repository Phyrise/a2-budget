/**
 * Deux téléphones connectés (AL et AC) pour la QA de la synchronisation
 * (docs/SYNC_DESIGN.md §11) : ouverture, gestes courants, copie locale.
 */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ALEXIA, APP, ARTHUR, SYNC_KEY, chooseSetup, fakeGoogle, setupScreen, syncIndicator } from './helpers';

export interface Phone {
  context: BrowserContext;
  page: Page;
}

/** AL met ses données (vides) dans le foyer, puis AC le rejoint. */
export async function twoPhones(browser: Browser): Promise<{ al: Phone; ac: Phone }> {
  const open = async (email: string, choice: 'Y mettre mes données' | 'La rejoindre'): Promise<Phone> => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(APP);
    await fakeGoogle(page, email);
    await expect(setupScreen(page)).toBeVisible();
    await chooseSetup(page, choice);
    await expect(syncIndicator(page)).toHaveAttribute('title', 'À jour');
    return { context, page };
  };
  const al = await open(ARTHUR, 'Y mettre mes données');
  const ac = await open(ALEXIA, 'La rejoindre');
  return { al, ac };
}

export async function closePhones(...phones: Phone[]): Promise<void> {
  for (const phone of phones) await phone.context.close();
}

/** Change de module sans recharger (barre du bas : marche aussi hors ligne). */
export async function go(page: Page, name: 'Budget' | 'Maison' | 'Courses' | 'Calendrier'): Promise<void> {
  const button = page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}

/** Une tâche quotidienne « libre » (personne n'est désigné). */
export async function addFreeDailyTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Nouvelle tâche' });
  await sheet.locator('#task-title').fill(title);
  await sheet.locator('#task-who-unassigned').check();
  await sheet.locator('#task-recurrence-daily').check();
  await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(sheet).toBeHidden();
}

/** Une tâche encore à faire aujourd'hui. */
export function todo(page: Page, title: string) {
  return page.locator('.task-list:not(.task-list--done) .task-row').filter({ hasText: title });
}

/** Coche une tâche à faire et attend qu'elle quitte la liste. */
export async function checkTask(page: Page, title: string): Promise<void> {
  await page.getByRole('checkbox', { name: title, exact: true }).click();
  await expect(todo(page, title)).toHaveCount(0);
}

/** Un événement ajouté en une phrase, le jour choisi (aujourd'hui). */
export async function addEvent(page: Page, sentence: string): Promise<void> {
  await page.getByRole('button', { name: /^Ajouter un événement/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouvel événement' });
  await dialog.locator('#event-sentence').fill(sentence);
  await dialog.locator('#event-sentence').press('Enter');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(dialog).toBeHidden();
}

export function dayEvent(page: Page, title: string) {
  return page.locator('.cal-day-panel .cal-event', { hasText: title });
}

export function transfer(page: Page, who: 'AL' | 'AC') {
  return page.getByRole('checkbox', { name: `Virement d’${who} fait`, exact: true });
}

/** Montant saisi au pavé (budget). */
export async function setEuros(page: Page, id: string, digits: string): Promise<void> {
  await page.locator(`#${id}-value`).click();
  const display = page.locator(`#${id}-pad-display`);
  await expect(display).toBeFocused();
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(display).toHaveCount(0);
}

/** L'état projeté gardé par la copie locale de la synchronisation. */
export async function syncedState(page: Page): Promise<Record<string, any>> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), SYNC_KEY);
  return raw ? (JSON.parse(raw) as { state: Record<string, any> }).state : {};
}

/** Ce qui est partagé, rangé par id (l'ordre d'arrivée peut différer d'un téléphone à l'autre). */
export function shared(state: Record<string, any>) {
  const byId = (list: Array<{ id: string }> | undefined) =>
    [...(list ?? [])].sort((x, y) => x.id.localeCompare(y.id)).map((x) => JSON.stringify(x));
  return {
    forest: state.forest,
    tasks: byId(state.chores?.tasks),
    completions: byId(state.chores?.completions),
    groceries: byId(state.groceries?.items),
    events: byId(state.calendar?.events),
    months: state.budget?.months,
    settings: state.budget?.settings,
  };
}

/** Les deux copies locales partagent les mêmes données (forêt comprise). */
export async function sameCopies(one: Page, other: Page): Promise<boolean> {
  const [x, y] = await Promise.all([syncedState(one), syncedState(other)]);
  return JSON.stringify(shared(x)) === JSON.stringify(shared(y));
}
