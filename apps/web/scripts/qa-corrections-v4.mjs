/**
 * QA corrections V4, 390 × 844, état injecté (fixtures @a2/core de
 * qa-maison-v4, validateAppState) :
 * - envol de la luciole depuis le menu ⋯ : tant que la feuille est ouverte,
 *   la lumière n'existe pas à son ancre (moteur DEV `window.__worldEngine`) ;
 *   elle n'apparaît qu'en vol, depuis la case ;
 * - budget : mois passé consulté (aucun mois écrit, pas de recalage),
 *   invitation douce tant que le solde n'a jamais été recalé.
 *
 * Usage (depuis la racine du dépôt, serveur de dev lancé sur le port) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5187 --strictPort &
 *   node apps/web/scripts/qa-corrections-v4.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/corrections-v4/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5187);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'corrections-v4');
mkdirSync(outDir, { recursive: true });

const BASE = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="../../scripts/qa-maison-v4.fixtures.ts"></script></body></html>\n`,
);

const browser = await chromium.launch();
const errors = [];
const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok });
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(detail));
};

const fxPage = await browser.newPage();
fxPage.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
await fxPage.goto(`${BASE}qa/corrections-v4/fixtures.html`);
await fxPage.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
const fixtures = await fxPage.evaluate(() => window.__fixtures);
await fxPage.close();

const VP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(state, module) {
  const context = await browser.newContext({ ...VP, locale: 'fr-FR' });
  await context.addInitScript(
    ([key, uiKey, value, mod]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      if (value !== null) localStorage.setItem(key, value);
      localStorage.setItem(
        uiKey,
        JSON.stringify({ module: mod, forestMotion: 'full', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true }),
      );
    },
    [KEY, UI_KEY, state, module],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${BASE}?module=${module}`);
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(1800);
  return { page, context };
}

const persisted = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);

// --- 1. Luciole depuis le menu ⋯ : pas de lumière posée avant l'envol ------
{
  const { page, context } = await open(fixtures.home, 'maison');
  const ready = await page.evaluate(() => window.__worldEngine !== undefined);
  check('moteur de la forêt disponible (DEV)', ready);
  await page.getByRole('button', { name: /Options : Tourner les plantes/ }).click();
  const menu = page.getByRole('dialog', { name: 'Tourner les plantes', exact: true });
  await menu.waitFor();
  await page.evaluate(() => {
    // Échantillonne la lumière de la nouvelle complétion à chaque image.
    const w = window;
    w.__lightSamples = [];
    const known = new Set([...w.__worldEngine.lights.lights.keys()]);
    const t0 = performance.now();
    const tick = () => {
      const map = w.__worldEngine.lights.lights;
      for (const [id, l] of map) {
        if (known.has(id)) continue;
        w.__lightSamples.push({ t: performance.now() - t0, id, flying: l.flight !== null, dialogOpen: document.querySelector('dialog[open]') !== null });
      }
      if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await menu.getByRole('button', { name: /AL l’a fait/ }).click();
  await page.waitForTimeout(2600);
  const samples = await page.evaluate(() => window.__lightSamples);
  const first = samples[0];
  check('la nouvelle lumière apparaît (en vol)', first !== undefined && first.flying, first);
  check('aucune image avec la lumière posée à son ancre avant l’envol', samples.every((s, i) => i > 0 || s.flying), samples.slice(0, 3));
  check('aucune lumière tant que la feuille est ouverte', samples.every((s) => !s.dialogOpen), samples.filter((s) => s.dialogOpen).slice(0, 3));
  await page.screenshot({ path: join(outDir, '01-maison-apres-envol.png') });
  await context.close();
}

// --- 2. Budget : mois passé consulté, invitation à recaler -----------------
{
  const { page, context } = await open(null, 'budget');
  await page.getByTestId('balance-card').scrollIntoViewIfNeeded();
  const hint = await page.getByTestId('balance-unconfirmed').textContent();
  check('invitation douce visible (jamais recalé)', /recalez quand vous regardez le vrai compte/.test(hint ?? ''), hint);
  check('insécable avant « : »', (hint ?? '').includes(' :'), hint);
  await page.screenshot({ path: join(outDir, '02-budget-courant.png') });
  const before = (await persisted(page)).budget.months.length;
  await page.getByRole('button', { name: 'Mois précédent', exact: true }).click();
  await page.getByRole('button', { name: 'Mois précédent', exact: true }).click();
  await page.waitForTimeout(400);
  const after = (await persisted(page)).budget.months.length;
  check('consulter deux mois passés n’écrit aucun mois', after === before, { before, after });
  check('mois passé : pas de « Recaler sur le compte »', (await page.getByRole('button', { name: 'Recaler sur le compte' }).count()) === 0);
  const caption = await page.getByTestId('balance-caption').textContent();
  check('mois passé : « estimé à la fin de … »', /^estimé à la fin de /.test(caption ?? ''), caption);
  await page.getByTestId('balance-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(outDir, '03-budget-mois-passe.png') });
  await context.close();
}

await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} vérifications ; erreurs de page : ${errors.length}`);
for (const e of errors) console.log('  ', e);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
