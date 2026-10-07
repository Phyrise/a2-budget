/**
 * QA d'intégration V4.1 (main, les quatre branches fusionnées), 390 × 844,
 * téléphone tactile, dans la vraie application (état construit avec @a2/core) :
 * Maison (lanterne de pierre intégrée, éteinte puis allumée ; Nouvelle tâche
 * sans défilement, sans focus automatique, « Une fois » par défaut ; objectif
 * et partage allégés), Budget (aucun curseur, revenus avant le bloc unique
 * « Ce mois-ci », phrase supprimée absente), coins arrondis des quatre
 * onglets (même luminosité que le bandeau), Calendrier (Chatbus au galop).
 *
 * Usage (depuis la racine du dépôt, serveur de dev lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5186 --strictPort &
 *   node apps/web/scripts/qa-integration-v41.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/integration-v41/*.png, planche.jpg
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { seedIntegrationState } from './qa-integration-v4.seed.mjs';

const port = Number(process.argv[2] ?? 5186);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'integration-v41');
mkdirSync(outDir, { recursive: true });
const APP = `http://127.0.0.1:${port}/a2-budget/`;

const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok: Boolean(ok) });
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(detail));
};
const errors = [];
const shots = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`page: ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await page.goto(`${APP}?module=maison`);
const seeded = await page.evaluate(seedIntegrationState, { entry: coreEntry });
if (!seeded.ok) throw new Error(`État invalide : ${seeded.reason}`);
await page.reload();
await page.locator('.screen-sheet').waitFor();
await page.waitForFunction(() => window.__worldEngine?.stone?.model, undefined, { timeout: 20_000 });
await page.waitForTimeout(1500);

const shot = async (name, clip) => {
  await page.screenshot({ path: join(outDir, `${name}.png`), ...(clip ? { clip } : {}) });
  shots.push(`${name}.png`);
};
const nav = async (id) => {
  await page.locator(`.app-nav__item--${id}`).click();
  await page.waitForTimeout(1200);
};
const FOREST = { x: 0, y: 0, width: 390, height: 520 };

/** Luminosité moyenne d'un petit carré (capture → canvas). */
async function lumaAt(x, y) {
  const buf = await page.screenshot({ clip: { x, y, width: 4, height: 4 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = new OffscreenCanvas(4, 4);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 4, 4).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return s / 16;
  }, buf.toString('base64'));
}
async function corners(tab) {
  const r = await page.locator('.screen-sheet').first().boundingBox();
  const out = [];
  for (const x of [r.x + 2, r.x + r.width - 6]) {
    const corner = await lumaAt(x, r.y + 1);
    const above = await lumaAt(x, r.y - 8);
    out.push(Math.abs(corner - above));
  }
  check(`${tab} : coins arrondis au voile du bandeau (Δ ${out.map((d) => d.toFixed(1)).join(' / ')})`, out.every((d) => d < 12), out);
  await shot(`coins-${tab}`, { x: 0, y: Math.max(0, r.y - 60), width: 390, height: 120 });
}

// --- 1. Maison : lanterne intégrée, éteinte puis allumée ----------------------
{
  const e = await page.evaluate(() => {
    const w = window.__worldEngine;
    return { model: w.stone.model?.id ?? null, lit: w.lantern.active };
  });
  check('Maison : lanterne de pierre posée, éteinte', e.model && !e.lit, e);
  await shot('01-maison-lanterne-eteinte', FOREST);
  await corners('maison');

  await page.getByRole('button', { name: /Options : Ranger le bureau/ }).click();
  const menu = page.getByRole('dialog', { name: 'Ranger le bureau', exact: true });
  await menu.getByRole('button', { name: '5 minutes', exact: true }).click();
  await menu.getByRole('button', { name: /Allumer une lanterne de 5 minutes/ }).click();
  await page.waitForTimeout(2800);
  const lit = await page.evaluate(() => window.__worldEngine.lantern.active);
  check('Maison : la lanterne s’allume dans la forêt', lit);
  await shot('02-maison-lanterne-allumee', FOREST);
  await page.locator('.lantern-bar').getByRole('button', { name: 'Arrêter la lanterne' }).click();
  await page.waitForTimeout(1500);

  const goal = await page.locator('.weekly-goal').innerText();
  const blocks = goal.split('\n').map((s) => s.trim()).filter(Boolean);
  check(`Maison : objectif en ≤ 3 blocs (${blocks.length})`, blocks.length <= 3, blocks);
  check('Maison : plus de « la lumière monte » ni « elle n’attend que vous »', !/lumière monte|n.attend que vous/i.test(goal), goal);
}

// --- 2. Maison : Nouvelle tâche ------------------------------------------------
{
  await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' });
  await dialog.waitFor();
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const panel = document.querySelector('.task-sheet .sheet__panel').getBoundingClientRect();
    const body = document.querySelector('.task-sheet .sheet__body');
    return { bottom: Math.round(panel.bottom), vh: innerHeight, scroll: body.scrollHeight - body.clientHeight, tag: document.activeElement?.tagName };
  });
  check('Nouvelle tâche : tient entière à 390 × 844', m.scroll <= 0 && m.bottom <= m.vh, m);
  check('Nouvelle tâche : pas de focus dans un champ (pas de clavier)', m.tag !== 'INPUT' && m.tag !== 'TEXTAREA', m);
  check('Nouvelle tâche : « Une fois » par défaut', await dialog.locator('#task-recurrence-none').isChecked());
  await shot('03-nouvelle-tache');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// --- 3. Budget -----------------------------------------------------------------
{
  await nav('budget');
  const text = await page.locator('.screen-sheet').innerText();
  check('Budget : plus de « souvent payés le mois suivant »', !/mois suivant/i.test(text));
  check('Budget : aucun curseur', (await page.locator('.screen-sheet input[type=range]').count()) === 0);
  const titles = await page.locator('.screen-sheet .section-title').allInnerTexts();
  const iRev = titles.findIndex((t) => /Revenus/.test(t));
  const iMonth = titles.findIndex((t) => /Ce mois-ci/.test(t));
  check('Budget : revenus au-dessus du bloc « Ce mois-ci »', iRev >= 0 && iMonth > iRev, titles);
  check('Budget : un seul bloc (plus de « Dépenses communes » ni « À payer »)', !titles.some((t) => /Dépenses communes|À payer/.test(t)), titles);
  await shot('04-budget');
  await corners('budget');
}

// --- 4. Courses, Calendrier ----------------------------------------------------
await nav('courses');
await corners('courses');
await nav('calendar');
await corners('calendar');
{
  // Chatbus : traversée régulière (échantillonnée au rAF).
  const add = page.getByRole('button', { name: /Ajouter/ }).first();
  const bus = page.locator('.cal-catbus');
  if ((await bus.count()) === 0 && (await add.count())) {
    // Le Chatbus passe à l'ouverture du Calendrier ; on revient pour le relancer.
    await nav('maison');
    await nav('calendar');
  }
  const seen = await page.waitForSelector('.cal-catbus__track', { timeout: 4000 }).then(() => true, () => false);
  if (seen) {
    const xs = await page.evaluate(
      () =>
        new Promise((done) => {
          const out = [];
          const t0 = performance.now();
          const loop = () => {
            const el = document.querySelector('.cal-catbus__track');
            if (el) out.push(el.getBoundingClientRect().left);
            if (el && performance.now() - t0 < 900) requestAnimationFrame(loop);
            else done(out);
          };
          requestAnimationFrame(loop);
        }),
    );
    const back = xs.slice(1).filter((x, i) => x > xs[i] + 0.5).length;
    check(`Calendrier : Chatbus sans recul (${xs.length} échantillons)`, xs.length > 10 && back === 0, { n: xs.length, back });
  } else {
    console.log('info Calendrier : Chatbus non déclenché ici (couvert par qa-coquille-v41 et l’e2e)');
  }
}

check('aucune erreur console', errors.length === 0, errors);

// Planche réduite.
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(4,390px);gap:6px;padding:6px">${shots
  .map((s) => `<img src="file://${join(outDir, s)}" style="width:390px;height:auto;align-self:start">`)
  .join('')}</body>`;
writeFileSync(join(outDir, 'planche.html'), html);
const board = await browser.newPage({ viewport: { width: 1590, height: 900 } });
await board.goto(`file://${join(outDir, 'planche.html')}`);
await board.waitForTimeout(400);
await board.screenshot({ path: join(outDir, 'planche.png'), fullPage: true });
await browser.close();
try {
  execFileSync('sips', ['-Z', '1400', '-s', 'format', 'jpeg', join(outDir, 'planche.png'), '--out', join(outDir, 'planche.jpg')], { stdio: 'ignore' });
} catch {
  // sips absent : la planche PNG suffit.
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications ok`);
process.exit(failed.length === 0 ? 0 : 1);
