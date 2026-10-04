/**
 * QA visuelle Maison V3 (agent UI-MAISON) : liste avec tour à tour / corvée /
 * souple, menu ⋯, bulle, carte « Équilibre » (calme, équilibré, déséquilibré),
 * feuille d'une tâche. 390 × 844, état injecté (fixtures @a2/core).
 *
 * Usage (serveur de dev lancé sur le port) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5181 --strictPort &
 *   node apps/web/scripts/qa-maison-v3.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/maison-v3/*.png + planches *.jpg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5181);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'maison-v3');
mkdirSync(outDir, { recursive: true });

const BASE = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="../../scripts/qa-maison-v3.fixtures.ts"></script></body></html>\n`,
);

const browser = await chromium.launch();
const errors = [];

async function getFixtures() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`fixtures console: ${m.text()}`));
  await page.goto(`${BASE}qa/maison-v3/fixtures.html`);
  try {
    await page.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 20_000 });
  } catch (e) {
    console.log(errors.join('\n'));
    throw e;
  }
  const fx = await page.evaluate(() => window.__fixtures);
  await page.close();
  return fx;
}

const fixtures = await getFixtures();
const VP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(state, { reduced = false, desktop = false } = {}) {
  const context = await browser.newContext({ ...(desktop ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : VP), locale: 'fr-FR', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(
    ([key, uiKey, value]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
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

const shots = [];
async function shot(page, name, target = null) {
  const path = join(outDir, `${name}.png`);
  if (target) await page.locator(target).first().screenshot({ path });
  else await page.screenshot({ path });
  shots.push(name);
  console.log('shot', name);
}

async function scenario(name, state, fn, opts) {
  if (filter && !name.includes(filter)) return;
  const { context, page } = await open(state, opts);
  try {
    await fn(page);
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    console.log('FAIL', name, e.message);
  }
  await context.close();
}

const scrollSheet = (page, y) => page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);

await scenario('list', fixtures.carried, async (page) => {
  await scrollSheet(page, 330);
  await page.waitForTimeout(300);
  await shot(page, 'list');
  await shot(page, 'list-rows', '.task-list');
});

await scenario('menu', fixtures.carried, async (page) => {
  await scrollSheet(page, 330);
  await page.getByRole('button', { name: 'Options : Vider le lave-vaisselle' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'menu-rotation');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Options : Courses du marché' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'menu-both');
});

await scenario('bubble', fixtures.carried, async (page) => {
  await page.getByRole('checkbox', { name: 'Courses du marché', exact: true }).click();
  await page.waitForTimeout(700);
  await shot(page, 'bubble-perch');
  await page.waitForTimeout(3500);
  // Compagnons hors de vue : la bulle flotte au-dessus de la navigation.
  await page.getByRole('button', { name: 'Mettre la maison en pause' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Mettre la maison en pause' }).click();
  await page.waitForTimeout(700);
  await shot(page, 'bubble-floating');
});

await scenario('perch-scrolled', fixtures.carried, async (page) => {
  await scrollSheet(page, 330);
  await page.waitForTimeout(300);
  await page.getByRole('checkbox', { name: 'Vider le lave-vaisselle', exact: true }).click();
  await page.waitForTimeout(700);
  await shot(page, 'perch-scrolled');
});

await scenario('chore', fixtures.carried, async (page) => {
  await scrollSheet(page, 330);
  await page.getByRole('checkbox', { name: 'Nettoyer la salle de bain', exact: true }).click();
  await page.waitForTimeout(420);
  await shot(page, 'chore-celebrate');
});

await scenario('skip', fixtures.carried, async (page) => {
  await scrollSheet(page, 330);
  await page.getByRole('button', { name: 'Options : Sortir les poubelles' }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: /Pas aujourd’hui/ }).click();
  await page.waitForTimeout(700);
  await shot(page, 'skip-toast');
});

for (const mode of ['carried', 'balanced', 'quiet']) {
  await scenario(`balance-${mode}`, fixtures[mode], async (page) => {
    await page.locator('.balance').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1900);
    await shot(page, `balance-${mode}`, '.balance');
    await shot(page, `balance-art-${mode}`, '.balance__visual');
    if (mode === 'balanced') {
      await page.getByRole('button', { name: 'Les gestes de la semaine' }).click();
      await page.waitForTimeout(500);
      await shot(page, 'balance-detail', '.balance');
    }
  });
}

await scenario(
  'desktop',
  fixtures.carried,
  async (page) => {
    await page.getByRole('checkbox', { name: 'Courses du marché', exact: true }).click();
    await page.waitForTimeout(700);
    await shot(page, 'desktop-bubble');
  },
  { desktop: true },
);

await scenario(
  'reduced',
  fixtures.carried,
  async (page) => {
    await page.getByRole('checkbox', { name: 'Nettoyer la salle de bain', exact: true }).click();
    await page.waitForTimeout(400);
    await shot(page, 'reduced-chore');
  },
  { reduced: true },
);

await scenario('sheet', fixtures.carried, async (page) => {
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click();
  await page.waitForTimeout(450);
  await page.locator('#task-title').fill('Détartrer la bouilloire');
  await page.locator('#task-who-b').check();
  await page.getByRole('switch', { name: 'Tour à tour' }).click();
  await page.locator('#task-effort-3').check();
  await page.locator('#task-weekmode-flexible').check();
  await page.waitForTimeout(250);
  await shot(page, 'sheet-new');
  await page.locator('.task-sheet .sheet__body').evaluate((el) => el.scrollTo(0, 9999));
  await page.locator('.task-sheet .sheet__panel').evaluate((el) => el.scrollTo(0, 9999));
  await page.waitForTimeout(250);
  await shot(page, 'sheet-new-bottom');
});

// Planches (2 téléphones par image, JPEG léger) pour une revue rapide.
const plates = [
  ['list', 'menu-rotation'],
  ['menu-both', 'bubble-perch'],
  ['bubble-floating', 'chore-celebrate'],
  ['skip-toast', 'sheet-new'],
  ['balance-carried', 'balance-balanced', 'balance-quiet'],
  ['perch-scrolled', 'sheet-new-bottom'],
  ['balance-art-carried', 'balance-art-balanced', 'balance-art-quiet'],
  ['bubble-perch', 'balance-detail'],
  ['desktop-bubble'],
];
const page = await browser.newPage({ viewport: { width: 720, height: 800 } });
for (const [i, group] of plates.entries()) {
  const present = group.filter((n) => shots.includes(n));
  if (present.length === 0) continue;
  const imgs = present.map((n) => `<figure><img src="${pathToFileURL(join(outDir, `${n}.png`)).href}"><figcaption>${n}</figcaption></figure>`).join('');
  const html = `<html><body style="margin:0;background:#222;display:flex;flex-direction:${group[0].startsWith("balance-art") ? "column" : "row"};gap:8px;padding:8px;align-items:stretch;font:12px sans-serif;color:#ccc">${imgs}
  <style>figure{margin:0;flex:1;min-width:0}img{width:100%;display:block}</style></body></html>`;
  const file = join(outDir, `plate-${i + 1}.html`);
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, `plate-${i + 1}.jpg`), type: 'jpeg', quality: 72, fullPage: true });
}
await browser.close();

if (errors.length) {
  console.log('\nERREURS :\n' + errors.join('\n'));
  process.exitCode = 1;
} else console.log('\nOK, aucune erreur de page.');
