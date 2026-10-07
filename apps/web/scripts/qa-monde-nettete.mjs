/**
 * QA netteté de la forêt (labo, 390×844, dpr 3) : taille de la cible de rendu
 * et du canvas face aux pixels de l'écran, taille et filtrage de la texture de
 * la peinture, puis gros plans recadrés (cèdre, fougères) pour comparer avant /
 * après. Mesure aussi le coût d'une image (stats()) aux paliers 0, 1 et 2.
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5185 --strictPort &
 *   node apps/web/scripts/qa-monde-nettete.mjs [avant|apres] [saison]
 *
 * Sorties : apps/web/qa/monde-nettete/<avant|apres>/*.png (gitignoré).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] === 'avant' ? 'avant' : 'apres';
const season = process.argv[3] ?? 'summer';
const out = join(resolve(here, '..'), 'qa', 'monde-nettete', which);
mkdirSync(out, { recursive: true });
const ORIGIN = process.env.QA_ORIGIN ?? 'http://127.0.0.1:5185';
const LAB = `${ORIGIN}/a2-budget/world-lab.html?ui=0&lights=0&motion=full&stage=6&season=${season}`;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'fr-FR' });
const page = await ctx.newPage();
await page.goto(LAB);
await page.waitForFunction(() => window.__worldEngine?.stage, null, { timeout: 30000 });
await page.waitForTimeout(3500);

const probe = () =>
  page.evaluate(() => {
    const e = window.__worldEngine;
    const gl = e.gl;
    const r = e.canvas.getBoundingClientRect();
    const c = e.stage.color;
    const f = e.framing;
    const filt = (v) => ({ [gl.LINEAR]: 'LINEAR', [gl.LINEAR_MIPMAP_LINEAR]: 'LINEAR_MIPMAP_LINEAR', [gl.NEAREST]: 'NEAREST' })[v] ?? v;
    // Pixels d'image visibles sur la largeur de la vue, et grandissement à l'écran.
    const visW = f.vw * c.width;
    return {
      css: [Math.round(r.width), Math.round(r.height)],
      screenPx: [Math.round(r.width * devicePixelRatio), Math.round(r.height * devicePixelRatio)],
      canvas: [e.canvas.width, e.canvas.height],
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      target: [e.pipe.target.width, e.pipe.target.height],
      engineDpr: e.dpr,
      manifestSize: e.cfg.manifest.size,
      texture: [c.width, c.height],
      minFilter: filt(c.minFilter),
      magFilter: filt(c.magFilter),
      mipmaps: c.generateMipmaps,
      visibleImagePx: Math.round(visW),
      magnifyOnScreen: +((r.width * devicePixelRatio) / visW).toFixed(2),
      magnifyInTarget: +(e.pipe.target.width / visW).toFixed(2),
      stats: e.stats(),
    };
  });

const info = { base: await probe() };
console.log(JSON.stringify(info.base, null, 1));

// Gros plans (px CSS) : corde du cèdre, fougères et rochers du bas.
const crops = { cedre: { x: 120, y: 250, width: 150, height: 150 }, fougeres: { x: 20, y: 560, width: 150, height: 150 } };
for (const [name, clip] of Object.entries(crops)) await page.screenshot({ path: join(out, `${season}-${name}.png`), clip });
await page.screenshot({ path: join(out, `${season}-vue.png`), scale: 'css' });

// Coût d'une image par palier (fps peu représentatif en headless).
info.tiers = [];
for (const q of [0, 1, 2]) {
  await page.evaluate((q) => window.__worldEngine.configure({ quality: q }), q);
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => window.__worldEngine.stats());
  info.tiers.push({ q, dpr: s.dpr, frameMs: +s.frameMs.toFixed(2), fps: Math.round(s.fps), memoryMB: Math.round(s.memoryMB) });
}
console.log(JSON.stringify(info.tiers));
writeFileSync(join(out, `${season}-mesures.json`), JSON.stringify(info, null, 2));
await browser.close();
