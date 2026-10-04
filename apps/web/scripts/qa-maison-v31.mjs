/**
 * QA visuelle Maison V3.1 (agent UI-MAISON) : « À venir » replié puis déplié
 * avec dix tâches le même jour (« +7 autres »), édition depuis « À venir »,
 * carte « Le partage de la semaine » et son « Comment ça marche ? », carte
 * lanterne et explication en trois gestes, absence du bouton de pause en bas.
 * 390 × 844, état injecté (fixtures @a2/core, validateAppState).
 *
 * Usage (serveur de dev lancé sur le port) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5182 --strictPort &
 *   node apps/web/scripts/qa-maison-v31.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/maison-v31/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5182);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'maison-v31');
mkdirSync(outDir, { recursive: true });

const BASE = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="../../scripts/qa-maison-v31.fixtures.ts"></script></body></html>\n`,
);

const browser = await chromium.launch();
const errors = [];
const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok });
  console.log(ok ? 'ok  ' : 'FAIL', label, detail);
};

async function getFixtures() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
  await page.goto(`${BASE}qa/maison-v31/fixtures.html`);
  await page.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
  const fx = await page.evaluate(() => window.__fixtures);
  await page.close();
  return fx;
}

const fixtures = await getFixtures();
const VP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(state) {
  const context = await browser.newContext({ ...VP, locale: 'fr-FR' });
  await context.addInitScript(
    ([key, uiKey, value]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(uiKey, JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    },
    [KEY, UI_KEY, state],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(BASE);
  await page.waitForSelector('.screen-sheet');
  await page.waitForTimeout(900);
  return { context, page };
}

async function shot(page, name, target = null) {
  const path = join(outDir, `${name}.png`);
  if (target) await page.locator(target).first().screenshot({ path });
  else await page.screenshot({ path });
  console.log('shot', name);
}

async function scenario(name, fn) {
  if (filter && !name.includes(filter)) return;
  const { context, page } = await open(fixtures.busy);
  try {
    await fn(page);
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    console.log('FAIL', name, e.message);
  }
  await context.close();
}

const scrollTo = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'instant' });
  }, selector);

await scenario('upcoming', async (page) => {
  const fold = page.locator('.upcoming-fold');
  await scrollTo(page, '.upcoming-section');
  await page.waitForTimeout(300);
  const toggle = fold.locator('.disclosure__toggle');
  check('À venir replié par défaut', (await toggle.getAttribute('aria-expanded')) === 'false');
  check('aperçu « Demain : … »', /Demain\s*:/.test(await toggle.innerText()), await toggle.innerText());
  check('compte « Cette semaine · N tâches »', /Cette semaine · \d+\s*tâches/.test(await page.locator('.upcoming-section .section-head__meta').innerText()));
  check('pas de bouton de pause en bas', (await page.locator('.screen-sheet').getByRole('button', { name: 'Mettre la maison en pause' }).count()) === 0);
  await shot(page, 'upcoming-closed');
  await toggle.click();
  await page.waitForTimeout(500);
  await shot(page, 'upcoming-open');
  const busyDay = page.locator('.upcoming__day').filter({ has: page.locator('.upcoming__more') }).first();
  check('jour chargé : 3 tâches + « +7 autres »', (await busyDay.locator('.upcoming__item').count()) === 3 && /\+7/.test(await busyDay.locator('.upcoming__more').innerText()));
  await busyDay.scrollIntoViewIfNeeded();
  await shot(page, 'upcoming-busy-day', '.upcoming-fold');
  await busyDay.locator('.upcoming__more').click();
  await page.waitForTimeout(300);
  check('jour chargé déplié : 10 tâches', (await busyDay.locator('.upcoming__item').count()) === 10);
  await shot(page, 'upcoming-busy-expanded', '.upcoming-fold');

  // Toucher une tâche à venir → édition → suppression confirmée.
  await busyDay.getByRole('button', { name: /Modifier « Vider le frigo »/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier la tâche', exact: true });
  await dialog.waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'upcoming-edit');
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForTimeout(350);
  await shot(page, 'upcoming-delete-confirm');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForTimeout(700);
  check('tâche supprimée de « À venir »', (await page.locator('.upcoming__item').filter({ hasText: 'Vider le frigo' }).count()) === 0);
  await shot(page, 'upcoming-after-delete');
});

await scenario('balance', async (page) => {
  await scrollTo(page, '.balance');
  await page.waitForTimeout(1900);
  await shot(page, 'balance', '.balance');
  await page.locator('.balance').getByRole('button', { name: /Comment ça marche/ }).click();
  await page.waitForTimeout(500);
  await shot(page, 'balance-how', '.balance');
  check('partage : aucun chiffre', !/\d/.test(await page.locator('.balance').innerText()));
});

await scenario('lantern', async (page) => {
  await scrollTo(page, '.rituals');
  await page.waitForTimeout(300);
  await shot(page, 'rituals', '.rituals');
  await page.locator('.ritual-card--lantern').click();
  await page.waitForTimeout(900);
  await shot(page, 'lantern-intro');
  await page.getByRole('button', { name: 'Choisir une durée' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'lantern-setup');
  check('bouton « Lancer 10 minutes »', (await page.getByRole('button', { name: /Lancer 10\s*minutes/ }).count()) === 1);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('.ritual-card--lantern').click();
  await page.waitForTimeout(700);
  check('explication non remontrée dans la session', (await page.locator('.lantern-intro').count()) === 0);
});

await browser.close();
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications`);
if (errors.length) console.log('Erreurs :\n' + errors.join('\n'));
process.exit(failed.length || errors.length ? 1 : 0);
