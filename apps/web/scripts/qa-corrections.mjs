/**
 * QA des corrections V3 (agent CORRECTIONS) : extinction de la lanterne de la
 * forêt, focus après cochage, bulle au-dessus du toast, focus jamais sous la
 * barre, descriptions des lignes, captures (Jiji en petit, gestes de la
 * semaine, date du héros). État V2 réaliste construit par @a2/core.
 *
 * Usage (serveur de dev déjà lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5187 --strictPort &
 *   node apps/web/scripts/qa-corrections.mjs [port]
 * Sorties : apps/web/qa/corrections/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5187);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'corrections');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function seed(page) {
  await page.goto(`${APP}?module=maison`);
  const r = await page.evaluate(async ({ entry }) => {
    const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
    const now = new Date();
    const day = (n) => {
      const d = core.addDays(now, n);
      d.setHours(19, 30, 0, 0);
      return d;
    };
    let s = core.emptyAppState();
    s.budget.settings.personA.name = 'AL';
    s.budget.settings.personB.name = 'AC';
    const created = core.localDateKey(day(-20));
    const mk = (input) => core.createTask(input, created);
    const tasks = [
      mk({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily', effort: 1 }),
      mk({ id: 't-vaisselle', title: 'Vider le lave-vaisselle', assignee: 'a', recurrence: 'daily', rotation: true, effort: 2 }),
      mk({ id: 't-sdb', title: 'Nettoyer la salle de bain', assignee: 'b', recurrence: 'daily', effort: 3 }),
      mk({ id: 't-linge', title: 'Plier le linge', assignee: 'both', recurrence: 'daily', effort: 2 }),
      mk({ id: 't-courrier', title: 'Trier le courrier', assignee: 'a', recurrence: 'daily', effort: 1 }),
      mk({ id: 't-aspi', title: 'Passer l’aspirateur', assignee: 'a', recurrence: 'daily', effort: 2 }),
      mk({ id: 't-plombier', title: 'Appeler le plombier', assignee: 'b', recurrence: 'daily', effort: 1 }),
      mk({ id: 't-fleurs', title: 'Changer l’eau des fleurs', assignee: 'b', recurrence: 'daily', effort: 1 }),
    ];
    s = { ...s, chores: { ...s.chores, tasks } };
    let n = 0;
    const toggle = (id, d, doneBy) => {
      n += 1;
      s = core.toggleTaskToday(s, id, d, `c-${n}`, doneBy ? { doneBy } : {}).state;
    };
    for (let k = 6; k >= 1; k--) {
      toggle('t-vaisselle', day(-k));
      toggle('t-plantes', day(-k), k % 2 ? 'b' : undefined);
      if (k % 2 === 0) toggle('t-linge', day(-k), 'a');
    }
    const v = core.validateAppState(s);
    if (!v.ok) return { ok: false, reason: v.reason };
    localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    return { ok: true };
  }, { entry: coreEntry });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  // Instrumente la lanterne de la forêt (même module que l'app en dev).
  await page.evaluate(async () => {
    const mod = await import('/a2-budget/src/world/engine/Engine.ts');
    window.__focus = [];
    const orig = mod.WorldEngine.prototype.focus;
    mod.WorldEngine.prototype.focus = function (p, who) {
      window.__focus.push(p);
      window.__engine = this;
      return orig.call(this, p, who);
    };
  });
  await page.waitForTimeout(600);
}

/** Défilement sans attendre la stabilité (machine chargée, scène animée). */
const reveal = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));

const lastFocus = (page) => page.evaluate(() => ({ calls: window.__focus.slice(-3), active: window.__engine?.lantern.active ?? null }));

async function openLantern(page) {
  const bar = page.locator('section.rituals');
  await reveal(bar);
  await bar.getByRole('button', { name: /lanterne/i }).click({ force: true });
  const dialog = page.getByRole('dialog', { name: 'Allumer une lanterne' });
  await dialog.waitFor();
  await dialog.locator('.ritual-chip').first().click({ force: true });
  await dialog.getByRole('button', { name: 'Allumer la lanterne' }).click({ force: true });
  const running = page.getByRole('dialog', { name: 'Lanterne allumée', exact: true });
  await running.waitFor();
  return running;
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const newPage = async (clock = false) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(Number(process.env.QA_TIMEOUT ?? 120_000)); // machine parfois très chargée
  page.on('pageerror', (e) => errors.push(String(e)));
  if (clock) await page.clock.install();
  await seed(page);
  return page;
};

// 1. Lanterne arrêtée avant 1 min → extinction (SKIP_LANTERN=1 pour passer).
if (!process.env.SKIP_LANTERN) {
  const page = await newPage();
  const running = await openLantern(page);
  await page.waitForTimeout(2500);
  await running.getByRole('button', { name: /Arrêter/ }).click({ force: true });
  await page.waitForTimeout(3000);
  const f = await lastFocus(page);
  check('lanterne : Arrêter avant 1 min éteint la forêt', f.calls.at(-1) === null, JSON.stringify(f));
  await page.context().close();
}

// 2. Floraison puis « Fermer » tout de suite → extinction.
if (!process.env.SKIP_LANTERN) {
  const page = await newPage(true);
  await openLantern(page);
  await page.clock.fastForward('26:00');
  const done = page.getByRole('dialog', { name: 'Lanterne', exact: true });
  await done.waitFor();
  await done.getByRole('button', { name: 'Fermer', exact: true }).last().click({ force: true });
  await page.clock.runFor(5000);
  await page.waitForTimeout(300);
  const f = await lastFocus(page);
  check('lanterne : Fermer pendant la floraison éteint la forêt', f.calls.at(-1) === null, JSON.stringify(f));
  await page.context().close();
}

// 3. Focus après cochage clavier, descriptions, toast/bulle, focus sous la barre.
{
  const page = await newPage();
  const box = page.getByRole('checkbox', { name: 'Arroser les plantes', exact: true });
  await box.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);
  const active = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, label: el?.getAttribute('aria-label') ?? el?.textContent?.slice(0, 30) };
  });
  check('focus gardé dans la liste après cochage', active.tag !== 'BODY', JSON.stringify(active));

  const desc = await page.getByRole('checkbox', { name: 'Vider le lave-vaisselle', exact: true }).evaluate((el) => document.getElementById(el.getAttribute('aria-describedby'))?.textContent);
  check('case : description « tour d’… »', /Tour d’A[LC]/.test(desc ?? ''), desc);
  const opt = page.getByRole('button', { name: 'Options : Nettoyer la salle de bain', exact: true });
  const optDesc = await opt.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby'))?.textContent);
  check('bouton options : nom + description « corvée »', /corvée/.test(optDesc ?? ''), optDesc);

  // Focus clavier depuis le haut : jamais sous la barre de navigation.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('body').focus();
  let covered = 0;
  for (let i = 0; i < (process.env.SKIP_TAB ? 0 : 24); i++) {
    await page.keyboard.press('Tab');
    const hidden = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const r = el.getBoundingClientRect();
      if (r.height === 0) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && !el.contains(hit) && hit.closest('.app-nav, .app-header') !== null;
    });
    if (hidden) covered += 1;
  }
  check('focus clavier jamais sous la barre / l’en-tête', covered === 0, `${covered} élément(s) masqué(s)`);

  // « Pas aujourd'hui » avec la bulle flottante (liste défilée).
  await reveal(page.getByRole('button', { name: 'Options : Trier le courrier', exact: true }));
  await page.evaluate(() => window.scrollBy(0, 260));
  await page.getByRole('button', { name: 'Options : Trier le courrier', exact: true }).click({ force: true });
  const skipBtn = page.getByRole('button', { name: /Pas aujourd’hui/ });
  await skipBtn.waitFor();
  await page.waitForTimeout(800);
  await skipBtn.dispatchEvent('click');
  await page.waitForTimeout(900);
  const overlap = await page.evaluate(() => {
    const t = document.querySelector('.toast')?.getBoundingClientRect();
    const b = document.querySelector('.cbubble-region--floating .cbubble')?.getBoundingClientRect();
    if (!t || !b) return { t: !!t, b: !!b, overlap: null };
    const region = document.querySelector('.cbubble-region--floating');
    return {
      lift: getComputedStyle(document.documentElement).getPropertyValue('--toast-lift'),
      regionBottom: region ? getComputedStyle(region).bottom : null,
      toastH: t.height,
      overlap: !(b.bottom <= t.top || b.top >= t.bottom || b.right <= t.left || b.left >= t.right), b: b.bottom, t: t.top };
  });
  check('bulle flottante au-dessus du toast', overlap.overlap === false || overlap.b === false, JSON.stringify(overlap));
  await page.screenshot({ path: join(outDir, 'm-01-toast-bulle.png'), timeout: 300_000 });

  // Équilibre : gestes de la semaine.
  const detail = page.locator('.balance__detail');
  await reveal(detail);
  await detail.locator('summary, button').first().dispatchEvent('click');
  await page.waitForTimeout(400);
  const txt = await detail.innerText();
  check('gestes de la semaine sans « ×N »', !/×\d/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 160));
  await detail.screenshot({ path: join(outDir, 'm-02-gestes.png'), timeout: 300_000 });

  // Haut de page : date du héros + Jiji en petit dans les lignes.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'm-03-haut.png'), timeout: 300_000 });
  await page.context().close();
}

await browser.close();
if (errors.length) console.log('Erreurs page :', errors.slice(0, 5));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} vérifications`);
process.exit(failed ? 1 : 0);
