/**
 * QA MONDE V4.1 (labo, 390×844) : la lanterne de pierre intégrée dans la
 * forêt (placement, occlusion par la profondeur et par les fougères, base
 * fondue, ombre de contact, brume et saison cohérentes), éteinte et allumée,
 * stade 6 été, stade 7, automne, nuit ; kodama assis sur le toit.
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5183 --strictPort &
 *   node apps/web/scripts/qa-monde-v41.mjs [apres|avant] [filtre]
 *
 * Sorties : apps/web/qa/monde-v41/<apres|avant>/*.png (gitignoré) — écran
 * entier (dpr 1) et gros plan de la lanterne (dpr 2). `avant` sert à capturer
 * la version précédente (même scénarios) pour la comparaison côte à côte.
 * Code de sortie 1 si une vérification échoue.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const which = process.argv[2] === 'avant' ? 'avant' : 'apres';
const filter = process.argv[3] ?? '';
const out = join(webRoot, 'qa', 'monde-v41', which);
mkdirSync(out, { recursive: true });
const ORIGIN = process.env.QA_ORIGIN ?? 'http://127.0.0.1:5183';
const LAB = `${ORIGIN}/a2-budget/world-lab.html?ui=0&lights=0&motion=full`;
const VIEW = { width: 390, height: 844 };
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${label}`);
  if (!ok) failures.push(label);
};

/** Scénarios : nom, paramètres du labo, lanterne allumée (progression) ou non. */
const SCENES = [
  ['s6-ete', 'stage=6&season=summer', null],
  ['s6-ete-allumee', 'stage=6&season=summer', 0.6],
  ['s7-ete', 'stage=7&season=summer', null],
  ['s7-ete-allumee', 'stage=7&season=summer', 0.6],
  ['s1-ete', 'stage=1&season=summer', null],
  ['s6-automne', 'stage=6&season=autumn', null],
  ['s6-automne-allumee', 'stage=6&season=autumn', 0.6],
  ['s6-hiver', 'stage=6&season=winter', null],
  ['s6-nuit', 'stage=6&season=summer&paused=1', null],
  ['s6-nuit-allumee', 'stage=6&season=summer&paused=1', 0.6],
  ['s6-yukimi', 'stage=6&season=summer&model=yukimi', null],
  ['s6-ancient', 'stage=6&season=spring&model=ancient-shrine', 0.6],
];

const browser = await chromium.launch();

/** Boîte de la lanterne à l'écran (px CSS). */
function box(page) {
  return page.evaluate(() => {
    const e = window.__worldEngine;
    const r = e.canvas.getBoundingClientRect();
    const f = e.framing;
    const g = e.stone.geometry();
    const asp = e.cfg.manifest.size.w / e.cfg.manifest.size.h;
    const x = (v) => r.left + ((v - f.cx) / f.vw + 0.5) * r.width;
    const y = (v) => r.top + ((v - f.cy) / f.vh + 0.5) * r.height;
    return { left: x(g.ground.x - g.w / 2 / asp), right: x(g.ground.x + g.w / 2 / asp), top: y(g.ground.y - g.h), bottom: y(g.ground.y), canvasBottom: r.bottom, model: e.stone.model?.id ?? null };
  });
}

for (const [name, qs, lit] of SCENES) {
  if (filter && !name.includes(filter)) continue;
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${LAB}&${qs}${lit === null ? '' : `&lantern=${lit}`}`);
  await page.waitForFunction(() => window.__worldEngine?.stone?.model, null, { timeout: 20000 });
  await page.waitForTimeout(lit === null ? 3200 : 4200);
  if (name.startsWith('s6-ete') && lit === null) {
    await page.evaluate(() => window.__lab.kodama(0));
    await page.waitForTimeout(1600);
  }
  const b = await box(page);
  await page.screenshot({ path: join(out, `${name}.png`), scale: 'css' });
  const pad = 46;
  const clip = { x: Math.max(0, b.left - pad), y: Math.max(0, b.top - pad), width: b.right - b.left + pad * 2, height: b.bottom - b.top + pad * 2 };
  clip.width = Math.min(clip.width, VIEW.width - clip.x);
  await page.screenshot({ path: join(out, `${name}-zoom.png`), clip });
  check(errors.length === 0, `${name} : aucune erreur (${errors.join(' | ') || '—'})`);
  check(b.top > 40 && b.bottom < VIEW.height * 0.54 - 8, `${name} : la lanterne tient dans le héros (${Math.round(b.top)}–${Math.round(b.bottom)} px)`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} échec(s)`);
  process.exit(1);
}
console.log('\nQA monde V4.1 : tout est vert');
