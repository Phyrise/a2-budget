/**
 * Sonde d'exécution (docs/PERF.md) : build de production servi par
 * `vite preview`, Chromium de Playwright en téléphone émulé (390×844, DPR 3,
 * tactile), processeur ralenti ×4 (CDP), GPU matériel (ANGLE Metal) sauf
 * `--swgl`. Mode invité, foyer réaliste (perf-household.mjs).
 *
 *   node scripts/perf-probe.mjs runtime [--port 4274] [--dist dist] [--seconds 10]
 *        [--idle 60] [--months 6] [--cpu 4] [--swgl] [--only tabs,idle,hidden,still,anims,reduced,storage]
 *
 * Étapes : premier chargement (réseau, précache), visite suivante, chaque
 * onglet, repos 60 s, arrière-plan, « Immobile », mouvement réduit, stockage.
 * Chiffres : part du fil principal occupée (Performance.getMetrics
 * TaskDuration / durée), CPU des processus rendu et GPU (SystemInfo), images/s
 * où l'app a dessiné, tas JS, nœuds DOM, boucles rAF, minuteurs, textures.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { householdState } from './perf-household.mjs';
import { deviceStorage, kb, mb, printStorage } from './perf-storage.mjs';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABS = ['Maison', 'Budget', 'Courses', 'Calendrier'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function options(args) {
  const o = { port: 4274, dist: 'dist', seconds: 10, idle: 60, months: 6, cpu: 4, swgl: false, only: null };
  for (let i = 0; i < args.length; i += 1) {
    const k = args[i].replace(/^--/, '');
    if (k === 'swgl') o.swgl = true;
    else if (k === 'only') o.only = new Set(args[++i].split(','));
    else o[k] = /^\d+$/.test(args[i + 1]) ? Number(args[++i]) : args[++i];
  }
  return o;
}

async function serve(o) {
  const url = `http://127.0.0.1:${o.port}/a2-budget/`;
  const up = () => fetch(url).then((r) => r.ok, () => false);
  if (await up()) return { url, stop() {} };
  const child = spawn('npx', ['vite', 'preview', '--outDir', o.dist, '--port', String(o.port), '--strictPort'], { cwd: webRoot, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i += 1) await sleep(500);
  return { url, stop: () => child.kill() };
}

/** CPU cumulé (s) et mémoire résidente (octets) des processus rendu et GPU. */
async function processes(browserCdp) {
  const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
  const out = { renderer: { cpu: 0, rss: 0 }, gpu: { cpu: 0, rss: 0 } };
  for (const p of processInfo) {
    const slot = p.type === 'renderer' ? out.renderer : p.type === 'GPU' ? out.gpu : null;
    if (slot === null) continue;
    slot.cpu += p.cpuTime;
    try {
      slot.rss += Number(execFileSync('ps', ['-o', 'rss=', '-p', String(p.id)]).toString().trim()) * 1024;
    } catch {
      /* processus terminé */
    }
  }
  return out;
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

/** Une fenêtre de mesure de `seconds` secondes sur la page telle qu'elle est. */
async function measure(ctx, label, seconds) {
  const { page, cdp, browserCdp } = ctx;
  await page.evaluate(() => window.__perf.take());
  const [m0, p0, t0] = [await metrics(cdp), await processes(browserCdp), Date.now()];
  await sleep(seconds * 1000);
  const [m1, p1, t1] = [await metrics(cdp), await processes(browserCdp), Date.now()];
  const perf = await page.evaluate(() => window.__perf.take());
  const heap = await cdp.send('Runtime.getHeapUsage');
  const dt = (t1 - t0) / 1000;
  const d = (k) => (m1[k] ?? 0) - (m0[k] ?? 0);
  const r = {
    label,
    seconds: Math.round(dt * 10) / 10,
    mainThreadBusy: d('TaskDuration') / dt,
    script: d('ScriptDuration') / dt,
    styleLayout: (d('RecalcStyleDuration') + d('LayoutDuration')) / dt,
    animations: perf.animations,
    animationNames: perf.animationNames,
    rendererCpu: (p1.renderer.cpu - p0.renderer.cpu) / dt,
    gpuCpu: (p1.gpu.cpu - p0.gpu.cpu) / dt,
    fps: perf.frames / dt,
    rafLoops: perf.rafCallbacks,
    rafPerSec: perf.rafCalls / dt,
    timeoutsPerSec: perf.timeouts / dt,
    intervals: perf.intervals,
    drawsPerSec: perf.draws / dt,
    heapUsed: heap.usedSize,
    heapTotal: heap.totalSize,
    domNodes: m1.Nodes,
    listeners: m1.JSEventListeners,
    textures: perf.textures,
    textureBytes: perf.textureBytes,
    biggestTextures: perf.biggestTextures,
    canvases: perf.canvases,
    canvasBytes: perf.canvasBytes,
    rendererRss: p1.renderer.rss,
    gpuRss: p1.gpu.rss,
  };
  const pc = (x) => `${(x * 100).toFixed(1)} %`.padStart(7);
  console.log(
    `  ${label.padEnd(26)} fil ${pc(r.mainThreadBusy)} (JS ${pc(r.script)})  CPU rendu ${pc(r.rendererCpu)} GPU ${pc(r.gpuCpu)}  ` +
      `${r.fps.toFixed(1).padStart(5)} im/s  anim. CSS ${r.animations}  rAF ${r.rafLoops} boucle(s)  minuteurs ${r.intervals.length} (${r.intervals.join('/')} ms)  ` +
      `tas ${mb(r.heapUsed)}  DOM ${r.domNodes}  textures ${r.textures} ≈ ${mb(r.textureBytes)} + toile ${mb(r.canvasBytes)}  RSS rendu ${mb(r.rendererRss)} GPU ${mb(r.gpuRss)}`,
  );
  if (r.animations > 0) console.log(`      animations : ${r.animationNames.join(', ')}`);
  return r;
}

async function goTo(page, name) {
  await page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name, exact: true }).click();
}

function netLog(context) {
  const log = { bytes: 0, count: 0, byType: {} };
  context.on('requestfinished', async (req) => {
    try {
      const s = await req.sizes();
      const bytes = s.responseBodySize + s.responseHeadersSize;
      const resp = await req.response();
      if (resp?.fromServiceWorker()) return; // servi par le cache du SW : pas de réseau
      const type = /\.(webp|png|jpg|svg)$/.test(req.url()) ? 'image' : /\.woff2$/.test(req.url()) ? 'police' : /\.js$/.test(req.url()) ? 'js' : /\.css$/.test(req.url()) ? 'css' : 'autre';
      log.bytes += bytes;
      log.count += 1;
      log.byType[type] = (log.byType[type] ?? 0) + bytes;
    } catch {
      /* page fermée */
    }
  });
  return log;
}

export async function runtime(args) {
  const o = options(args);
  const want = (k) => o.only === null || o.only.has(k);
  const server = await serve(o);
  const state = await householdState(o.months);
  const browser = await chromium.launch({ args: o.swgl ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const browserCdp = await browser.newBrowserCDPSession();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  await context.addInitScript({ content: readFileSync(join(webRoot, 'scripts/perf-instrument.js'), 'utf8') });
  await context.addInitScript(
    ([s]) => {
      if (localStorage.getItem('a2-budget:account:v1') !== null) return;
      localStorage.setItem('a2-budget:account:v1', JSON.stringify({ entry: 'guest' }));
      localStorage.setItem('a2-budget:state:v1', s);
      localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', forestMotion: 'full', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true }));
    },
    [JSON.stringify(state)],
  );
  const net = netLog(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
  const ctx = { page, cdp, browserCdp };
  const result = { options: o, renderer: null, load: {}, windows: [] };

  // --- Premier chargement puis visite suivante --------------------------------
  let t = Date.now();
  await page.goto(server.url);
  await page.locator('.screen-sheet').waitFor();
  const firstPaint = Date.now() - t;
  result.renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const e = gl?.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'inconnu';
  });
  await page.evaluate(() => navigator.serviceWorker?.ready);
  const shellBytes = net.bytes;
  await sleep(15_000); // précache du SW, peintures de la saison à la demande
  result.load.first = { msToSheet: firstPaint, shellBytes, totalBytes: net.bytes, requests: net.count, byType: { ...net.byType } };
  const before = net.bytes;
  const lm0 = await metrics(cdp);
  t = Date.now();
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  const lm1 = await metrics(cdp);
  const ld = (k) => Math.round(((lm1[k] ?? 0) - (lm0[k] ?? 0)) * 1000);
  result.load.repeat = {
    msToSheet: Date.now() - t,
    mainThreadMs: ld('TaskDuration'),
    scriptMs: ld('ScriptDuration'),
    compileMs: ld('V8CompileDuration'),
    styleLayoutMs: ld('RecalcStyleDuration') + ld('LayoutDuration'),
    ...(await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return { domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0), fcp: Math.round(fcp?.startTime ?? 0) };
    })),
  };
  await sleep(4_000);
  result.load.repeat.networkBytes = net.bytes - before;
  console.log(`\n== Exécution (${result.renderer}, CPU ×${o.cpu}, foyer de ${o.months} mois) ==`);
  console.log(`  1er chargement : coquille en ${firstPaint} ms, ${mb(shellBytes)} avant l'écran, ${mb(result.load.first.totalBytes)} après précache (${net.count} requêtes)`);
  const rp = result.load.repeat;
  console.log(`  visite suivante : ${rp.msToSheet} ms (DOMContentLoaded ${rp.domContentLoaded} ms, 1re peinture ${rp.fcp} ms ; fil ${rp.mainThreadMs} ms dont JS ${rp.scriptMs}, compilation ${rp.compileMs}, style+mise en page ${rp.styleLayoutMs}), ${kb(rp.networkBytes)} sur le réseau`);

  if (want('tabs')) {
    for (const tab of TABS) {
      await goTo(page, tab);
      await sleep(4_000);
      result.windows.push(await measure(ctx, tab, o.seconds));
    }
  }
  if (want('idle')) {
    await goTo(page, 'Maison');
    await sleep(2_000);
    result.windows.push(await measure(ctx, `repos ${o.idle} s (Maison)`, o.idle));
  }
  if (want('hidden')) {
    for (const tab of ['Maison', 'Budget']) {
      await goTo(page, tab);
      await sleep(2_000);
      await page.evaluate(() => window.__perfHidden(true));
      await sleep(2_000);
      result.windows.push(await measure(ctx, `arrière-plan (${tab})`, o.seconds));
      await page.evaluate(() => window.__perfHidden(false));
    }
  }
  const variant = async (label, setup) => {
    await setup();
    await page.reload();
    await page.locator('.screen-sheet').waitFor();
    for (const tab of ['Maison', 'Budget']) {
      await goTo(page, tab);
      await sleep(4_000);
      result.windows.push(await measure(ctx, `${label} (${tab})`, o.seconds));
    }
  };
  const motion = (m) => page.evaluate((v) => {
    const ui = JSON.parse(localStorage.getItem('a2-budget:ui:v1') ?? '{}');
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ ...ui, forestMotion: v, module: 'maison' }));
  }, m);
  if (want('still')) await variant('« Immobile »', () => motion('still'));
  if (want('anims')) {
    // Coût de chaque animation CSS infinie de Maison (forêt immobile) : mise en pause une à une.
    await motion('still');
    await page.reload();
    await page.locator('.screen-sheet').waitFor();
    await goTo(page, 'Maison');
    await sleep(4_000);
    const names = await page.evaluate(() => [...new Set(document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName).filter(Boolean))]);
    result.windows.push(await measure(ctx, 'Maison immobile, anim. CSS', o.seconds));
    for (const name of names) {
      await page.evaluate((n) => document.getAnimations().filter((a) => a.animationName === n).forEach((a) => a.pause()), name);
      result.windows.push(await measure(ctx, `… sans ${name}`, o.seconds));
    }
  }
  if (want('reduced')) {
    await variant('mouvement réduit', async () => {
      await motion('full');
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  if (want('storage')) {
    result.storage = await deviceStorage(page);
    printStorage(result.storage);
  }
  await browser.close();
  server.stop();
  console.log(`JSON:${JSON.stringify(result)}`);
  return result;
}
