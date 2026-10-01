import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4199/preview.html';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../qa-forest');

const LABELS = [
  '1 · Quiet (apaisée)',
  '2 · Peaceful (paisible)',
  '3 · Lively (vivante)',
  '4 · Flourishing (en floraison)',
  '5 · Événement rare — le Gardien',
];
const FILES = ['quiet', 'peaceful', 'lively', 'flourishing', 'guardian'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800); // laisser les animations se poser

for (let i = 0; i < LABELS.length; i += 1) {
  const fig = page.locator('figure').nth(i);
  await fig.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await fig.screenshot({ path: path.join(OUT, `forest-${FILES[i]}.png`) });
  console.log(`captured ${FILES[i]}`);
}

// Vue large (grille complète) pour la hiérarchie.
await page.setViewportSize({ width: 1100, height: 900 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'forest-grid.png'), fullPage: true });
console.log('captured grid');

await browser.close();
