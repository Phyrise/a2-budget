import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://phyrise.github.io/a2-budget/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'qa-live');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// 1. Budget (vue par défaut)
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'live-budget.png'), fullPage: true });
console.log('captured budget');

// 2. Maison
await page.goto(BASE + '?module=maison', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'live-maison.png'), fullPage: true });
console.log('captured maison');

// 3. Courses (échafaudage)
await page.goto(BASE + '?module=courses', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'live-courses.png'), fullPage: true });
console.log('captured courses');

// 4. Overlay Réglages
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Réglages' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'live-settings.png') });
console.log('captured settings overlay');

console.log('--- JS errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
