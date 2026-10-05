/**
 * QA des corrections des saisons (serveur de dev), en hiver simulé, téléphone :
 * 1. peintures d'hiver de la forêt bloquées : le moteur démarre sur la base
 *    (canvas visible), puis peint l'hiver une fois le réseau revenu ;
 * 2. LUT nuit d'hiver bloquée, forêt en pause : la scène s'assombrit quand
 *    même (nuit de base ou nuit procédurale), jamais « plein jour » ;
 * 3. nombre de requêtes réseau de la peinture d'hiver du stade 1 (info).
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5187 --strictPort &
 *   node apps/web/scripts/qa-corrections-saisons.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/corrections-saisons/*.png
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const coreDir = dirname(require.resolve('playwright-core/package.json', { paths: [require.resolve('@playwright/test')] }));
const { PNG } = require(join(coreDir, 'lib/utilsBundle'));

const port = Number(process.argv[2] ?? 5187);
const base = `http://127.0.0.1:${port}/a2-budget/`;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'corrections-saisons');
mkdirSync(outDir, { recursive: true });
const VIEW = { width: 390, height: 844 };
const WINTER = '2027-01-15T10:00:00';
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`);

function luminance(buf) {
  const png = PNG.sync.read(buf);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4 * 7) {
    sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    n++;
  }
  return sum / n;
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await context.addInitScript(
    `(() => { const T = new Date(${JSON.stringify(WINTER)}).getTime(); const D = Date; const off = T - D.now(); globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } }; })();`,
  );
  await context.addInitScript(() => localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ devMode: true })));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, errors };
}

const canvasShown = (page, timeout) =>
  page
    .waitForFunction(() => [...document.querySelectorAll('.living-forest canvas')].some((c) => getComputedStyle(c).opacity === '1'), null, { timeout })
    .then(() => true)
    .catch(() => false);

async function devSet(page, legend, label) {
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = page.getByRole('dialog', { name: 'Mode développeur' });
  await dev.locator('fieldset', { has: page.locator('legend', { hasText: new RegExp(`^${legend}$`) }) }).getByRole('button', { name: label, exact: true }).click();
  await page.keyboard.press('Escape');
  await dev.waitFor({ state: 'hidden' });
}

const browser = await chromium.launch();
try {
  // 1. Peintures d'hiver bloquées → base, puis hiver au retour.
  {
    const { context, page, errors } = await newPage(browser);
    let blocked = true;
    const hits = [];
    await context.route(/season-winter-stage-\d[^/]*\.webp(?:\?.*)?$/, (route) => {
      if (route.request().resourceType() === 'script' || route.request().url().includes('?import')) return route.fallback();
      hits.push(route.request().url());
      return blocked ? route.abort() : route.fallback();
    });
    await page.goto(`${base}?module=maison`);
    const shown = await canvasShown(page, 20_000);
    check('peinture d’hiver indisponible : forêt vivante sur la base', shown);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(outDir, '1-base-de-repli.png'), clip: { x: 0, y: 0, width: VIEW.width, height: 420 } });
    const before = hits.length;
    blocked = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: join(outDir, '2-hiver-au-retour.png'), clip: { x: 0, y: 0, width: VIEW.width, height: 420 } });
    check('retour du réseau : la peinture d’hiver est redemandée', hits.length > before, `${before} → ${hits.length} requêtes`);
    check('aucune erreur de page', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // 2. Nuit d'hiver bloquée, pause → scène assombrie ; 3. requêtes du stade 1.
  {
    const { context, page, errors } = await newPage(browser);
    const stage1 = [];
    page.on('request', (r) => {
      if (/season-winter-stage-1[^/]*\.webp$/.test(new URL(r.url()).pathname) && r.resourceType() !== 'script') stage1.push(r.url());
    });
    await context.route(/season-winter-lut-night[^/]*\.png(?:\?.*)?$/, (route) =>
      route.request().url().includes('?import') ? route.fallback() : route.abort(),
    );
    await page.goto(`${base}?module=maison`);
    await canvasShown(page, 20_000);
    await page.waitForTimeout(3500);
    const clip = { x: 0, y: 0, width: VIEW.width, height: 300 };
    const day = luminance(await page.screenshot({ clip }));
    await devSet(page, 'Pause', 'Endormie');
    await page.waitForTimeout(4500);
    const night = luminance(await page.screenshot({ clip }));
    await page.screenshot({ path: join(outDir, '3-pause-nuit-de-repli.png'), clip: { x: 0, y: 0, width: VIEW.width, height: 420 } });
    check('pause sans LUT nuit d’hiver : la scène s’assombrit', night < day * 0.7, `jour ${day.toFixed(1)} → pause ${night.toFixed(1)}`);
    check('peinture d’hiver du stade 1 : requêtes de la page (info)', true, `${stage1.length}`);
    check('aucune erreur de page (pause)', errors.length === 0, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
