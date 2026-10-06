/**
 * QA d'intégration V4 (main, toutes les branches fusionnées), 390 × 844,
 * téléphone tactile, un seul parcours dans la vraie application :
 * Maison (envol de la luciole visible pendant le vol, lanterne de pierre
 * éteinte puis allumée par le bandeau compact, kodama assis, arrêt),
 * Carnet (silhouettes, lanternes, choix → la forêt change de modèle),
 * Calendrier (un seul +, note visible, tâches synchronisées avec Maison,
 * cochables le jour même, barrées une fois faites), Budget (aucun centime,
 * paiement coché → le Sans-Visage mange, solde estimé qui baisse),
 * Courses (cocher sans « zoom » du bandeau, rayon mémorisé).
 *
 * Usage (depuis la racine du dépôt, serveur de dev lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5186 --strictPort &
 *   node apps/web/scripts/qa-integration-v4.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/integration-v4/*.png, planche.jpg
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { flightProbe } from './qa-monde-v4.lib.mjs';
import { seedIntegrationState } from './qa-integration-v4.seed.mjs';

const port = Number(process.argv[2] ?? 5186);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'integration-v4');
mkdirSync(outDir, { recursive: true });
const APP = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';

const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok: Boolean(ok) });
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(detail));
};
const errors = [];
const shots = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`page: ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await page.goto(`${APP}?module=maison`);
const seeded = await page.evaluate(seedIntegrationState, { entry: coreEntry });
if (!seeded.ok) throw new Error(`État invalide : ${seeded.reason}`);
await page.reload();
await page.locator('.screen-sheet').waitFor();
await page.waitForFunction(() => window.__worldEngine?.stone?.model, undefined, { timeout: 20_000 });
await page.waitForTimeout(1500);

const shot = async (name, clip) => {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, ...(clip ? { clip } : {}) });
  shots.push(`${name}.png`);
};
const persisted = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const nav = async (id) => {
  await page.locator(`.app-nav__item--${id}`).click();
  await page.waitForTimeout(1200);
};
const engine = () =>
  page.evaluate(() => {
    const e = window.__worldEngine;
    return { model: e.stone.model?.id ?? null, lit: e.lantern.active, visit: e.stone.visit !== null };
  });
const FOREST = { x: 0, y: 0, width: 390, height: 520 };

// --- 1. Maison : lanterne éteinte, envol de la luciole -----------------------
{
  const e = await engine();
  check('Maison : Yukimi posée dans la forêt, éteinte', e.model === 'yukimi' && !e.lit, e);
  await shot('01-maison-eteinte', FOREST);
  const box = page.getByRole('checkbox', { name: /Arroser les plantes/ });
  await box.scrollIntoViewIfNeeded();
  await box.click();
  const samples = [];
  for (let i = 0; i < 14; i += 1) {
    await page.waitForTimeout(90);
    samples.push(await flightProbe(page));
    if (i === 3) await shot('02-envol');
  }
  const above = samples.filter((p) => p.head && p.head.y < p.sheetTop - 4);
  check('envol : la luciole vole au-dessus de la feuille (plusieurs images)', above.length >= 3, samples.map((p) => p.head && [p.head.y, p.sheetTop]));
  check('envol : la tâche est cochée', (await persisted()).chores.completions.some((c) => c.taskId === 't-plantes'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
}

// --- 2. Lanterne : minuteur compact, pierre allumée, kodama ------------------
{
  await page.getByRole('button', { name: /Options : Ranger le bureau/ }).click();
  const menu = page.getByRole('dialog', { name: 'Ranger le bureau', exact: true });
  await menu.getByRole('button', { name: '5 minutes', exact: true }).click();
  await menu.getByRole('button', { name: /Allumer une lanterne de 5 minutes/ }).click();
  await page.waitForTimeout(2600);
  const bar = page.locator('.lantern-bar');
  const barBox = await bar.boundingBox();
  const navBox = await page.locator('.app-nav').boundingBox();
  check('lanterne : bandeau compact au-dessus de la navigation', barBox && navBox && barBox.height <= 80 && barBox.y + barBox.height <= navBox.y + 1, { barBox, navBox });
  check('lanterne : aucune grande fenêtre', (await page.locator('dialog[open]').count()) === 0);
  const lit = await engine();
  check('lanterne : la pierre posée (Yukimi) est allumée dans la forêt', lit.lit && lit.model === 'yukimi', lit);
  await page.evaluate(() => {
    const e = window.__worldEngine;
    e.stone.visitNow(performance.now() / 1000, 0);
    e.requestFrame(true);
  });
  await page.waitForTimeout(2200);
  check('lanterne : un kodama est assis sur la pierre', (await engine()).visit);
  await shot('03-lanterne-allumee-kodama');
  await bar.getByRole('button', { name: 'Arrêter la lanterne' }).click();
  await page.waitForTimeout(2500);
  const off = await page.evaluate(() => {
    const l = window.__worldEngine.lantern;
    return { target: l.target, on: Math.round(l.on * 1000) / 1000 };
  });
  console.log('     lanterne après arrêt', JSON.stringify(off));
  check('lanterne : arrêtée, la pierre s’éteint et le bandeau s’en va', off.target === null && (await bar.count()) === 0, { off, bar: await bar.count() });
}

// --- 3. Carnet : silhouettes, lanternes, choix ---------------------------------
{
  await page.getByRole('button', { name: 'Carnet de la forêt' }).click();
  const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
  await carnet.waitFor();
  await page.waitForTimeout(800);
  const unmet = await carnet.locator('.carnet-creature.is-unmet img').evaluateAll((imgs) => imgs.map((i) => i.src));
  check('carnet : créatures non rencontrées en silhouettes', unmet.length > 0 && unmet.every((s) => /silhouette-/.test(s)), unmet);
  const locked = await carnet.locator('.carnet-lantern.is-locked img').evaluateAll((imgs) => imgs.map((i) => i.src));
  check('carnet : lanternes verrouillées en silhouettes (4)', locked.length === 4 && locked.every((s) => /silhouette/.test(s)), locked);
  const pick = carnet.getByRole('button', { name: /^Poser .*Oribe/ });
  await pick.scrollIntoViewIfNeeded();
  await shot('04-carnet-lanternes');
  await pick.click();
  await page.waitForTimeout(400);
  check('carnet : l’Oribe est choisie', (await persisted()).focus.selectedLantern === 'oribe');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if ((await page.locator('dialog[open]').count()) > 0) await carnet.getByRole('button', { name: /Fermer/ }).first().click();
  await page.waitForFunction(() => window.__worldEngine.stone.model?.id === 'oribe', undefined, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  check('carnet : la forêt montre l’Oribe', (await engine()).model === 'oribe');
  await shot('05-oribe-posee', FOREST);
}

// --- 4. Calendrier : un seul +, note, tâches synchronisées ---------------------
{
  await nav('calendar');
  check('calendrier : un seul bouton « + »', (await page.locator('button[aria-label^="Ajouter un événement"]').count()) === 1);
  const cal = await page.locator('.calendar').innerText();
  check('calendrier : la note se voit (première ligne)', /Inès apporte les olives/.test(cal) && !/Réserver la terrasse/.test(cal));
  const today = page.locator('.cal-task[data-task-id="t-plantes"]').first();
  check('calendrier : la tâche cochée dans Maison est barrée', (await today.getAttribute('class'))?.includes('is-done'));
  check('calendrier : pas de tâche quotidienne', (await page.locator('.cal-task[data-task-id="t-vaisselle"]').count()) === 0);
  await today.getByRole('checkbox').click();
  await page.waitForTimeout(500);
  check('calendrier : décocher depuis le Calendrier', !(await persisted()).chores.completions.some((c) => c.taskId === 't-plantes'));
  await today.getByRole('checkbox').click();
  await page.waitForTimeout(500);
  check('calendrier : recocher depuis le Calendrier', (await persisted()).chores.completions.some((c) => c.taskId === 't-plantes'));
  await shot('06-calendrier');
  await nav('maison');
  const box = page.getByRole('checkbox', { name: /Arroser les plantes/ });
  check('Maison : la tâche cochée au Calendrier est faite', (await box.getAttribute('aria-checked')) === 'true' || (await box.isChecked()));
}

// --- 5. Budget : euros entiers, paiement → le Sans-Visage mange -----------------
{
  await nav('budget');
  await page.locator('[data-testid="balance-now"]').waitFor();
  const text = await page.locator('.budget').innerText();
  check('budget : aucun centime, plus de « Reste »', !/\d,\d{2}\s?€/u.test(text) && !/\bReste\b/u.test(text), text.match(/\d,\d{2}\s?€/u)?.[0]);
  const euros = (s) => Number(s.replace(/[^\d−-]/g, '').replace('−', '-'));
  const before = euros(await page.getByTestId('balance-now').innerText());
  const row = page.getByTestId('pay-transfer-b');
  await row.scrollIntoViewIfNeeded();
  await row.getByRole('checkbox').click();
  await page.waitForTimeout(650);
  await shot('07-budget-mange');
  const eating = await page.locator('.noface.is-eating').count();
  check('budget : le Sans-Visage mange au cochage', eating > 0, eating);
  await page.waitForTimeout(1500);
  const after = euros(await page.getByTestId('balance-now').innerText());
  check('budget : le virement d’AC coché augmente le solde estimé', after > before, { before, after });
  const st = await persisted();
  const cur = st.budget.months.find((mo) => mo.monthKey === st.budget.selectedMonth) ?? st.budget.months.at(-1);
  check('budget : virement d’AC enregistré comme fait', cur.paid?.transferB === true, cur.paid);
}

// --- 6. Courses : pas de zoom, rayon mémorisé ------------------------------------
{
  await nav('courses');
  await page.evaluate(() => {
    window.__banner = [];
    const t0 = performance.now();
    const loop = () => {
      const b = document.querySelector('.app-world__banner');
      const r = b?.getBoundingClientRect();
      window.__banner.push(`${Math.round(r?.width ?? 0)}x${Math.round(r?.height ?? 0)}|${document.documentElement.scrollWidth}`);
      if (performance.now() - t0 < 800) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.getByRole('checkbox', { name: /Pommes/ }).click();
  await page.waitForTimeout(950);
  const frames = await page.evaluate(() => [...new Set(window.__banner)]);
  check('courses : le bandeau ne bouge pas au cochage', frames.length === 1 && frames[0].endsWith('|390'), frames);
  await page.getByRole('button', { name: /^Modifier Café/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('#item-category').selectOption({ label: 'Boissons' });
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^Retirer Café/ }).click();
  await page.waitForTimeout(500);
  await page.locator('#grocery-input').fill('café');
  await page.locator('#grocery-input').press('Enter');
  await page.waitForTimeout(700);
  const aisle = await page.locator('.aisle').filter({ has: page.locator('.item-row', { hasText: /Café/ }) }).locator('.aisle__title').innerText();
  check('courses : « café » revient dans Boissons', /Boissons/i.test(aisle), aisle);
  await shot('08-courses');
}

check('aucune erreur console', errors.length === 0, errors);

// Planche réduite.
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(4,390px);gap:6px;padding:6px">${shots
  .map((s) => `<img src="file://${join(outDir, s)}" style="width:390px;height:auto;align-self:start">`)
  .join('')}</body>`;
writeFileSync(join(outDir, 'planche.html'), html);
const board = await browser.newPage({ viewport: { width: 1590, height: 900 } });
await board.goto(`file://${join(outDir, 'planche.html')}`);
await board.waitForTimeout(400);
await board.screenshot({ path: join(outDir, 'planche.png'), fullPage: true });
await browser.close();
try {
  execFileSync('sips', ['-Z', '1400', '-s', 'format', 'jpeg', join(outDir, 'planche.png'), '--out', join(outDir, 'planche.jpg')], { stdio: 'ignore' });
} catch {
  // sips absent : la planche PNG suffit.
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications ok`);
process.exit(failed.length === 0 ? 0 : 1);
