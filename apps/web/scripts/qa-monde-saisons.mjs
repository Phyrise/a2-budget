/**
 * QA MONDE — saisons peintes (labo world-lab.html, serveur sur 5183).
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5183 --strictPort &
 *   node apps/web/scripts/qa-monde-saisons.mjs [filtre]
 *
 * Captures 390×844 (apps/web/qa/monde-saisons/, gitignoré) : chaque saison au
 * stade 6, hiver aux stades 1 et 7, nuit de chaque saison, humeurs en automne
 * et en hiver ; fondu de saison (milieu de fondu, jamais d'écran noir).
 * Vérifications : peinture affichée (stats().paint), aucune requête d'une autre
 * saison, mémoire GPU < 60 Mo, pas d'erreur console.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../qa/monde-saisons');
mkdirSync(out, { recursive: true });
const BASE = process.env.LAB_URL ?? 'http://localhost:5183/a2-budget/world-lab.html';
const filter = process.argv[2] ?? '';
const VIEW = { width: 390, height: 844 };
const CLIP = { x: 0, y: 0, width: 390, height: 470 };
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const MOODS = ['quiet', 'peaceful', 'lively', 'flourishing'];

/** [nom, paramètres, peinture attendue, action] */
const SHOTS = [
  ...SEASONS.map((s) => [`s6-${s}`, `season=${s}&stage=6&mood=peaceful`, `${s}:6`]),
  ['winter-s1', 'season=winter&stage=1&mood=peaceful', 'winter:1'],
  ['winter-s7', 'season=winter&stage=7&mood=peaceful', 'winter:7'],
  ...SEASONS.map((s) => [`night-${s}`, `season=${s}&stage=6&paused=1`, `${s}:6`]),
  ...MOODS.map((m) => [`mood-autumn-${m}`, `season=autumn&stage=6&mood=${m}`, 'autumn:6']),
  ...MOODS.map((m) => [`mood-winter-${m}`, `season=winter&stage=6&mood=${m}`, 'winter:6']),
  ['spring-lively', 'season=spring&stage=6&mood=lively', 'spring:6'],
  ['autumn-still', 'season=autumn&stage=6&mood=peaceful&motion=still', 'autumn:6'],
  ['autumn-banner', 'season=autumn&stage=6&mood=peaceful&variant=banner', 'autumn:6'],
  // Fondu été → hiver : milieu du fondu, puis fin.
  ['fade-summer-winter', 'season=summer&stage=6&mood=peaceful', 'winter:6', async (p, log) => {
    await p.evaluate(() => window.__lab.set({ season: 'winter' }));
    const t0 = Date.now();
    await p.waitForFunction(() => window.__lab.stats()?.paint === 'winter:6', null, { timeout: 15000 });
    log(`  peinture d'hiver prête en ${Date.now() - t0} ms`);
    await p.waitForTimeout(1300);
    await p.screenshot({ path: resolve(out, 'fade-summer-winter-mid.png'), clip: CLIP });
    await p.waitForTimeout(2200);
  }],
  // Changements rapides : la dernière saison demandée gagne.
  ['rapid', 'season=summer&stage=6&mood=peaceful', 'spring:6', async (p) => {
    for (const s of ['autumn', 'winter', 'spring']) {
      await p.evaluate((x) => window.__lab.set({ season: x }), s);
      await p.waitForTimeout(120);
    }
    await p.waitForFunction(() => window.__lab.stats()?.paint === 'spring:6' && !window.__lab.stats()?.fading, null, { timeout: 15000 });
  }],
];

const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`);

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
for (const [name, params, expect, action] of SHOTS) {
  if (filter && !name.includes(filter)) continue;
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  const seasonReqs = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    // En dev, Vite sert aussi le module JS de chaque import d'asset (?import) : seule l'image compte.
    if (r.url().includes('?import') || r.resourceType() === 'script') return;
    const m = /season-(spring|autumn|winter)-/.exec(r.url());
    if (m) seasonReqs.push(`${m[1]}:${r.url().split('/').pop().split('?')[0]}`);
  });
  await page.goto(`${BASE}?ui=0&quality=0&${params}`);
  await page.waitForFunction(() => window.__lab?.stats()?.paint, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3200);
  const log = (s) => console.log(s);
  if (action) await action(page, log);
  await page.waitForFunction(() => !window.__lab.stats()?.fading, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => window.__lab?.stats());
  await page.screenshot({ path: resolve(out, `${name}.png`), clip: CLIP });
  check(`${name} : peinture`, st?.paint === expect, `${st?.paint} (attendu ${expect})`);
  check(`${name} : mémoire < 60 Mo`, (st?.memoryMB ?? 99) < 60, `${st?.memoryMB.toFixed(1)} Mo`);
  // Aucune autre saison chargée que celles demandées pendant le cas.
  const wanted = new Set([expect.split(':')[0], ...(name === 'rapid' ? ['autumn', 'winter'] : [])]);
  const foreign = seasonReqs.filter((r) => !wanted.has(r.split(':')[0]));
  check(`${name} : requêtes de saison`, foreign.length === 0, `${seasonReqs.length} (${[...new Set(seasonReqs)].map((r) => r.split(':')[1]).join(', ') || '—'})${foreign.length ? ` ÉTRANGÈRES ${foreign.join(', ')}` : ''}`);
  check(`${name} : console`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} OK`);
process.exit(fails ? 1 : 0);
