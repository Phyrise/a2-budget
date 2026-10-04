/**
 * QA des corrections V3.2 (serveur de dev, 320 px tactile) :
 * - Courses : cocher un article → un seul son (le balai), Kiki traverse la
 *   ligne par transform ;
 * - Calendrier : supprimer puis « Annuler » → aucun son ; bouton d'ajout
 *   « Ajouter un événement aujourd’hui » ;
 * - Budget : la jauge d'or se remplit par scaleX (pas de width).
 * État construit par @a2/core (validateAppState ok, qa-shell.seed.mjs).
 *
 * Usage (depuis la racine du dépôt) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5187 --strictPort &
 *   node apps/web/scripts/qa-corrections-v32.mjs [port]
 * Sorties : apps/web/qa/corrections-v32/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { seedShellState } from './qa-shell.seed.mjs';

const port = Number(process.argv[2] ?? 5187);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'corrections-v32');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || detail === '' ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};

async function seed(page, module) {
  await page.goto(`${APP}?module=${module}`);
  const r = await page.evaluate(seedShellState, { entry: coreEntry, module, devMode: false });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').first().waitFor();
  await page.waitForTimeout(600);
}

async function recordCues(page) {
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/a2-budget/src/app/sound/engine.ts');
    window.__cues = [];
    window.__off?.();
    window.__off = m.soundEngine.subscribe((rec) => window.__cues.push(rec.cue));
  });
}
const cues = (page) => page.evaluate(() => window.__cues.slice());

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Courses : un geste, un son ; Kiki composité.
await seed(page, 'courses');
await recordCues(page);
await page.getByRole('checkbox', { name: /Lait/ }).click();
await page.waitForTimeout(220);
const kiki = await page.evaluate(() => {
  const el = document.querySelector('.sweep-fx__kiki');
  return el ? { transform: getComputedStyle(el).transform, left: getComputedStyle(el).left } : null;
});
check('Kiki traverse par transform (left fixe)', kiki !== null && kiki.transform !== 'none' && kiki.left === '0px', kiki);
await page.screenshot({ path: join(outDir, '01-courses-balai.png') });
await page.waitForTimeout(1300);
check('cocher un article : un seul son (balai)', JSON.stringify(await cues(page)) === '["broom"]', await cues(page));

// Calendrier : annuler une suppression ne sonne pas.
await seed(page, 'calendar');
const add = page.locator('.cal-day-panel .section-head button');
check('bouton d’ajout : « … aujourd’hui »', (await add.getAttribute('aria-label')) === 'Ajouter un événement aujourd’hui', await add.getAttribute('aria-label'));
await recordCues(page);
const row = page.locator('.cal-event', { hasText: 'Dîner prévu à la maison' }).first();
await row.getByRole('button').click();
await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
await page.waitForTimeout(800);
check('l’événement est revenu', (await page.locator('.cal-event', { hasText: 'Dîner prévu à la maison' }).count()) > 0);
check('supprimer puis annuler : aucun son', (await cues(page)).length === 0, await cues(page));
await page.locator('#cal-quick-input').fill('pot le 31 avril');
await page.locator('#cal-quick-input').press('Enter');
const title = await page.locator('#event-title').inputValue();
check('jour inexistant : gardé dans le titre', title === 'Pot le 31 avril', title);
await page.keyboard.press('Escape');

// Budget : jauge d'or par transform.
await seed(page, 'budget');
await page.waitForTimeout(1300);
const gauge = await page.evaluate(() => {
  const el = document.querySelector('.gold-gauge__fill');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { inline: el.getAttribute('style'), transition: cs.transitionProperty, width: el.getBoundingClientRect().width };
});
check('jauge d’or : scaleX, transition sur transform', gauge !== null && /scaleX/.test(gauge.inline) && gauge.transition === 'transform', gauge);
await page.locator('.gold-gauge').screenshot({ path: join(outDir, '02-jauge.png') });

check('aucune erreur console', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nTout est en ordre.' : `\n${failures.length} échec(s) : ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
