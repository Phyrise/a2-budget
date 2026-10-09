/**
 * Panneau DEV rangé en accordéon (V5.4) : ouvre le panneau depuis l'en-tête
 * puis la section voulue (une seule ouverte ; la dernière est retenue, on ne
 * la referme donc pas si elle l'est déjà). Partagé avec e2e-sync.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export type DevSectionTitle =
  | 'Quêtes'
  | 'Avatar'
  | 'Compagnons'
  | 'Noiraudes'
  | 'Fêtes'
  | 'Saisons'
  | 'Aperçus et sons'
  | 'Chiffres'
  | 'Remise à zéro';

export function devSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Mode développeur', exact: true });
}

/** Ouvre une section d'un panneau DEV déjà affiché. */
export async function openDevSection(page: Page, title: DevSectionTitle): Promise<Locator> {
  const dev = devSheet(page);
  const toggle = dev.getByRole('button', { name: title, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return dev;
}

/** Bouton « DEV » de l'en-tête, puis la section voulue. */
export async function openDev(page: Page, title: DevSectionTitle): Promise<Locator> {
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  await expect(devSheet(page)).toBeVisible();
  return openDevSection(page, title);
}
