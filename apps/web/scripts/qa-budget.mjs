/**
 * QA agent THEME-BUDGET V3.2 : univers Chihiro de l'écran Budget.
 * Sans-Visage (pose selon le mois, salut, fondu), rigole d'or, Noiraude qui
 * traverse après une modification, kompeitō des dépenses, état vide.
 * États réalistes construits par @a2/core (validateAppState).
 *
 * Usage (serveur de dev déjà lancé, depuis la racine du dépôt) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5181 --strictPort &
 *   node apps/web/scripts/qa-budget.mjs [port]
 * Sorties : apps/web/qa/budget/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const port = Number(process.argv[2] ?? 5181);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'budget');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};
const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, `${name}.png`), ...opts });

/** Mois courant : salaires (€), compléments de B, dépenses (null = celles des réglages). */
async function seed(page, { a, b, bonusB = 0, expenses = null }) {
  await page.goto(`${APP}?module=budget`);
  const r = await page.evaluate(
    async ({ entry, a, b, bonusB, expenses }) => {
      const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
      const now = new Date();
      const s = core.emptyAppState();
      const key = core.currentMonthKey(now);
      const month = { ...core.createMonthRecord(key, s.budget.settings), salaryACents: a * 100, salaryBCents: b * 100, bonusBCents: bonusB * 100 };
      if (expenses !== null) month.expenses = expenses.map(([label, euros], i) => ({ id: `e-${i}`, label, amountCents: euros * 100 }));
      s.budget.months = [month];
      s.budget.selectedMonth = key;
      const v = core.validateAppState(s);
      if (!v.ok) return { ok: false, reason: v.reason };
      localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
      localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'budget', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      return { ok: true, summary: core.computeMonthSummary(month) };
    },
    { entry: coreEntry, a, b, bonusB, expenses },
  );
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.ledger').waitFor();
  await page.waitForTimeout(1600); // remplissage de la jauge
  return r.summary;
}

const pose = (page) => page.locator('.noface').getAttribute('data-pose');
const euros = (c) => `${(c / 100).toFixed(2)} €`;

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// --- 1. Les quatre humeurs du mois ------------------------------------------
const scenarios = [
  { name: '1-sain', input: { a: 2800, b: 3600 }, mood: 'offering' },
  { name: '2-modeste', input: { a: 2000, b: 3000 }, mood: 'calm' },
  { name: '3-serre', input: { a: 1850, b: 2900 }, mood: 'content' },
  { name: '4-deficit', input: { a: 1600, b: 2700 }, mood: 'shy' },
];
for (const sc of scenarios) {
  const s = await seed(page, sc.input);
  const got = await pose(page);
  const fill = Number(await page.locator('.gold-gauge').getAttribute('data-fill'));
  const nuggets = await page.locator('.gold-gauge__nugget.is-on').count();
  console.log(`     ${sc.name} : versé ${euros(s.householdContributionCents)}, dépenses ${euros(s.expensesTotalCents)}, reste ${euros(s.remainingCents)} → pose ${got}, jauge ${fill}, pépites ${nuggets}`);
  check(`${sc.name} : Sans-Visage « ${sc.mood} »`, got === sc.mood, got);
  if (sc.mood === 'shy') {
    check(`${sc.name} : déficit sobre, aucune pépite`, nuggets === 0 && (await page.locator('.gold-gauge--deficit').count()) === 1);
  } else {
    check(`${sc.name} : jauge = reste / versements`, Math.abs(fill - s.remainingCents / s.householdContributionCents) < 0.002, fill);
  }
  const restBox = await page.locator('[data-testid="remaining"]').boundingBox();
  check(`${sc.name} : le reste est au premier écran`, restBox !== null && restBox.y + restBox.height < 844 - 90, restBox);
  await shot(page, sc.name);
}

// Accessibilité : décor muet.
const alts = await page.locator('.budget img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));
check('toutes les images de l’univers ont alt=""', alts.length > 0 && alts.every((a) => a === ''), alts.length);
check('Sans-Visage et jauge masqués aux lecteurs d’écran',
  (await page.locator('.noface[aria-hidden="true"]').count()) === 1 && (await page.locator('.gold-gauge[aria-hidden="true"]').count()) === 1);

// --- 2. Kompeitō stables ------------------------------------------------------
await seed(page, scenarios[0].input);
const colors = await page.locator('.expense-list--konpeito .konpeito').evaluateAll((els) => els.map((e) => e.dataset.color));
await page.reload();
await page.locator('.ledger').waitFor();
const colorsAgain = await page.locator('.expense-list--konpeito .konpeito').evaluateAll((els) => els.map((e) => e.dataset.color));
check('une pastille kompeitō par dépense, couleur stable', colors.length > 0 && colors.join() === colorsAgain.join(), colors);
await page.locator('.expenses').scrollIntoViewIfNeeded();
await shot(page, '5-depenses-kompeito');

// --- 3. Noiraude qui traverse + salut du Sans-Visage ------------------------
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const salary = page.locator('#salary-a');
await salary.click();
await salary.fill('2 900');
await salary.blur();
await page.waitForTimeout(650);
check('après modification : une Noiraude traverse', (await page.locator('.susu-runner').count()) === 1);
check('après modification : le Sans-Visage salue', (await pose(page)) === 'bow', await pose(page));
check('revenus : la Noiraude porte un kompeitō jaune', (await page.locator('.susu-runner').getAttribute('data-carrier')) === 'carryYellow');
await shot(page, '6-noiraude-en-course');
await page.waitForTimeout(2200);
check('la Noiraude est repartie', (await page.locator('.susu-runner').count()) === 0);
check('le Sans-Visage reprend sa pose', (await pose(page)) === 'offering', await pose(page));

// Dépense : Noiraude de la couleur de la dépense.
const firstAmount = page.locator('.expense-list--konpeito .expense-row__amount input').first();
const firstColor = colors[0];
await firstAmount.scrollIntoViewIfNeeded();
await firstAmount.click();
await firstAmount.fill('999');
await firstAmount.blur();
await page.waitForTimeout(500);
const carrier = await page.locator('.susu-runner').getAttribute('data-carrier');
const expected = { pink: 'carryPink', yellow: 'carryYellow', green: 'carryGreen', white: 'jumpWhite' }[firstColor.replace('-2', '')] ?? 'carryBlueDuo';
check(`dépense « ${firstColor} » : Noiraude ${expected}`, carrier === expected, carrier);
await shot(page, '7-noiraude-depense');
await page.waitForTimeout(2200);

// --- 4. Changement d'humeur : fondu par la silhouette translucide -----------
await page.evaluate(() => window.scrollTo(0, 0));
await salary.click();
await salary.fill('300');
await salary.blur();
const seen = new Set();
for (let i = 0; i < 30; i += 1) {
  seen.add(await pose(page));
  await page.waitForTimeout(100);
}
console.log('     après 300 € :', await page.locator('[data-testid="remaining"]').textContent(), await page.locator('[data-testid="household-total"]').textContent(), await page.locator('.noface').getAttribute('data-mood'));
check('humeur qui change : salut → fondu → nouvelle pose', seen.has('bow') && seen.has('fading') && (await pose(page)) !== 'offering', [...seen]);
await shot(page, '8-apres-fondu');

// --- 5. État vide des dépenses ------------------------------------------------
await seed(page, { a: 2200, b: 3000, expenses: [] });
check('aucune dépense : Noiraude cachée', (await page.locator('.susu-empty__img').count()) === 1);
await page.locator('.expenses').scrollIntoViewIfNeeded();
await shot(page, '9-depenses-vides');

// --- 6. Mouvement réduit : pas de course ---------------------------------------
const reduced = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const rp = await reduced.newPage();
await seed(rp, scenarios[0].input);
const rs = rp.locator('#salary-b');
await rs.click();
await rs.fill('3 700');
await rs.blur();
await rp.waitForTimeout(300);
check('prefers-reduced-motion : aucune Noiraude ne traverse', (await rp.locator('.susu-runner').count()) === 0);
await reduced.close();

// --- 7. Bureau ------------------------------------------------------------------
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await desk.newPage();
await seed(dp, scenarios[1].input);
await shot(dp, '10-bureau');
await desk.close();

check('aucune erreur console', errors.length === 0, errors.slice(0, 3));
await browser.close();
console.log(failures.length === 0 ? '\nQA budget : tout est vert.' : `\nQA budget : ${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
