/**
 * QA visuelle de l'agent ASSETS : les assets du pipeline (art/pipeline) dans
 * l'app réelle (Maison / Budget / Courses) et dans le labo du moteur
 * (world-lab.html, données « stub » = manifest courant).
 *
 *   pnpm --filter @a2/web exec vite --port 5184 --strictPort &
 *   node apps/web/scripts/qa-assets.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/assets/*.png et des planches réduites
 * apps/web/qa/assets/sheet-*.jpg (à regarder en priorité).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5184);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'assets');
mkdirSync(outDir, { recursive: true });

const BASE = `http://localhost:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

// Fixtures construites par le core dans le navigateur (Vite résout @a2/core).
writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="./fixtures.ts"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'fixtures.ts'),
  `import {
  CREATURES, GROWTH_THRESHOLDS, addDays, createTask, emptyAppState, localDateKey, migrateState,
  toggleTaskToday, type AppState,
} from '@a2/core';

function forest(stage: number, vitality: number, paused = false): AppState {
  const now = new Date();
  let s = emptyAppState();
  const created = localDateKey(addDays(now, -10));
  const tasks = [
    createTask({ id: 't1', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily' }, created),
    createTask({ id: 't2', title: 'Vider le lave-vaisselle', assignee: 'b', recurrence: 'daily' }, created),
    createTask({ id: 't3', title: 'Courses du marché', assignee: 'both', recurrence: 'daily' }, created),
    createTask({ id: 't4', title: 'Sortir les poubelles', assignee: 'b', recurrence: 'daily' }, created),
  ];
  s.chores.tasks = tasks;
  for (const [i, t] of tasks.slice(0, 3).entries()) {
    s = toggleTaskToday(s, t.id, new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.min(now.getHours(), 7 + i), 5), 'c' + i).state;
  }
  const care = GROWTH_THRESHOLDS[stage - 1] ?? 0;
  const today = localDateKey(now);
  s.forest = {
    ...s.forest,
    vitality,
    lifetimeCare: care + 1,
    growthStage: stage,
    unlockedCreatureIds: CREATURES.filter((c) => c.stage <= stage).map((c) => c.id),
    lastMeaningfulActionDate: today,
    lastProcessedDay: today,
    paused,
    pausedAt: paused ? today : null,
    pauses: paused ? [{ start: today, end: null }] : [],
  };
  return s;
}

const check = (name: string, s: AppState) => {
  const r = migrateState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error('fixture ' + name + ' invalide : ' + r.reason);
  return JSON.stringify(s);
};

(window as any).__fixtures = {
  st6: check('st6', forest(6, 70)),
  st1: check('st1', forest(1, 40)),
  st7: check('st7', forest(7, 95)),
  night: check('night', forest(6, 70, true)),
};
`,
);

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const errors = [];
const shots = [];

async function getFixtures() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
  await page.goto(`${BASE}qa/assets/fixtures.html`);
  await page.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
  const fx = await page.evaluate(() => window.__fixtures);
  await page.close();
  return fx;
}

const VIEWS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const want = (name) => !filter || name.includes(filter);

async function shot(page, name) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path });
  shots.push(name);
  console.log('shot', name);
}

/** App réelle avec un état donné. */
async function app(name, vp, state, module, wait = 3500) {
  if (!want(name)) return;
  const ctx = await browser.newContext({ ...VIEWS[vp], locale: 'fr-FR', reducedMotion: 'no-preference' });
  await ctx.addInitScript(
    ([key, uiKey, value, ui]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(uiKey, JSON.stringify(ui));
    },
    [KEY, UI_KEY, state, { module, forestMotion: 'full', guardianSeen: true, offlineAnnounced: true }],
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(`${BASE}?module=${module}`);
  await page.waitForSelector('.screen-sheet');
  await page.waitForTimeout(wait);
  await shot(page, name);
  await ctx.close();
}

/** Labo du moteur (données « stub » = manifest du pipeline). */
async function lab(name, vp, params, action) {
  if (!want(name)) return;
  const ctx = await browser.newContext({ ...VIEWS[vp] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${name} console: ${m.text()}`));
  await page.goto(`${BASE}world-lab.html?ui=0&data=stub&quality=0&${params}`);
  await page.waitForFunction(() => window.__lab?.stats() != null, null, { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  if (action === 'pulse') {
    await page.evaluate(() => window.__lab.pulse(innerWidth * 0.25, innerHeight * 0.8));
    await page.waitForTimeout(2200);
  } else if (action === 'guardian') {
    await page.evaluate(() => window.__lab.guardian());
    await page.waitForTimeout(5200);
  } else if (action?.startsWith('mouse')) {
    const [, fx, fy] = action.split(':').map(Number);
    const vpx = VIEWS[vp].viewport;
    await page.mouse.move(vpx.width * 0.5, vpx.height * 0.3);
    await page.mouse.move(vpx.width * fx, vpx.height * fy, { steps: 12 });
    await page.waitForTimeout(1600);
  }
  const stats = await page.evaluate(() => window.__lab?.stats());
  if (stats) console.log(`  ${name}: ${stats.fps.toFixed(0)} fps, ${stats.memoryMB.toFixed(1)} Mo GPU, palier ${stats.tier}`);
  await shot(page, name);
  await ctx.close();
}

/** Planche réduite (JPEG) d'une série de captures, composée dans le navigateur. */
async function sheet(name, names, cols, tileW) {
  const list = names.filter((n) => shots.includes(n));
  if (list.length === 0) return;
  const page = await browser.newPage({ viewport: { width: cols * tileW, height: 200 }, deviceScaleFactor: 1 });
  const imgs = list
    .map((n) => {
      const b64 = readFileSync(join(outDir, `${n}.png`)).toString('base64');
      return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${n}</figcaption></figure>`;
    })
    .join('');
  await page.setContent(`<style>
    body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${tileW}px);font:11px system-ui;color:#fff}
    figure{margin:0;position:relative} img{width:${tileW}px;display:block}
    figcaption{position:absolute;left:0;top:0;background:#000a;padding:2px 5px}
  </style>${imgs}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `sheet-${name}.jpg`), type: 'jpeg', quality: 72, fullPage: true });
  await page.close();
  console.log('sheet', name);
}

const fx = await getFixtures();

// --- App réelle.
await app('app-maison-st6', 'm', fx.st6, 'maison');
await app('app-maison-st1', 'm', fx.st1, 'maison');
await app('app-maison-st7', 'm', fx.st7, 'maison');
await app('app-maison-night', 'm', fx.night, 'maison');
await app('app-budget', 'm', fx.st6, 'budget', 1500);
await app('app-courses', 'm', fx.st6, 'courses', 1500);
await app('app-d-maison', 'd', fx.st6, 'maison');

// --- Labo : humeurs, stades, parallaxe, événements.
for (const mood of ['quiet', 'peaceful', 'lively', 'flourishing']) await lab(`lab-${mood}`, 'm', `mood=${mood}&lights=4`);
await lab('lab-night', 'm', 'paused=1&mood=lively&lights=4');
for (const st of [1, 2, 3, 4, 5, 6, 7]) await lab(`lab-d-stage${st}`, 'd', `variant=backdrop&stage=${st}&mood=peaceful&lights=0`);
await lab('lab-par-left', 'm', 'mood=lively&lights=0', 'mouse:0.02:0.2');
await lab('lab-par-right', 'm', 'mood=lively&lights=0', 'mouse:0.98:0.2');
await lab('lab-d-par-left', 'd', 'variant=backdrop&mood=peaceful&lights=0', 'mouse:0.02:0.5');
await lab('lab-d-par-right', 'd', 'variant=backdrop&mood=peaceful&lights=0', 'mouse:0.6:0.5');
await lab('lab-pulse', 'm', 'mood=peaceful&lights=2', 'pulse');
await lab('lab-guardian', 'm', 'mood=peaceful&lights=0', 'guardian');
await lab('lab-d-guardian', 'd', 'variant=backdrop&mood=peaceful&lights=0', 'guardian');
await lab('lab-d-flourishing', 'd', 'variant=backdrop&mood=flourishing&lights=6');
await lab('lab-d-night', 'd', 'variant=backdrop&paused=1&lights=6');

await sheet('app', ['app-maison-st6', 'app-maison-st1', 'app-maison-st7', 'app-maison-night', 'app-budget', 'app-courses'], 6, 260);
await sheet('moods', ['lab-quiet', 'lab-peaceful', 'lab-lively', 'lab-flourishing', 'lab-night', 'lab-pulse'], 6, 260);
await sheet('stages', [1, 2, 3, 4, 5, 6, 7].map((s) => `lab-d-stage${s}`), 4, 360);
await sheet('parallax', ['lab-par-left', 'lab-par-right', 'lab-guardian'], 3, 300);
await sheet('desktop', ['app-d-maison', 'lab-d-par-left', 'lab-d-par-right', 'lab-d-guardian', 'lab-d-flourishing', 'lab-d-night'], 3, 480);

await browser.close();
if (errors.length) console.log('ERREURS :\n' + errors.slice(0, 30).join('\n'));
