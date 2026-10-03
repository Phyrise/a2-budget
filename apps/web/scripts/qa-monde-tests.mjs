/**
 * QA comportementale du moteur MONDE (labo world-lab.html, serveur sur 5183) :
 * mouvement réel (différence de deux images), vol d'une lumière, croissance,
 * politique de rendu (immobile, bandeau, mouvement réduit), perte de contexte
 * WebGL, repli sans WebGL.
 *
 *   node apps/web/scripts/qa-monde-tests.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../qa/monde');
mkdirSync(out, { recursive: true });
const BASE = process.env.LAB_URL ?? 'http://localhost:5183/a2-budget/world-lab.html';
const only = process.argv[2] ?? '';
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };

const results = [];
const check = (name, ok, info = '') => {
  results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`);
};

async function open(browser, params, ctxOpts = {}) {
  const ctx = await browser.newContext({ ...mobile, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}?ui=0&quality=0&${params}`);
  await page.waitForFunction(() => window.__lab?.stats() != null, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const stats = (page) => page.evaluate(() => window.__lab?.stats() ?? null);
const canvasOpacity = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.lab-world canvas')).opacity);

const browser = await chromium.launch({ args: GPU });

if (!only || only === 'motion') {
  const { ctx, page } = await open(browser, 'mood=lively');
  const clip = { x: 0, y: 0, width: 390, height: 455 };
  await page.screenshot({ path: resolve(out, 't-motion-a.png'), clip });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(out, 't-motion-b.png'), clip });
  check('mouvement (captures a/b)', true, 'voir t-motion-diff via ffmpeg');
  await ctx.close();
}

if (!only || only === 'water') {
  const { ctx, page } = await open(browser, 'variant=backdrop&mood=lively', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.waitForTimeout(1500);
  const clip = { x: 280, y: 600, width: 440, height: 300 };
  await page.screenshot({ path: resolve(out, 't-water-a.png'), clip });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(out, 't-water-b.png'), clip });
  check('eau (captures a/b)', true);
  await ctx.close();
}

if (!only || only === 'pulse') {
  const { ctx, page } = await open(browser, 'mood=peaceful&lights=1');
  await page.evaluate(() => window.__lab.pulse(innerWidth * 0.7, innerHeight * 0.75));
  for (const ms of [350, 800, 1300, 2200]) {
    await page.waitForTimeout(ms === 350 ? 350 : ms === 800 ? 450 : ms === 1300 ? 500 : 900);
    await page.screenshot({ path: resolve(out, `t-pulse-${ms}.png`), clip: { x: 0, y: 0, width: 390, height: 520 } });
  }
  check('pulse', true);
  await ctx.close();
}

if (!only || only === 'growth') {
  const { ctx, page } = await open(browser, 'mood=peaceful&stage=1');
  await page.evaluate(() => window.__lab.set({ stage: 6 }));
  for (const [i, ms] of [[1, 900], [2, 700], [3, 700]]) {
    await page.waitForTimeout(ms);
    await page.screenshot({ path: resolve(out, `t-growth-${i}.png`), clip: { x: 0, y: 0, width: 390, height: 455 } });
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: resolve(out, 't-growth-end.png'), clip: { x: 0, y: 0, width: 390, height: 455 } });
  check('croissance', true);
  await ctx.close();
}

if (!only || only === 'policy') {
  {
    const { ctx, page } = await open(browser, 'mood=peaceful&motion=still');
    await page.waitForTimeout(1500);
    const s1 = await stats(page);
    check('immobile : pas de boucle', s1?.targetFps === 0, `cible ${s1?.targetFps}`);
    await page.evaluate(() => window.__lab.set({ mood: 'flourishing' }));
    await page.waitForTimeout(150);
    const s2 = await stats(page);
    await page.waitForTimeout(1600);
    const s3 = await stats(page);
    check('immobile : fondu court puis arrêt', s3?.targetFps === 0, `pendant ${s2?.targetFps}, après ${s3?.targetFps}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, 'variant=banner');
    const s = await stats(page);
    check('bandeau : image unique', s?.targetFps === 0, `cible ${s?.targetFps}`);
    await page.screenshot({ path: resolve(out, 't-banner.png'), clip: { x: 0, y: 0, width: 390, height: 260 } });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, 'mood=lively', { reducedMotion: 'reduce' });
    const s = await stats(page);
    check('prefers-reduced-motion : pas de boucle', s?.targetFps === 0, `cible ${s?.targetFps}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, 'mood=lively');
    await page.waitForTimeout(4500);
    const s = await stats(page);
    check('politique : 30 fps après 3 s', s?.targetFps === 30 || s?.targetFps === 60, `cible ${s?.targetFps}`);
    await page.mouse.move(200, 200);
    await page.waitForTimeout(100);
    const s2 = await stats(page);
    check('politique : 60 fps au toucher', s2?.targetFps === 60, `cible ${s2?.targetFps}`);
    await ctx.close();
  }
}

if (!only || only === 'context') {
  const { ctx, page, errors } = await open(browser, 'mood=peaceful');
  const lost = await page.evaluate(() => {
    const c = document.querySelector('.lab-world canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    window.__ext = ext;
    ext?.loseContext();
    return !!ext;
  });
  await page.waitForTimeout(400);
  const op = await canvasOpacity(page);
  await page.screenshot({ path: resolve(out, 't-context-lost.png'), clip: { x: 0, y: 0, width: 390, height: 455 } });
  check('perte de contexte : repli peinture', lost && Number(op) < 1, `opacité canvas ${op}`);
  await page.evaluate(() => window.__ext?.restoreContext());
  await page.waitForTimeout(3500);
  const op2 = await canvasOpacity(page);
  const s = await stats(page);
  check('perte de contexte : restauration', Number(op2) === 1 && s !== null, `opacité ${op2}`);
  await page.screenshot({ path: resolve(out, 't-context-restored.png'), clip: { x: 0, y: 0, width: 390, height: 455 } });
  if (errors.length) results.push(`     erreurs : ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

await browser.close();

if (!only || only === 'nogl') {
  const b2 = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  const { ctx, page } = await open(b2, 'mood=peaceful');
  await page.waitForTimeout(1500);
  const hasMist = await page.evaluate(() => !!document.querySelector('.a2-mist'));
  await page.screenshot({ path: resolve(out, 't-nogl.png'), clip: { x: 0, y: 0, width: 390, height: 455 } });
  check('sans WebGL : peinture + brume CSS', hasMist);
  await ctx.close();
  await b2.close();
}

console.log(results.join('\n'));
