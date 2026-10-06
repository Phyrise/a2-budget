/**
 * QA MONDE V4 (390×844) : envol de la luciole (non-régression), lanterne de
 * pierre (éteinte, allumée, floraison, 3 modèles), kodama assis sur le toit,
 * nuit, mouvement « immobile ».
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5183 --strictPort &
 *   node apps/web/scripts/qa-monde-v4.mjs [filtre]
 *
 * Sorties : apps/web/qa/monde-v4/*.png (gitignoré). Code de sortie 1 si une
 * vérification échoue. Le vol est vérifié dans la VRAIE application (store,
 * coquille, feuille) : pendant le vol, la tête lumineuse est au-dessus de la
 * feuille, dans la forêt, et la capture y est nettement plus claire qu'avant
 * le toucher — en haut de liste (scène vivante) comme après défilement
 * (scène figée par la coquille, `live: false`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { flightProbe, lanternBox, lumaAt } from './qa-monde-v4.lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const out = join(webRoot, 'qa', 'monde-v4');
mkdirSync(out, { recursive: true });
const ORIGIN = process.env.QA_ORIGIN ?? 'http://127.0.0.1:5183';
const BASE = `${ORIGIN}/a2-budget/`;
const LAB = `${BASE}world-lab.html?ui=0&lights=0&season=summer`;
const filter = process.argv[2] ?? '';
const VIEW = { width: 390, height: 844 };
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${label}`);
  if (!ok) failures.push(label);
};

writeFileSync(join(out, 'fixtures.html'), '<!doctype html><html><body><script type="module" src="../../scripts/qa-monde-v4.fixtures.ts"></script></body></html>');
const browser = await chromium.launch();
const fp = await browser.newPage();
await fp.goto(`${BASE}qa/monde-v4/fixtures.html`);
await fp.waitForFunction(() => window.__fixtures !== undefined);
const fixtures = await fp.evaluate(() => window.__fixtures);
await fp.close();

async function appPage(state, clock = false) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  await ctx.addInitScript(([s]) => {
    if (sessionStorage.getItem('qa-init')) return;
    sessionStorage.setItem('qa-init', '1');
    localStorage.setItem('a2-budget:state:v1', s);
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', forestMotion: 'full', guardianSeen: true, offlineAnnounced: true }));
  }, [state]);
  const page = await ctx.newPage();
  // Horloge pilotée (rAF, performance.now) : captures au bon moment du vol.
  if (clock) await page.clock.install();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector('.screen-sheet');
  await page.waitForFunction(() => window.__worldEngine?.stone?.model);
  await page.waitForTimeout(2500);
  return { page, ctx, errors };
}

/**
 * Coche une tâche et vérifie que sa lumière vole, visible, au-dessus de la
 * feuille. `scroll` : défilement de la page avant le toucher (la feuille
 * remonte, la forêt reste visible au-dessus d'elle) ; on coche alors la
 * première case non cochée bien visible.
 */
async function flight(name, title, scroll) {
  const { page, ctx, errors } = await appPage(fixtures.long, true);
  let box = page.getByRole('checkbox', { name: title, exact: true });
  if (scroll) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await page.waitForTimeout(900);
    const name = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')].find((c) => {
        const r = c.getBoundingClientRect();
        return r.top > 330 && r.bottom < 760 && c.getAttribute('aria-checked') !== 'true' && !c.checked;
      });
      return el?.getAttribute('aria-label') ?? el?.closest('label')?.textContent?.trim() ?? null;
    });
    if (name) box = page.getByRole('checkbox', { name, exact: true });
    console.log(`  ${name ?? title} (défilement ${scroll} px)`);
  }
  const live = await page.evaluate(() => window.__worldEngine.cfg.live);
  const clip = { x: 0, y: 0, width: VIEW.width, height: 528 };
  // Temps figé pendant le toucher, puis avancé par pas de 150 ms (images rendues à chaque pas).
  await page.clock.pauseAt(Date.now() + 1000);
  await page.clock.runFor(300);
  const before = await page.screenshot({ clip });
  await box.click();
  const samples = [];
  for (let i = 1; i <= 12; i++) {
    await page.clock.runFor(150);
    const ms = i * 150;
    const pre = await flightProbe(page);
    const shot = await page.screenshot({ path: join(out, `${name}-${String(ms).padStart(4, '0')}.png`), clip });
    samples.push({ ms, pre, post: pre, shot });
  }
  await page.clock.resume();
  const above = (h, top) => h && h.y < top - 6 && h.y > 0;
  const visible = samples.filter(({ pre, post }) => above(pre.head, pre.sheetTop) && above(post.head ?? pre.head, pre.sheetTop));
  const gain = ({ pre, post, shot }) => Math.max(...segment(pre.head, post.head ?? pre.head).map((p) => lumaAt(shot, p) - lumaAt(before, p)));
  const lit = visible.filter((smp) => gain(smp) > 18);
  // En haut de liste, la lumière jaillit au bord de la feuille dès la première image
  // (l’ancien vol partait sous la feuille : 7 captures sur 12 seulement).
  const need = scroll ? 1 : 9;
  console.log(`  ${name} : live=${live} · feuille ${samples[0].pre.sheetTop} px ·`, samples.map((smp) => `${smp.ms} ms ${smp.pre.head ? `k=${smp.pre.head.k} y=${smp.pre.head.y}` : '—'}`).join(' · '));
  check(samples[0].pre.head !== null, `${name} : la lumière est en vol juste après le toucher`);
  check(visible.length >= need, `${name} : la tête du vol passe au-dessus de la feuille (${visible.length} captures, ≥ ${need})`);
  check(lit.length >= need, `${name} : la capture est nettement plus claire là où passe la lumière (${lit.length} captures, ≥ ${need})`);
  check(errors.length === 0, `${name} : aucune erreur console${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
  return live;
}

async function lab(name, qs, act, wait = 3000) {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${LAB}&${qs}`);
  await page.waitForFunction(() => window.__worldEngine?.stone?.model);
  if (act) await page.evaluate(act);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(out, `${name}.png`), clip: { x: 0, y: 0, width: 390, height: 456 } });
  const info = await page.evaluate(() => {
    const e = window.__worldEngine;
    return { model: e.stone.model?.id, visit: !!e.stone.visit, painted: e.lantern.painted };
  });
  check(errors.length === 0, `${name} : aucune erreur (${info.model})`);
  await page.close();
  return info;
}

/** Points (5) du segment a → b. */
const segment = (a, b) => [0, 0.25, 0.5, 0.75, 1].map((k) => ({ x: Math.round(a.x + (b.x - a.x) * k), y: Math.round(a.y + (b.y - a.y) * k) }));

const run = (n) => !filter || n.includes(filter);

if (run('vol')) {
  const live = await flight('vol-haut', 'Arroser les plantes', 0);
  check(live === true, 'vol-haut : scène vivante en haut de liste');
  const frozen = await flight('vol-defile', 'Trier le courrier', 320);
  check(frozen === false, 'vol-defile : la coquille a figé la scène (live: false) avant le toucher');
}

if (run('app-lanterne')) {
  const { page, ctx, errors } = await appPage(fixtures.yukimi);
  const b = await lanternBox(page);
  await page.screenshot({ path: join(out, 'app-lanterne-yukimi.png') });
  check(b.model === 'yukimi', `app : la lanterne choisie (yukimi) est posée dans la forêt (${b.model})`);
  check(b.bottom < b.sheetTop - 8 && b.top > 40, `app : la lanterne est entière au-dessus de la feuille (${b.top}–${b.bottom} px, feuille ${b.sheetTop})`);
  check(errors.length === 0, 'app : aucune erreur console');
  await ctx.close();
}

if (run('lanterne')) {
  for (const model of ['kasuga-moss', 'yukimi', 'ancient-shrine']) {
    await lab(`lanterne-${model}-eteinte`, `model=${model}`);
    await lab(`lanterne-${model}-allumee`, `model=${model}`, () => window.__lab.focus(0.55, 'b'), 3500);
    await lab(`lanterne-${model}-floraison`, `model=${model}`, async () => {
      window.__lab.focus(0.95, 'a');
      await new Promise((r) => setTimeout(r, 2000));
      window.__lab.focus(1, 'a');
    }, 2700);
  }
  await lab('lanterne-changement', 'model=kasuga-moss', async () => {
    await new Promise((r) => setTimeout(r, 1500));
    window.__lab.set({ model: 'tachi-carved' });
  }, 700);
}

if (run('kodama')) {
  const a = await lab('kodama-assis', 'model=kasuga-moss', () => window.__lab.kodama(0), 2200);
  check(a.visit, 'kodama : il est assis sur le toit');
  await lab('kodama-deux-yukimi', 'model=yukimi', () => window.__lab.kodama(2), 2200);
  const b = await lab('kodama-floraison', 'model=oribe', async () => {
    window.__lab.kodama(3);
    await new Promise((r) => setTimeout(r, 1500));
    window.__lab.focus(1, 'both');
  }, 1800);
  check(!b.visit, 'kodama : la floraison le fait repartir');
}

if (run('nuit')) {
  await lab('nuit-eteinte', 'paused=1&model=oribe', () => window.__lab.kodama(1), 3500);
  await lab('nuit-allumee', 'paused=1&model=kotoji', () => window.__lab.focus(0.6, 'b'), 3500);
  await lab('immobile-allumee', 'motion=still&model=yukimi', () => window.__lab.focus(0.6, 'a'), 2500);
}

await browser.close();
console.log(failures.length ? `\n${failures.length} échec(s)` : '\nTout est vert.');
process.exit(failures.length ? 1 : 0);
