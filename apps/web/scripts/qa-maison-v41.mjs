/**
 * QA Maison V4.1 (agent MAISON), état injecté (fixtures @a2/core de la QA V4,
 * validées par validateAppState) :
 * - feuille « Nouvelle tâche » : tient en entier sans défiler à 390 × 844 et
 *   375 × 667, y compris dans le cas le plus haut (une personne + tour à
 *   tour + chaque semaine + jours) ; pas de focus dans le champ titre à
 *   l'ouverture (le clavier ne s'ouvre pas) ; « Une fois » par défaut ;
 * - cartes « Objectif de la semaine » (3 blocs de texte au plus) et
 *   « Le partage de la semaine » allégées.
 *
 * Usage (depuis la racine du worktree, serveur de dev lancé sur le port) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5182 --strictPort &
 *   node apps/web/scripts/qa-maison-v41.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/maison-v41/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5182);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'maison-v41');
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
let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(detail));
};

const fxPage = await browser.newPage();
fxPage.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
await fxPage.goto(`${BASE}qa/maison-v41/fixtures.html`);
await fxPage.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
const fixtures = await fxPage.evaluate(() => window.__fixtures);
await fxPage.close();

async function open(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  await context.addInitScript(
    ([key, uiKey, value]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(
        uiKey,
        JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true }),
      );
    },
    [KEY, UI_KEY, fixtures.home],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${BASE}?module=maison`);
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(1200);
  return { page, context };
}

/** Mesure la feuille : tout tient-il dans la fenêtre, sans défilement interne ? */
async function measure(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.task-sheet .sheet__panel');
    const body = document.querySelector('.task-sheet .sheet__body');
    const r = panel.getBoundingClientRect();
    return {
      vh: innerHeight,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      bodyScroll: body.scrollHeight - body.clientHeight,
      active: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName,
      activeTag: document.activeElement?.tagName,
    };
  });
}

async function sheetCase(viewport, tag) {
  const { page, context } = await open(viewport);
  await page.getByRole('button', { name: 'Ajouter une tâche', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' });
  await dialog.waitFor();
  await page.waitForTimeout(500);
  const m0 = await measure(page);
  check(`${tag} : focus hors du champ titre (${m0.active})`, m0.activeTag !== 'INPUT' && m0.activeTag !== 'TEXTAREA', m0);
  check(`${tag} : « Une fois » par défaut`, await dialog.locator('#task-recurrence-none').isChecked());
  check(`${tag} : défaut sans défilement`, m0.bodyScroll <= 0 && m0.bottom <= m0.vh, m0);
  await page.screenshot({ path: join(outDir, `${tag}-nouvelle-tache.png`) });

  // Cas le plus haut : une personne (tour à tour visible) + chaque semaine + jours.
  await dialog.locator("#task-who-a").check();
  await dialog.locator("#task-recurrence-weekly").check();
  await page.waitForTimeout(250);
  const m1 = await measure(page);
  const fits = m1.bodyScroll <= 0 && m1.bottom <= m1.vh;
  // Exigence à 390 × 844 ; à 375 × 667 (« si possible »), seul le cas par défaut doit tenir.
  if (viewport.height >= 844) check(`${tag} : personne + chaque semaine + jours sans défilement`, fits, m1);
  else console.log('info', `${tag} : cas le plus haut ${fits ? 'sans défilement' : `défile de ${m1.bodyScroll} px`}`);
  await page.screenshot({ path: join(outDir, `${tag}-nouvelle-tache-hebdo.png`) });

  // Toucher le titre ouvre la saisie.
  await dialog.locator('#task-title').tap();
  check(`${tag} : toucher le titre y place le focus`, await dialog.locator('#task-title').evaluate((el) => el === document.activeElement));
  await context.close();
}

await sheetCase({ width: 390, height: 844 }, '390');
await sheetCase({ width: 375, height: 667 }, '375');

// Cartes allégées.
{
  const { page, context } = await open({ width: 390, height: 844 });
  const goal = page.locator('.weekly-goal');
  await goal.scrollIntoViewIfNeeded();
  const blocks = await goal.evaluate((el) =>
    [...el.querySelectorAll('h2, p')].filter((n) => n.textContent.trim() !== '').map((n) => n.textContent.trim()),
  );
  check(`objectif : ${blocks.length} blocs de texte (≤ 3)`, blocks.length <= 3, blocks);
  console.log('     ', blocks.join(' | '));
  await goal.screenshot({ path: join(outDir, 'objectif.png') });

  const balance = page.locator('.balance');
  await balance.scrollIntoViewIfNeeded();
  const words = await balance.evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.balance__how, .balance__detail, .suggestions').forEach((n) => n.remove());
    return clone.textContent.trim().split(/\s+/).length;
  });
  check(`partage : ${words} mots visibles hors replis (≤ 25)`, words <= 25, words);
  await balance.screenshot({ path: join(outDir, 'partage.png') });
  await context.close();
}

await browser.close();
check('aucune erreur de page', errors.length === 0, errors);
process.exit(failed > 0 ? 1 : 0);
