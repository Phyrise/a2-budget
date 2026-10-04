/**
 * Aides partagées des tests navigateur (interface V2 « Yakushima »).
 * Les tests tournent contre le build de production (`pnpm preview`).
 */
import { expect, type Page } from '@playwright/test';

export const STORAGE_KEY = 'a2-budget:state:v1';
export const UI_KEY = 'a2-budget:ui:v1';
export const APP = '/a2-budget/';

/** Mobile d'abord : iPhone 390 × 844 (la config par défaut est un écran de bureau). */
export const PHONE = { width: 390, height: 844 } as const;

/**
 * Format fr-FR/EUR identique à l'app (Intl) : le séparateur de milliers est
 * une espace insécable étroite (U+202F), d'où un formateur et non des
 * chaînes littérales.
 */
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export function fmt(cents: number): string {
  return eur.format(cents / 100);
}

/** Ouvre l'app sur un module donné (via `?module=`, toujours pris en charge). */
export async function openApp(page: Page, module?: 'budget' | 'maison' | 'courses' | 'calendar') {
  await page.goto(module ? `${APP}?module=${module}` : APP);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

export function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Modules de la maison' });
}

export async function goTo(page: Page, name: 'Budget' | 'Maison' | 'Courses' | 'Calendrier') {
  const button = nav(page).getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}

/**
 * Saisie d'un montant : focaliser le champ AVANT fill (le passage
 * formaté → édition remplace la chaîne), puis blur pour valider.
 */
export async function setAmount(page: Page, id: string, text: string) {
  const input = page.locator(`#${id}`);
  await input.click();
  await input.fill(text);
  await input.blur();
}

export async function monthKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function sheet(page: Page, title: string) {
  return page.getByRole('dialog', { name: title, exact: true });
}

/** Ferme une feuille par son bouton « Fermer » et attend sa disparition. */
export async function closeSheet(page: Page, title: string) {
  const dialog = sheet(page, title);
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Lit l'état persisté (V2) dans localStorage. */
export async function persisted(page: Page): Promise<any> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/** Collecte les erreurs de page (exceptions non interceptées). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
