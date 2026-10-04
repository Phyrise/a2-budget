/**
 * QA d'intégration V3.2, sur le serveur de dev, en 390 × 844 (tactile) puis
 * 1440 × 900 : le parcours complet des quatre onglets.
 * - Maison : carte « Objectif de la semaine » ;
 * - Budget (Chihiro) : Sans-Visage, jauge d'or, Noiraude après une saisie ;
 * - Courses (Kiki) : coup de balai, panier + Jiji, envol ;
 * - Calendrier : grille, ajout par saisie rapide, anniversaire annuel ;
 * - mode développeur : panneau, aperçu de stade.
 * Contrôles d'intégration : pas de débordement horizontal, la Noiraude passe
 * sous la navigation, l'en-tête ne recouvre pas la fenêtre du bandeau, le
 * bouton DEV ne chevauche pas la marque, une seule peinture d'univers
 * chargée par module visité.
 * État construit par @a2/core (validateAppState ok, qa-shell.seed.mjs).
 *
 * Usage (depuis la racine du dépôt) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5185 --strictPort &
 *   node apps/web/scripts/qa-integration.mjs [port]
 * Sorties : apps/web/qa/integration/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { seedShellState } from './qa-shell.seed.mjs';

const port = Number(process.argv[2] ?? 5185);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'integration');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};
const nav = (page) => page.getByRole('navigation', { name: 'Modules de la maison' });
const go = async (page, name) => {
  await nav(page).getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(700);
};
const rect = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  }, sel);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function run(label, viewport, phone) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const images = new Set();
  page.on('response', (r) => {
    const u = r.url();
    if (/\/(universes|themes|banners)\/.*\.(webp|png|jpg|avif)/.test(u) || /banner|portrait|landscape/.test(u)) images.add(u.split('/').pop());
  });
  const shot = (name) => page.screenshot({ path: join(outDir, `${label}-${name}.png`) });

  await page.goto(`${APP}?module=maison`);
  const seeded = await page.evaluate(seedShellState, { entry: coreEntry, module: 'maison', devMode: true });
  check(`${label} état valide`, seeded.ok, seeded.reason ?? '');
  await page.reload();
  await page.locator('.screen-sheet').first().waitFor();
  await page.waitForTimeout(900);

  // Quatre onglets.
  const tabs = await nav(page).getByRole('button').allTextContents();
  check(`${label} quatre onglets`, tabs.length === 4, tabs);

  // Maison : objectif de la semaine.
  const goal = page.locator('.weekly-goal');
  await goal.scrollIntoViewIfNeeded();
  check(`${label} objectif de la semaine visible`, await goal.isVisible());
  check(`${label} objectif sans chiffre`, !/\d/.test((await goal.innerText()).replace(/\s/g, '')), await goal.innerText());
  await shot('01-maison-objectif');
  await page.evaluate(() => window.scrollTo(0, 0));

  // Budget : Sans-Visage, jauge, Noiraude.
  await go(page, 'Budget');
  check(`${label} Sans-Visage`, await page.locator('.noface').isVisible());
  check(`${label} jauge d'or`, await page.locator('.gold-gauge__track').isVisible());
  check(`${label} bandeau Chihiro chargé`, [...images].some((i) => /budget|chihiro|bath/i.test(i)), [...images]);
  check(`${label} budget sans débordement`, await noOverflow(page));
  const header = await rect(page, '.app-header');
  const bannerWin = await rect(page, '.budget-banner');
  const budgetTitle = await rect(page, '.budget-banner h1, .budget-banner .month-bar');
  if (phone) check(`${label} titre du bandeau sous l'en-tête`, header && bannerWin && budgetTitle && budgetTitle.top >= header.bottom, { header, budgetTitle });
  await shot('02-budget');
  const salary = page.locator('#salary-a');
  await salary.scrollIntoViewIfNeeded();
  await salary.click();
  await salary.fill('2350');
  await salary.blur();
  await page.waitForTimeout(450);
  const runner = await rect(page, '.susu-runner');
  const navBox = await rect(page, '.module-nav, nav[aria-label="Modules de la maison"]');
  check(`${label} Noiraude en course`, runner !== null);
  if (runner && navBox && phone) check(`${label} Noiraude au-dessus de la navigation`, runner.bottom <= navBox.top + 2, { runner, navBox });
  await shot('03-budget-noiraude');
  await page.waitForTimeout(1400);

  // Courses : balai, panier, envol.
  await go(page, 'Courses');
  check(`${label} courses sans débordement`, await noOverflow(page));
  await shot('04-courses');
  await page.getByRole('checkbox', { name: 'Lait', exact: true }).click();
  await page.waitForTimeout(260);
  check(`${label} coup de balai`, (await page.locator('.is-sweeping .sweep-fx__kiki').count()) > 0);
  await shot('05-courses-balai');
  await page.waitForTimeout(1200);
  const stage = page.locator('.basket-stage');
  await stage.scrollIntoViewIfNeeded();
  check(`${label} panier + Jiji`, (await stage.getAttribute('data-fill')) !== 'empty' && (await page.locator('.basket-stage__jiji').count()) === 1);
  await shot('06-courses-panier');
  await page.getByRole('button', { name: /Vider le panier/ }).click();
  await page.waitForTimeout(500);
  const flight = await rect(page, '.kiki-flight');
  check(`${label} envol de Kiki`, flight !== null);
  await shot('07-courses-envol');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Calendrier : grille, ajout, anniversaire.
  await go(page, 'Calendrier');
  check(`${label} grille du mois`, await page.locator('.cal-grid').isVisible());
  check(`${label} calendrier sans débordement`, await noOverflow(page));
  const calWin = await rect(page, '.cal-banner');
  const calTitle = await rect(page, '#calendar-title');
  if (phone) check(`${label} titre du calendrier sous l'en-tête`, calWin && header && calTitle && calTitle.top >= header.bottom, calTitle);
  await shot('08-calendrier');
  await page.locator('#cal-quick-input').fill('dîner chez Léa samedi 20h');
  await page.locator('#cal-quick-input').press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Nouvel événement' });
  await dialog.waitFor();
  await shot('09-calendrier-ajout');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Ajouter un événement/ }).click();
  await dialog.waitFor();
  await dialog.locator('#event-title').fill('Arthur');
  await dialog.locator('label.cal-kind-chip', { hasText: 'Anniversaire' }).click();
  await dialog.locator('#event-birth-year').fill('1994');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForTimeout(400);
  const bday = page.locator('.cal-event--birthday').first();
  check(`${label} anniversaire affiché`, (await bday.count()) > 0 && /Anniversaire d.Arthur/.test(await bday.innerText()));
  await shot('10-calendrier-anniversaire');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('a2-budget:state:v1')).calendar.events.length);
  check(`${label} événements enregistrés`, stored === seeded.events + 2, stored);

  // Mode développeur : panneau et aperçu de stade.
  await go(page, 'Maison');
  const devBtn = await rect(page, '.app-header button[aria-label="Mode développeur"]');
  const brand = await rect(page, '.app-header .brand, .app-header [class*="brand"]');
  check(`${label} bouton DEV présent`, devBtn !== null);
  if (devBtn && brand) {
    const overlap = !(devBtn.right <= brand.left || devBtn.left >= brand.right || devBtn.bottom <= brand.top || devBtn.top >= brand.bottom);
    check(`${label} DEV ne chevauche pas la marque`, !overlap, { devBtn, brand });
  }
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = page.getByRole('dialog', { name: 'Mode développeur' });
  await dev.waitFor();
  await page.waitForTimeout(400);
  await shot('11-dev-panneau');
  const before = await page.evaluate(() => localStorage.getItem('a2-budget:state:v1'));
  await dev.locator('fieldset', { hasText: 'Stade' }).getByRole('button', { name: '6', exact: true }).click();
  await dev.getByRole('button', { name: 'Voir la forêt' }).click();
  await page.waitForTimeout(1200);
  check(`${label} bandeau d'aperçu`, await page.locator('.preview-banner').isVisible());
  const pb = await rect(page, '.preview-banner');
  const chip = await rect(page, '.dev-chip');
  check(`${label} bandeau d'aperçu sous le bouton DEV`, pb && chip && (pb.top >= chip.bottom || pb.left >= chip.right || pb.right <= chip.left), { pb, chip });
  check(`${label} aperçu sans écriture`, before === (await page.evaluate(() => localStorage.getItem('a2-budget:state:v1'))));
  await shot('12-dev-apercu-stade6');
  await page.getByRole('button', { name: 'Revenir à la vraie forêt' }).click();

  check(`${label} aucune erreur console`, errors.length === 0, errors.slice(0, 3));
  console.log(`   images d'univers chargées : ${[...images].join(', ')}`);
  await browser.close();
}

await run('phone', { width: 390, height: 844 }, true);
await run('desktop', { width: 1440, height: 900 }, false);
console.log(failures.length === 0 ? '\nTout est vert.' : `\n${failures.length} échec(s) : ${failures.join(' ; ')}`);
process.exit(failures.length === 0 ? 0 : 1);
