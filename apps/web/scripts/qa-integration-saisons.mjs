/**
 * QA d'intégration des saisons, dans l'application réelle (serveur de dev).
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5185 --strictPort &
 *   node apps/web/scripts/qa-integration-saisons.mjs [port]
 *
 * À 390×844 et 1440×900 :
 * - Maison en automne (date réelle, ou A2_QA_DATE), puis printemps et hiver
 *   par l'aperçu du mode développeur, puis la pause (nuit de saison) ;
 * - Budget et Courses en automne et en hiver.
 * Pendant chaque changement de saison, la scène est échantillonnée (~toutes
 * les 150 ms) : aucune image ne doit tomber sous 40 % de la luminance de la
 * plus sombre des deux saisons (sinon : écran noir). Les requêtes de saison
 * doivent viser la saison affichée (ou la suivante, préchargée), jamais une
 * autre. Pas d'erreur console.
 *
 * Sorties (gitignorées) : apps/web/qa/integration-saisons/*.png, sheet.jpg.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const coreDir = dirname(require.resolve('playwright-core/package.json', { paths: [require.resolve('@playwright/test')] }));
const { PNG } = require(join(coreDir, 'lib/utilsBundle'));

const port = Number(process.argv[2] ?? 5185);
const base = `http://127.0.0.1:${port}/a2-budget/`;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'integration-saisons');
mkdirSync(outDir, { recursive: true });

const VIEWS = { phone: { width: 390, height: 844 }, desk: { width: 1440, height: 900 } };
const LABEL = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
const NEXT = { spring: 'summer', summer: 'autumn', autumn: 'winter', winter: 'spring' };
const shots = [];
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`);

/** Luminance moyenne (0–255) d'une capture, échantillonnée un pixel sur 7. */
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

/** Zone de la scène : haut de l'écran sur téléphone (forêt / bandeau), colonne de gauche sur ordinateur. */
const sceneClip = (view) => (view.width < 800 ? { x: 0, y: 0, width: view.width, height: 300 } : { x: 0, y: 0, width: 420, height: view.height });

async function newPage(browser, view) {
  const context = await browser.newContext({ viewport: view, deviceScaleFactor: 1 });
  if (process.env.A2_QA_DATE) await context.addInitScript(`(() => { const T = new Date(${JSON.stringify(process.env.A2_QA_DATE)}).getTime(); const D = Date; const off = T - D.now(); globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } }; })();`);
  await context.addInitScript(() => localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ devMode: true })));
  const page = await context.newPage();
  const errors = [];
  const seasonReqs = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    // En dev, Vite sert aussi le module JS de chaque import d'asset (?import) : seule l'image compte.
    if (r.url().includes('?import') || r.resourceType() === 'script') return;
    const m = /season-(?:(?:budget|courses)-)?(spring|autumn|winter)-/.exec(r.url());
    if (m) seasonReqs.push(m[1]);
  });
  return { context, page, errors, seasonReqs };
}

async function devSet(page, legend, label) {
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = page.getByRole('dialog', { name: 'Mode développeur' });
  await dev.locator('fieldset', { has: page.locator('legend', { hasText: new RegExp(`^${legend}$`) }) }).getByRole('button', { name: label, exact: true }).click();
  await page.keyboard.press('Escape');
  await dev.waitFor({ state: 'hidden' });
}

/** Attend que la scène soit peinte : canvas WebGL visible (Maison) ou peinture d'univers prête. */
async function settle(page, module) {
  if (module === 'maison') {
    await page.waitForFunction(() => [...document.querySelectorAll('.living-forest canvas')].some((c) => getComputedStyle(c).opacity === '1'), null, { timeout: 20_000 });
  } else {
    await page.waitForFunction(() => {
      const img = document.querySelector('img.app-world__banner.is-shown, img.app-world__backdrop.is-shown, img.app-world__banner[data-universe], img.app-world__backdrop[data-universe]');
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 15_000 });
  }
  await page.waitForTimeout(module === 'maison' ? 3200 : 1400);
}

async function shot(page, name) {
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
}

/** Change la saison par l'aperçu et échantillonne la scène pendant ~3,6 s. */
async function changeSeason(page, view, from, to, name) {
  const clip = sceneClip(view);
  const before = luminance(await page.screenshot({ clip }));
  const samples = [];
  const t0 = Date.now();
  await devSet(page, 'Saison', LABEL[to]);
  while (Date.now() - t0 < 3600) {
    samples.push(luminance(await page.screenshot({ clip })));
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1200);
  const after = luminance(await page.screenshot({ clip }));
  const floor = 0.4 * Math.min(before, after);
  const min = Math.min(...samples);
  check(`${name} : pas d'écran noir (${from} → ${to})`, min >= floor, `min ${min.toFixed(0)} / avant ${before.toFixed(0)} / après ${after.toFixed(0)} (${samples.length} images)`);
}

function checkRequests(name, seasonReqs, shown) {
  const allowed = new Set(shown.flatMap((s) => [s, NEXT[s]]));
  const foreign = seasonReqs.filter((s) => !allowed.has(s));
  check(`${name} : requêtes de saison`, foreign.length === 0, `${seasonReqs.length} requêtes (${[...new Set(seasonReqs)].join(', ') || '—'})${foreign.length ? ` ÉTRANGÈRES : ${foreign.join(', ')}` : ''}`);
}

async function maison(browser, vname, view, real) {
  const { context, page, errors, seasonReqs } = await newPage(browser, view);
  await page.goto(`${base}?module=maison`);
  await page.locator('.screen-sheet').waitFor();
  await settle(page, 'maison');
  await shot(page, `${vname}-maison-${real}`);
  checkRequests(`${vname} maison ${real}`, seasonReqs, [real]);
  check(`${vname} maison ${real} : peinture de saison demandée`, real === 'summer' || seasonReqs.includes(real));

  await changeSeason(page, view, real, 'spring', `${vname} maison`);
  await shot(page, `${vname}-maison-spring`);
  await changeSeason(page, view, 'spring', 'winter', `${vname} maison`);
  await shot(page, `${vname}-maison-winter`);
  check(`${vname} maison : printemps et hiver demandés`, seasonReqs.includes('spring') && seasonReqs.includes('winter'));
  checkRequests(`${vname} maison (aperçus)`, seasonReqs, [real, 'spring', 'winter']);

  // Pause en hiver (nuit d'hiver), puis retour à la saison réelle en pause (nuit réelle).
  await devSet(page, 'Pause', 'Endormie');
  await page.waitForTimeout(3000);
  await shot(page, `${vname}-maison-winter-nuit`);
  await changeSeason(page, view, 'winter', real, `${vname} maison nuit`);
  await shot(page, `${vname}-maison-${real}-nuit`);
  check(`${vname} maison : console`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
}

async function universe(browser, vname, view, module, real) {
  const { context, page, errors, seasonReqs } = await newPage(browser, view);
  await page.goto(`${base}?module=${module}`);
  await page.locator('.screen-sheet').waitFor();
  await settle(page, module);
  const kind = view.width < 800 ? 'banner' : 'backdrop';
  const shown = () => page.evaluate((k) => [...document.querySelectorAll(`img.app-world__${k}[data-universe]`)].map((i) => i.dataset.season).join(','), kind);
  const s1 = await shown();
  check(`${vname} ${module} ${real} : peinture ${s1}`, s1 === (real === 'summer' || real === 'spring' ? 'base' : real));
  await shot(page, `${vname}-${module}-${real}`);
  await changeSeason(page, view, real, 'winter', `${vname} ${module}`);
  const s2 = await shown();
  check(`${vname} ${module} hiver : peinture ${s2}`, s2 === 'winter');
  await shot(page, `${vname}-${module}-winter`);
  checkRequests(`${vname} ${module}`, seasonReqs, [real, 'winter']);
  check(`${vname} ${module} : console`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await context.close();
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const probe = await browser.newPage();
const real = await probe.evaluate((d) => {
  const m = (d ? new Date(d) : new Date()).getMonth();
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}, process.env.A2_QA_DATE ?? null);
await probe.close();
console.log(`saison réelle : ${real}`);
for (const [vname, view] of Object.entries(VIEWS)) {
  await maison(browser, vname, view, real);
  for (const module of ['budget', 'courses']) await universe(browser, vname, view, module, real);
}

// Planche réduite (sips) : une ligne par format.
try {
  for (const f of shots) execFileSync('sips', ['-Z', '520', '-s', 'format', 'jpeg', f, '--out', f.replace(/\.png$/, '.small.jpg')], { stdio: 'ignore' });
  const fig = (f) => {
    const n = f.split('/').pop().replace(/\.png$/, '');
    return `<figure style="margin:0"><img src="${n}.small.jpg" style="height:${n.startsWith('phone') ? 360 : 200}px;display:block"><figcaption>${n.replace(/^(phone|desk)-/, '')}</figcaption></figure>`;
  };
  const html = `<body style="margin:6px;background:#222;color:#eee;font:11px system-ui">${['phone', 'desk']
    .map((v) => `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${shots.filter((f) => f.includes(`/${v}-`)).map(fig).join('')}</div>`)
    .join('')}</body>`;
  writeFileSync(join(outDir, 'sheet.html'), html);
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.goto(pathToFileURL(join(outDir, 'sheet.html')).href);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, 'sheet.png'), fullPage: true });
  execFileSync('sips', ['-Z', '1500', '-s', 'format', 'jpeg', join(outDir, 'sheet.png'), '--out', join(outDir, 'sheet.jpg')], { stdio: 'ignore' });
} catch {
  /* sips absent : captures pleine taille seulement */
}
await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} OK`);
process.exit(fails ? 1 : 0);
