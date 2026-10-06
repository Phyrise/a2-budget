/**
 * QA COQUILLE V4 (téléphone 390×844, tactile).
 *
 * 1. Sons V4 — harnais Chromium : store réel (StrictMode) + useSoundEvents,
 *    état construit par les vraies actions (validateAppState ok). Vérifie le
 *    silence au premier rendu, puis : virement / dépense cochés (« nom »),
 *    décocher (rien), recalage du solde (cloche), lanterne de pierre allumée
 *    (allumette + souffle, pas à la reprise après pause), nouvelle lanterne
 *    débloquée (carillon, après la floraison) ; nœuds WebAudio créés sans
 *    erreur ; niveau et durée de chaque son (rendu hors ligne).
 * 2. Application : Courses, un article coché → le bandeau ne bouge pas
 *    (taille, position, transform, largeur de mise en page) ; planche de
 *    captures 0 / 150 / 300 / 600 ms.
 * 3. Calendrier : univers Totoro (bandeau paysage sur téléphone, accent),
 *    fond portrait sur ordinateur, forêt vivante seulement pour Maison.
 *
 * Usage (depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5185 --strictPort &
 *   node apps/web/scripts/qa-coquille-v4.mjs [port]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { harnessHtml, harnessTsx } from './qa-coquille-v4.harness.mjs';

const port = Number(process.argv[2] ?? 5185);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'coquille-v4');
mkdirSync(outDir, { recursive: true });
const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};
writeFileSync(join(outDir, 'harness.html'), harnessHtml);
writeFileSync(join(outDir, 'harness.tsx'), harnessTsx);

const origin = `http://localhost:${port}`;
const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const context = await browser.newContext(phone);
await context.addInitScript(() => {
  window.__nodes = 0;
  const proto = BaseAudioContext.prototype;
  for (const name of ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource', 'createConvolver']) {
    const orig = proto[name];
    proto[name] = function (...args) { window.__nodes++; return orig.apply(this, args); };
  }
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const settle = (ms = 300) => page.waitForTimeout(ms);
const take = () => page.evaluate(() => window.__records.splice(0).map((r) => r.cue));
const act = async (fn, arg, ms) => { await page.evaluate(fn, arg); await settle(ms); return take(); };

// --- 1. Sons V4 --------------------------------------------------------------
await page.goto(`${origin}/a2-budget/qa/coquille-v4/harness.html`);
await page.waitForFunction(() => window.__app?.appState != null);
await page.evaluate(() => { localStorage.clear(); });
await page.reload();
await page.waitForFunction(() => window.__app?.appState != null);
// État réaliste par les vraies actions : mois courant, salaires, dépenses, courses, 2 sessions de lanterne.
const KEY = await page.evaluate(async () => {
  const a = () => window.__app;
  const key = a().appState.budget.selectedMonth;
  a().setSalary(key, 'A', 2_450_00);
  await new Promise((r) => setTimeout(r, 30));
  a().setSalary(key, 'B', 2_180_00);
  await new Promise((r) => setTimeout(r, 30));
  for (const [label, cents] of [['Loyer', 1_120_00], ['Électricité', 68_00], ['Internet', 30_00]]) {
    a().addExpense(key, label, cents);
    await new Promise((r) => setTimeout(r, 30));
  }
  for (const g of ['Courgettes', 'Pain de campagne', '2 litres de lait', 'Riz japonais', 'Pommes']) {
    a().addGrocery(g);
    await new Promise((r) => setTimeout(r, 30));
  }
  for (let i = 0; i < 2; i++) {
    a().addFocusSession({ minutes: 10, who: i ? 'b' : 'a', label: 'Rangement' });
    await new Promise((r) => setTimeout(r, 30));
  }
  return key;
});
await settle(600);
const seeded = await page.evaluate(() => {
  const s = window.__app.appState;
  return { valid: window.__core.validateAppState(s).ok, expenses: window.__app.currentMonth.expenses.map((e) => [e.id, e.label]), sessions: s.focus?.sessions.length };
});
check('état réaliste valide (validateAppState)', seeded.valid, seeded);
await page.reload();
await page.waitForFunction(() => window.__app?.appState != null);
await settle(600);
check('premier rendu (rechargement) : aucun son', (await take()).length === 0);
await page.mouse.click(200, 400);
await settle(150);
check('premier geste : contexte audio débloqué', (await page.evaluate(() => window.__sound.state())) === 'running');
const loyer = seeded.expenses.find(([, l]) => l === 'Loyer')?.[0];
const nodes0 = await page.evaluate(() => window.__nodes);

// Même son à moins de 400 ms : regroupé par l'anti-rafale (gate.ts) — on laisse respirer.
let heard = await act((k) => window.__app.setTransferPaid(k, 'A', true), KEY, 500);
check('virement d’AL coché : « nom » du Sans-Visage', JSON.stringify(heard) === '["nom"]', heard);
const nodes1 = await page.evaluate(() => window.__nodes);
check('nœuds WebAudio créés pour « nom »', nodes1 - nodes0 > 3, { nodes0, nodes1 });
heard = await act(([k, id]) => window.__app.setExpensePaid(k, id, true), [KEY, loyer], 500);
check('loyer payé : « nom »', JSON.stringify(heard) === '["nom"]', heard);
await settle(300);
heard = await act(([k, id]) => { window.__app.setTransferPaid(k, 'B', true); window.__app.setExpensePaid(k, id, true); }, [KEY, seeded.expenses[1][0]], 500);
check('deux cases cochées coup sur coup : un seul « nom » (anti-rafale)', JSON.stringify(heard) === '["nom"]', heard);
heard = await act(([k, id]) => window.__app.setExpensePaid(k, id, false), [KEY, loyer]);
check('décocher : silence', heard.length === 0, heard);
heard = await act((k) => window.__app.recordBalanceCorrection(k, 1_234, undefined, { asOf: 'now' }), KEY);
check('recalage du solde : petite cloche', JSON.stringify(heard) === '["balanceBell"]', heard);
heard = await act(() => window.__lantern.start({ minutes: 10, who: 'a', label: 'Rangement' }));
check('lanterne de pierre allumée : allumette + souffle', JSON.stringify(heard) === '["lanternLit"]', heard);
heard = await act(() => { window.__lantern.pause(); });
heard.push(...(await act(() => { window.__lantern.resume(); })));
check('pause puis reprise : rien ne se rallume', heard.length === 0, heard);
heard = await act(() => { window.__lantern.stop(); window.__lantern.reset(); });
check('arrêter : silence', heard.length === 0, heard);
heard = await act(() => window.__app.addFocusSession({ minutes: 10, who: 'both', label: 'Rangement' }), undefined, 1400);
check('3e session : nouvelle lanterne débloquée → carillon', JSON.stringify(heard) === '["lanternNew"]', heard);
heard = await act(() => window.__app.importJson(window.__app.exportJson()));
check('import d’une sauvegarde : aucun son', heard.length === 0, heard);

for (const cue of ['nom', 'balanceBell', 'lanternLit', 'lanternNew']) {
  for (const gentle of [false, true]) {
    const m = await page.evaluate(([c, g]) => window.__measure(c, g), [cue, gentle]);
    const ok = !m.nan && m.peak > 0.01 && m.peak < 0.3 && m.end <= 1.8;
    check(`son ${cue}${gentle ? ' (doux)' : ''} : crête ${m.peak.toFixed(3)}, fin ${m.end.toFixed(2)} s`, ok, m);
  }
}
check('harnais sons : aucune erreur', errors.length === 0, errors);

// --- 2. Courses : cocher sans « zoom » ----------------------------------------
await page.goto(`${origin}/a2-budget/?module=courses`);
const banner = page.locator('.app-world__banner[data-universe="courses"]');
await banner.waitFor();
await page.waitForFunction(() => document.querySelector('.app-world__banner[data-universe="courses"]')?.classList.contains('is-shown'));
await settle(1200);
await page.evaluate(() => {
  const snap = () => {
    const img = document.querySelector('.app-world__banner[data-universe="courses"]');
    const head = document.querySelector('.app-header');
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return JSON.stringify([window.innerWidth, document.documentElement.scrollWidth, window.visualViewport?.scale ?? 1,
      Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), cs.transform, cs.scale,
      Math.round(head?.getBoundingClientRect().width ?? 0)]);
  };
  window.__zoom = { seen: new Set([snap()]), stop: false };
  const loop = () => { window.__zoom.seen.add(snap()); if (!window.__zoom.stop) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
const frames = [];
await page.getByRole('checkbox', { name: 'Courgettes', exact: true }).tap();
for (const at of [0, 150, 300, 600]) {
  const shot = join(outDir, `courses-${at}ms.jpg`);
  await page.screenshot({ path: shot, type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 390, height: 420 } });
  frames.push([at, shot]);
  await settle(at === 0 ? 150 : at === 150 ? 150 : 300);
}
const states = await page.evaluate(() => { window.__zoom.stop = true; return [...window.__zoom.seen]; });
check('Courses : le bandeau ne change ni de taille ni de transform après un cochage', states.length === 1, states);
check('Courses : largeur de mise en page = 390', JSON.parse(states[0])[0] === 390 && JSON.parse(states[0])[1] === 390, states[0]);
const planche = await browser.newPage({ viewport: { width: 4 * 201, height: 460 } });
await planche.setContent(`<body style="margin:0;background:#111;display:flex;gap:6px">${frames
  .map(([at, p]) => `<figure style="margin:0;color:#eee;font:12px sans-serif"><img src="data:image/jpeg;base64,${readFileSync(p).toString('base64')}" width="195"><figcaption>${at} ms après le cochage</figcaption></figure>`)
  .join('')}</body>`);
await planche.screenshot({ path: join(outDir, 'planche-courses.jpg'), type: 'jpeg', quality: 70 });
await planche.close();

// --- 3. Calendrier : univers Totoro ------------------------------------------
await page.goto(`${origin}/a2-budget/?module=calendar`);
const cal = page.locator('.app-world__banner[data-universe="calendar"]');
await cal.waitFor();
await page.waitForFunction(() => {
  const img = document.querySelector('.app-world__banner[data-universe="calendar"]');
  return img?.classList.contains('is-shown') && img.complete && img.naturalWidth > 0;
});
const calInfo = await page.evaluate(() => ({
  src: document.querySelector('.app-world__banner[data-universe="calendar"]').getAttribute('src'),
  accent: getComputedStyle(document.querySelector('.app')).getPropertyValue('--module-accent').trim(),
  canvasVisible: [...document.querySelectorAll('.app-world__stage canvas')].some((c) => c.getBoundingClientRect().height > 0 && getComputedStyle(c).visibility !== 'hidden'),
}));
check('Calendrier (téléphone) : bandeau Totoro', /calendar\/banner-landscape/.test(calInfo.src), calInfo);
check('Calendrier : accent de l’univers Totoro', calInfo.accent === '#9fd2b4', calInfo);
await settle(700);
await page.screenshot({ path: join(outDir, 'calendrier-telephone.jpg'), type: 'jpeg', quality: 60 });

const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
desk.on('pageerror', (e) => errors.push(String(e)));
await desk.goto(`${origin}/a2-budget/?module=calendar`);
await desk.waitForFunction(() => {
  const img = document.querySelector('.app-world__backdrop[data-universe="calendar"]');
  return img?.classList.contains('is-shown') && img.complete && img.naturalWidth > 0;
});
check('Calendrier (ordinateur) : fond portrait de Totoro', /calendar\/banner-portrait/.test(await desk.locator('.app-world__backdrop[data-universe="calendar"]').getAttribute('src')));
await desk.waitForTimeout(900);
await desk.screenshot({ path: join(outDir, 'calendrier-ordinateur.jpg'), type: 'jpeg', quality: 55 });
await desk.getByRole('button', { name: 'Maison', exact: true }).first().click();
await desk.waitForTimeout(900);
check('Maison (ordinateur) : aucun fond peint, la forêt vivante', (await desk.locator('.app-world__backdrop.is-shown').count()) === 0);
await desk.close();

check('aucune erreur dans les pages', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nQA coquille V4 : tout est vert.' : `\nQA coquille V4 : ${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
