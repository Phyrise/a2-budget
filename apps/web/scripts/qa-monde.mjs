/**
 * QA visuelle du moteur MONDE : captures du labo (world-lab.html).
 *
 *   pnpm --filter @a2/web exec vite --port 5183 --strictPort &
 *   node apps/web/scripts/qa-monde.mjs [filtre]
 *
 * Sorties : apps/web/qa/monde/*.png (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../qa/monde');
mkdirSync(out, { recursive: true });
const BASE = process.env.LAB_URL ?? 'http://localhost:5183/a2-budget/world-lab.html';
const filter = process.argv[2] ?? '';

const VIEWS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

/** [nom, vue, paramètres, action] */
const SHOTS = [
  ['quiet', 'mobile', 'mood=quiet'],
  ['peaceful', 'mobile', 'mood=peaceful'],
  ['lively', 'mobile', 'mood=lively'],
  ['flourishing', 'mobile', 'mood=flourishing'],
  ['night', 'mobile', 'paused=1&mood=lively'],
  ['stage2', 'mobile', 'stage=2&mood=peaceful'],
  ['stub', 'mobile', 'data=stub&mood=lively'],
  ['banner', 'mobile', 'variant=banner&mood=peaceful'],
  ['tier2', 'mobile', 'mood=lively&quality=2&creature=1'],
  ['gentle', 'mobile', 'mood=flourishing&motion=gentle&creature=1'],
  ['pulse', 'mobile', 'mood=peaceful', 'pulse'],
  ['guardian', 'mobile', 'mood=peaceful', 'guardian'],
  ['d-quiet', 'desktop', 'variant=backdrop&mood=quiet'],
  ['d-peaceful', 'desktop', 'variant=backdrop&mood=peaceful'],
  ['d-lively', 'desktop', 'variant=backdrop&mood=lively'],
  ['d-flourishing', 'desktop', 'variant=backdrop&mood=flourishing'],
  ['d-night', 'desktop', 'variant=backdrop&paused=1'],
  ['d-stage3', 'desktop', 'variant=backdrop&stage=3&mood=lively'],
  ['d-pulse', 'desktop', 'variant=backdrop&mood=lively', 'pulse'],
  ['d-guardian', 'desktop', 'variant=backdrop&mood=peaceful', 'guardian'],
];

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const errors = [];
for (const [name, view, params, action] of SHOTS) {
  if (filter && !name.includes(filter)) continue;
  const ctx = await browser.newContext({ viewport: VIEWS[view], deviceScaleFactor: VIEWS[view].deviceScaleFactor });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto(`${BASE}?ui=0&${params.includes('quality=') ? '' : 'quality=0&'}${params}`);
  await page.waitForFunction(() => window.__lab?.stats() != null, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2600);
  if (action === 'pulse') {
    await page.evaluate(() => window.__lab.pulse(innerWidth * 0.25, innerHeight * 0.8));
    await page.waitForTimeout(900);
  } else if (action === 'guardian') {
    await page.evaluate(() => window.__lab.guardian());
    await page.waitForTimeout(5600);
  }
  const stats = await page.evaluate(() => window.__lab?.stats());
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  console.log(name, stats ? `${stats.fps.toFixed(0)}fps ${stats.frameMs.toFixed(1)}ms tier${stats.tier} ${stats.memoryMB.toFixed(1)}MB` : 'no-engine');
  await ctx.close();
}
await browser.close();
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
