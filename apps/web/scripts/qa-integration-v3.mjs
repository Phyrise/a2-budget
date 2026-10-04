/**
 * QA visuelle d'intégration V3 : le parcours réel à 390×844, forêt vivante
 * (WebGL), état réaliste construit par @a2/core (effort, tour à tour,
 * souple, faits de la semaine, coup de main, « pas aujourd'hui », cercle de
 * la semaine passée, lanternes). Maison, menu ⋯, corvée, équilibre, rituels,
 * cercle, lanterne en cours puis fermée, carnet, automne.
 *
 * Usage :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5185 --strictPort --host 127.0.0.1 &
 *   node apps/web/scripts/qa-integration-v3.mjs [port]
 * Options : GL=swift (SwiftShader au lieu de Metal), ONLY=<préfixe>.
 * Sorties (gitignorées) : apps/web/qa/integration-v3/*.png + planche-*.jpg
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { seedState } from './qa-integration-v3.seed.mjs';

const port = Number(process.argv[2] ?? 5185);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'integration-v3');
mkdirSync(outDir, { recursive: true });
const APP = `http://127.0.0.1:${port}/a2-budget/`;
const only = process.env.ONLY ?? '';

const args =
  process.env.GL === 'swift'
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'];
const browser = await chromium.launch({ args });
const errors = [];
const shots = [];

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

async function open(vp = MOBILE) {
  const context = await browser.newContext({ ...vp, locale: 'fr-FR' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${APP}?module=maison`);
  const r = await page.evaluate(seedState, { entry: coreEntry });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(2500);
  return { context, page, seed: r };
}

async function shot(page, name, wait = 500) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  shots.push(name);
  console.log('capture', name);
}

const world = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.app-world canvas');
    const r = c?.getBoundingClientRect();
    return { canvas: Boolean(c), h: r ? Math.round(r.height) : 0, top: r ? Math.round(r.top) : 0, opacity: c ? getComputedStyle(c).opacity : null };
  });

async function step(name, fn, vp) {
  if (only && !name.startsWith(only)) return;
  const { context, page, seed } = await open(vp);
  console.log(name, 'stade', seed.stage, 'créatures', seed.creatures.join(','));
  try {
    await fn(page);
  } catch (e) {
    errors.push(`${name}: ${e.message.split('\n')[0]}`);
    console.log('ÉCHEC', name, e.message.split('\n')[0]);
    await page.screenshot({ path: join(outDir, `${name}-echec.png`) }).catch(() => {});
  }
  await context.close();
}

const toTop = (page, y = 0) => page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);

await step('a', async (page) => {
  await shot(page, 'a1-maison-haut', 1500);
  console.log('  monde', JSON.stringify(await world(page)));
  await toTop(page, 360);
  await shot(page, 'a2-liste');
  await page.getByRole('button', { name: /^Options : Vider le lave-vaisselle/ }).click();
  await shot(page, 'a3-menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // Corvée : célébration forte + bulle.
  await page.getByRole('checkbox', { name: 'Nettoyer la salle de bain', exact: true }).click();
  await shot(page, 'a4-corvee', 700);
  await toTop(page, 0);
  await shot(page, 'a5-apres-corvee-haut', 600);
});

await step('b', async (page) => {
  const balance = page.locator('.balance').first();
  await balance.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  await shot(page, 'b1-equilibre');
  const bar = page.locator('section.rituals');
  await bar.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  await shot(page, 'b2-rituels');
  // Bas de page : ordre des sections et pied.
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await shot(page, 'b3-bas');
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.screen-sheet h2, .screen-sheet h3')].map((h) => h.textContent?.trim()).filter(Boolean),
  );
  console.log('  sections', order.join(' | '));
});

await step('c', async (page) => {
  const bar = page.locator('section.rituals');
  await bar.scrollIntoViewIfNeeded();
  await bar.getByRole('button', { name: /Cercle de la semaine/ }).first().click();
  const circle = page.getByRole('dialog', { name: 'Cercle de la semaine' });
  await circle.waitFor();
  await circle.locator('.ritual-chip').first().click();
  await shot(page, 'c1-cercle-merci');
  await circle.getByRole('button', { name: 'Continuer' }).click();
  await circle.getByRole('button', { name: 'Continuer' }).click();
  await shot(page, 'c2-cercle-ajuster');
  await circle.getByRole('button', { name: 'Clore le cercle' }).click();
  await shot(page, 'c3-cercle-clos');
  await circle.getByRole('button', { name: 'Retourner dans la forêt' }).click();
  await shot(page, 'c4-apres-cercle', 1800);
});

await step('d', async (page) => {
  const bar = page.locator('section.rituals');
  await bar.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await bar.getByRole('button', { name: /lanterne/i }).click();
  const setup = page.getByRole('dialog', { name: 'Allumer une lanterne' });
  await setup.waitFor();
  await shot(page, 'd1-lanterne-preparer', 900);
  await setup.getByRole('button', { name: 'Allumer la lanterne' }).click();
  const running = page.getByRole('dialog', { name: 'Lanterne allumée', exact: true });
  await running.waitFor();
  await shot(page, 'd2-lanterne-en-cours', 6000);
  console.log('  monde', JSON.stringify(await world(page)));
  // Fermer la feuille : la lanterne continue, la page revient.
  await running.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await running.waitFor({ state: 'hidden' });
  await shot(page, 'd3-lanterne-fermee', 900);
  console.log('  scrollY', await page.evaluate(() => Math.round(window.scrollY)));
  await toTop(page, 0);
  await shot(page, 'd4-lanterne-haut', 1200);
});

await step('e', async (page) => {
  const bar = page.locator('section.rituals');
  await bar.scrollIntoViewIfNeeded();
  await bar.getByRole('button', { name: 'Carnet de la forêt' }).click();
  const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
  await carnet.waitFor();
  await shot(page, 'e1-carnet', 800);
  await carnet.locator('.sheet__body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot(page, 'e2-carnet-fin');
});

await step(
  'f',
  async (page) => {
    await page.getByRole('checkbox', { name: 'Nettoyer la salle de bain', exact: true }).click();
    await shot(page, 'f1-bureau-corvee', 700);
    await page.locator('section.rituals').getByRole('button', { name: /lanterne/i }).click();
    await page.getByRole('dialog', { name: 'Allumer une lanterne' }).getByRole('button', { name: 'Allumer la lanterne' }).click();
    await shot(page, 'f2-bureau-lanterne', 5000);
  },
  DESKTOP,
);

// Planches réduites (2 × n, 360 px de large par capture).
async function sheet(name, list) {
  if (!list.length) return;
  const page = await browser.newPage({ viewport: { width: 760, height: 800 }, deviceScaleFactor: 1 });
  const imgs = list.map((n) => `data:image/png;base64,${readFileSync(join(outDir, `${n}.png`)).toString('base64')}`);
  await page.setContent(
    `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(2,370px);gap:6px;padding:6px;font:12px sans-serif;color:#eee">${imgs
      .map((src, i) => `<figure style="margin:0"><img src="${src}" style="width:370px;display:block"><figcaption>${list[i]}</figcaption></figure>`)
      .join('')}</body>`,
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `planche-${name}.jpg`), type: 'jpeg', quality: 70, fullPage: true });
  await page.close();
}
for (let i = 0; i < shots.length; i += 4) await sheet(String(i / 4 + 1), shots.slice(i, i + 4));

await browser.close();
console.log(errors.length ? `ERREURS :\n${errors.join('\n')}` : 'Aucune erreur de page.');
