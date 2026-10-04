/**
 * QA visuelle MONDE V3 : saisons, pulse fort, lanterne (labo world-lab.html).
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5193 --strictPort &
 *   node apps/web/scripts/qa-monde-v3.mjs [filtre]
 *
 * Sorties : apps/web/qa/monde-v3/*.png (gitignoré) + temps par image.
 * Le cas « freeze » (≈ 55 s) vérifie que la lanterne réveille une scène figée.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../qa/monde-v3');
mkdirSync(out, { recursive: true });
const BASE = process.env.LAB_URL ?? 'http://localhost:5193/a2-budget/world-lab.html';
const filter = process.argv[2] ?? '';
const VIEW = { width: 390, height: 844 };
/** Les noms en « d- » sont capturés en présentation bureau (backdrop 1440×900). */
const DESKTOP = { width: 1440, height: 900 };

const wait = (page, ms) => page.waitForTimeout(ms);

/** [nom, paramètres, action(page)] */
const SHOTS = [
  ['autumn', 'season=autumn&mood=peaceful'],
  ['winter', 'season=winter&mood=peaceful'],
  ['spring', 'season=spring&mood=lively'],
  ['summer-evening', 'season=summer&mood=lively&evening=1'],
  ['autumn-still', 'season=autumn&mood=peaceful&motion=still'],
  ['autumn-night', 'season=autumn&paused=1'],
  ['pulse-strong-flight', 'season=autumn&mood=peaceful', async (p) => {
    await p.evaluate(() => window.__lab.pulse(innerWidth * 0.3, innerHeight * 0.8, true));
    await wait(p, 1100);
  }],
  ['pulse-strong-land', 'season=autumn&mood=quiet', async (p) => {
    await p.evaluate(() => window.__lab.pulse(innerWidth * 0.3, innerHeight * 0.8, true));
    await wait(p, 2500);
  }],
  ['pulse-strong-seq', 'season=autumn&mood=peaceful', async (p) => {
    await p.evaluate(() => window.__lab.pulse(innerWidth * 0.3, innerHeight * 0.8, true));
    for (const [i, ms] of [[1, 2150], [2, 450], [3, 500]]) {
      await wait(p, ms);
      await p.screenshot({ path: resolve(out, `pulse-strong-seq-${i}.png`), clip: { x: 0, y: 0, width: 390, height: 460 } });
    }
  }],
  ['lantern-30', 'season=autumn&mood=peaceful', async (p) => {
    await p.evaluate(() => window.__lab.focus(0.3, 'b'));
    await wait(p, 3500);
  }],
  ['lantern-100-bloom', 'season=autumn&mood=peaceful', async (p) => {
    await p.evaluate(() => window.__lab.focus(0.9, 'a'));
    await wait(p, 2500);
    await p.evaluate(() => window.__lab.focus(1, 'a'));
    await wait(p, 700);
  }],
  ['lantern-100', 'season=autumn&mood=peaceful', async (p) => {
    await p.evaluate(() => window.__lab.focus(1, 'both'));
    await wait(p, 4000);
  }],
  ['lantern-night', 'season=winter&paused=1', async (p) => {
    await p.evaluate(() => window.__lab.focus(0.6, 'b'));
    await wait(p, 3500);
  }],
  ['lantern-still', 'season=autumn&mood=peaceful&motion=still', async (p) => {
    await p.evaluate(() => window.__lab.focus(0.5, 'b'));
    await wait(p, 2000);
  }],
  ['d-winter-lantern', 'variant=backdrop&season=winter&mood=lively', async (p) => {
    await p.evaluate(() => window.__lab.focus(0.7, 'a'));
    await wait(p, 3500);
  }],
  ['lantern-live0', 'season=autumn&mood=peaceful&live=0', async (p) => {
    await p.evaluate(() => window.__lab.focus(0.4, 'a'));
    await wait(p, 3000);
  }],
  ['banner-autumn', 'variant=banner&season=autumn&mood=peaceful'],
  ['freeze', 'season=autumn&mood=peaceful', async (p, log) => {
    await wait(p, 47000);
    const f0 = await p.evaluate(() => window.__lab.stats().frames);
    await wait(p, 2000);
    log(`  figée, images en 2 s : ${(await p.evaluate(() => window.__lab.stats().frames)) - f0}`);
    await p.evaluate(() => window.__lab.focus(0.3, 'b'));
    await wait(p, 8000);
    const f1 = await p.evaluate(() => window.__lab.stats().frames);
    await wait(p, 2000);
    log(`  lanterne (régime établi), images en 2 s : ${(await p.evaluate(() => window.__lab.stats().frames)) - f1}`);
    await p.evaluate(() => window.__lab.focus(null));
    await wait(p, 50000);
    const f2 = await p.evaluate(() => window.__lab.stats().frames);
    await wait(p, 2000);
    log(`  lanterne éteinte depuis 50 s, images en 2 s : ${(await p.evaluate(() => window.__lab.stats().frames)) - f2}`);
  }],
];

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const errors = [];
for (const [name, params, action] of SHOTS) {
  if (filter ? !name.includes(filter) : name === 'freeze') continue;
  const desk = name.startsWith('d-');
  const ctx = await browser.newContext({ viewport: desk ? DESKTOP : VIEW, deviceScaleFactor: desk ? 1 : 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto(`${BASE}?ui=0&quality=0&${params}`);
  await page.waitForFunction(() => window.__lab?.stats() != null, null, { timeout: 20000 }).catch(() => {});
  await wait(page, 2800);
  if (action) await action(page, console.log);
  // Débit réel : images rendues par le moteur pendant 1 s (et rAF du navigateur).
  const f0 = await page.evaluate(() => window.__lab?.stats()?.frames ?? 0);
  const raf = await page.evaluate(
    () =>
      new Promise((res) => {
        const ts = [];
        const f = (t) => {
          ts.push(t);
          if (t - ts[0] < 1000) requestAnimationFrame(f);
          else res(ts.length - 1);
        };
        requestAnimationFrame(f);
      }),
  );
  const stats = await page.evaluate(() => window.__lab?.stats());
  const engineFps = (stats?.frames ?? 0) - f0;
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  console.log(
    name,
    stats
      ? `${engineFps} images/s · ${stats.frameMs.toFixed(2)} ms/image (CPU) · cible ${stats.targetFps} · palier ${stats.tier} · ${stats.memoryMB.toFixed(1)} Mo · rAF ${raf}/s`
      : 'pas de moteur',
  );
  await ctx.close();
}
await browser.close();
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
