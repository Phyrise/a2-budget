import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:4200/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'qa-live');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// Réglages (overlay) — bouton aria-label="Réglages"
await page.locator('button[aria-label="Réglages"]').click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'local-settings.png'), fullPage: true });
console.log('captured settings');

// Fermer l'overlay (Échap)
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Historique (overlay) — bouton aria-label="Historique du budget"
await page.locator('button[aria-label="Historique du budget"]').click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'local-history.png'), fullPage: true });
console.log('captured history');

await browser.close();
