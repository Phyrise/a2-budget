/**
 * QA agent DOMAINE V3.1 — revenus salaire + compléments, taux communs.
 * Exerce le store réel (React 19, StrictMode, localStorage) dans Chromium,
 * sans dépendre des écrans.
 *
 * Usage (serveur de dev déjà lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5193 --strictPort &
 *   node apps/web/scripts/qa-revenus.mjs [port]
 *
 * Harnais (gitignoré) dans apps/web/qa/revenus/ : monte <AppProvider> en
 * StrictMode et expose le contexte (window.__app) et @a2/core (window.__core).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5193);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'revenus');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, 'harness.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QA revenus</title></head>
<body><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'harness.tsx'),
  `import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as core from '@a2/core';
import { AppProvider, useApp } from '../../src/state/store';

(window as unknown as { __core: unknown }).__core = core;
function Expose() {
  const ctx = useApp();
  useEffect(() => { (window as unknown as { __app: unknown }).__app = ctx; }, [ctx]);
  return <pre id="state">{ctx.appState ? 'ready' : 'loading'}</pre>;
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><AppProvider><Expose /></AppProvider></StrictMode>,
);
`,
);

const KEY = 'a2-budget:state:v1';
const url = `http://localhost:${port}/a2-budget/qa/revenus/harness.html`;
const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const ready = () => page.waitForFunction(() => window.__app?.appState != null);
const settle = () => page.waitForTimeout(200);
const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

// --- 1. Données d'avant V3.1 : un état V2 réaliste, mois au modèle à seuil ---
await page.goto(url);
await page.waitForFunction(() => window.__core != null);
const legacy = await page.evaluate(() => {
  const c = window.__core;
  const app = c.emptyAppState();
  const key = c.currentMonthKey();
  const prev = c.currentMonthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const strip = (m) => { const { bonusACents, bonusBCents, ...rest } = m; return rest; };
  const current = strip({ ...c.createMonthRecord(key, app.budget.settings), salaryACents: 220000, salaryBCents: 367500 });
  const older = strip({ ...c.createMonthRecord(prev, app.budget.settings), salaryACents: 180000, salaryBCents: 341000 });
  app.budget.months = [older, current];
  app.budget.selectedMonth = key;
  app.chores.tasks.push(c.createTask({ id: 't-1', title: 'Arroser', assignee: 'a', recurrence: 'daily' }, c.localDateKey(new Date())));
  return { app, key, prev, valid: c.validateAppState(app).ok };
});
check('état ancien format valide (validateAppState accepte les deux formes)', legacy.valid);
await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, legacy.app]);
await page.reload();
await ready();
await settle();

const loaded = await page.evaluate((key) => {
  const app = window.__app;
  const month = app.appState.budget.months.find((m) => m.monthKey === key);
  return { month, summary: app.currentSummary };
}, legacy.key);
check('chargement : B 3675 € → salaire 3000 € + compléments 675 €',
  loaded.month.salaryBCents === 300000 && loaded.month.bonusBCents === 67500, loaded.month);
check('chargement : A 2200 € → salaire 2200 € + compléments 0 €',
  loaded.month.salaryACents === 220000 && loaded.month.bonusACents === 0, loaded.month);
check('contributions inchangées : A 880 €, B 1335 €, total 2215 €, reste 370 €',
  loaded.summary.contributionACents === 88000 && loaded.summary.contributionBCents === 133500 &&
  loaded.summary.householdContributionCents === 221500 && loaded.summary.remainingCents === 37000,
  loaded.summary);
check('le détail expose base et compléments',
  loaded.summary.breakdownB.baseIncomeCents === 300000 && loaded.summary.breakdownB.variableIncomeCents === 67500,
  loaded.summary.breakdownB);
const afterLoad = await stored();
const older = afterLoad.budget.months.find((m) => m.monthKey === legacy.prev);
check('mois précédent normalisé (A 1800 € sous la base, B 3410 € → 3000 € + 410 €)',
  older.salaryACents === 180000 && older.bonusACents === 0 && older.salaryBCents === 300000 && older.bonusBCents === 41000, older);
check('sauvegarde normalisée et valide', await page.evaluate((s) => window.__core.validateAppState(s).ok, afterLoad));
check('tâches intactes', afterLoad.chores.tasks.length === 1 && afterLoad.chores.tasks[0].title === 'Arroser');

// --- 2. Saisie : salaire + compléments (critère de réussite) -----------------
await page.evaluate((key) => {
  const app = window.__app;
  app.setSalary(key, 'B', 300000);
  app.setBonus(key, 'B', 0);
}, legacy.key);
await settle();
check('B sans compléments → 1200 €', await page.evaluate(() => window.__app.currentSummary.contributionBCents) === 120000);
await page.evaluate((key) => window.__app.setBonus(key, 'B', 67500), legacy.key);
await settle();
const criterion = await page.evaluate(() => window.__app.currentSummary);
check('critère : A 880 €, B 1335 €, total 2215 €, dépenses 1845 €, reste 370 €',
  criterion.contributionACents === 88000 && criterion.contributionBCents === 133500 &&
  criterion.householdContributionCents === 221500 && criterion.expensesTotalCents === 184500 &&
  criterion.remainingCents === 37000, criterion);
await page.evaluate((key) => { window.__app.setBonus(key, 'A', -5); window.__app.setBonus(key, 'A', 1.5); }, legacy.key);
await settle();
check('compléments invalides ignorés', await page.evaluate((key) =>
  window.__app.appState.budget.months.find((m) => m.monthKey === key).bonusACents, legacy.key) === 0);

// --- 3. Taux communs -----------------------------------------------------------
await page.evaluate(() => window.__app.setSharedRates(3500, 2500));
await settle();
const rates = await page.evaluate(() => ({
  settings: window.__app.appState.budget.settings,
  summary: window.__app.currentSummary,
  shared: window.__core.sharedRates(window.__app.appState.budget.settings),
}));
check('setSharedRates écrit les deux personnes',
  rates.settings.personA.baseRateBps === 3500 && rates.settings.personB.baseRateBps === 3500 &&
  rates.settings.personA.variableRateBps === 2500 && rates.settings.personB.variableRateBps === 2500, rates.settings);
check('les réglages ne recalculent pas le mois existant', rates.summary.contributionBCents === 133500, rates.summary);
await page.evaluate((key) => window.__app.setMonthSharedRates(key, 3500, 2500), legacy.key);
await settle();
const monthRates = await page.evaluate(() => window.__app.currentSummary);
// A : 35 % × 2200 = 770 ; B : 35 % × 3000 + 25 % × 675 = 1050 + 168,75 → 1218,75
check('setMonthSharedRates applique les taux au mois (A 770 €, B 1218,75 €)',
  monthRates.contributionACents === 77000 && monthRates.contributionBCents === 121875, monthRates);
await page.evaluate(() => { window.__app.setSharedRates(-1, 2000); window.__app.setSharedRates(4000, 10001); });
await settle();
check('taux invalides ignorés', await page.evaluate(() => window.__app.appState.budget.settings.personA.baseRateBps) === 3500);

// --- 4. Nouveau mois : salaire habituel, compléments 0 -------------------------
await page.evaluate(() => window.__app.updatePersonSettings('B', { baseSalaryCents: 310000 }));
await settle();
const nextKey = await page.evaluate(() => window.__core.currentMonthKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)));
await page.evaluate((k) => window.__app.selectMonth(k), nextKey);
await settle();
const fresh = await page.evaluate((k) => window.__app.appState.budget.months.find((m) => m.monthKey === k), nextKey);
check('nouveau mois : salaire habituel prérempli, compléments 0, taux communs',
  fresh.salaryBCents === 310000 && fresh.bonusACents === 0 && fresh.bonusBCents === 0 &&
  fresh.personA.baseRateBps === 3500 && fresh.personB.baseRateBps === 3500, fresh);

// --- 5. Rechargement : rien ne bouge ---------------------------------------------
const before = await stored();
await page.reload();
await ready();
await settle();
const after = await stored();
check('rechargement : budget strictement identique', JSON.stringify(after.budget) === JSON.stringify(before.budget));

check('aucune erreur console', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nQA revenus : tout est vert.' : `\nQA revenus : ${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
