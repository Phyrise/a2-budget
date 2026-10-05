/**
 * QA DOMAINE V4 : exerce le store réel (React 19, StrictMode, localStorage)
 * dans Chromium, sans dépendre des écrans — paiements du mois, solde du
 * compte commun, mémoire des rayons, lanterne choisie, rechargement.
 *
 * Usage (depuis la racine du dépôt, serveur de dev lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5197 --strictPort &
 *   node apps/web/scripts/qa-domaine-v4.mjs 5197
 *
 * Harnais (gitignoré) écrit dans apps/web/qa/domaine-v4/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5197);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'domaine-v4');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, 'harness.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QA domaine V4</title></head>
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
const url = `http://localhost:${port}/a2-budget/qa/domaine-v4/harness.html`;
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

await page.goto(url);
await page.evaluate((k) => localStorage.removeItem(k), KEY);
await page.reload();
const ready = () => page.waitForFunction(() => window.__app?.appState != null);
const settle = () => page.waitForTimeout(200);
await ready();

// --- Paiements du mois ------------------------------------------------------
const month = await page.evaluate(() => window.__app.appState.budget.selectedMonth);
let r = await page.evaluate((m) => [
  window.__app.setTransferPaid(m, 'A', true),
  window.__app.setTransferPaid(m, 'A', true),
  window.__app.setExpensePaid(m, 'rent', true),
  window.__app.setExpensePaid(m, 'inconnue', true),
], month);
await settle();
check('cases cochées (doublon et dépense inconnue ignorés)', JSON.stringify(r) === '[true,false,true,false]', r);
let paid = await page.evaluate((m) => window.__app.appState.budget.months.find((x) => x.monthKey === m).paid, month);
check('paid minimal', JSON.stringify(paid) === '{"transferA":true,"expenses":{"rent":true}}', paid);

await page.evaluate((m) => window.__app.removeExpense(m, 'rent'), month);
await settle();
paid = await page.evaluate((m) => window.__app.appState.budget.months.find((x) => x.monthKey === m).paid, month);
check('dépense retirée → case nettoyée', JSON.stringify(paid) === '{"transferA":true}', paid);

// --- Solde du compte commun --------------------------------------------------
r = await page.evaluate((m) => window.__app.recordBalanceCorrection(m, -120, 'Relevé'), month);
await settle();
let bal = await page.evaluate((m) => {
  const { openingBalance, currentBalanceEstimate } = window.__core;
  const b = window.__app.appState.budget;
  return { opening: openingBalance(b, m), now: currentBalanceEstimate(b, m), corrections: b.balance.corrections };
}, month);
check('recalage au début du mois (négatif)', r === true && bal.opening === -12_000 && bal.corrections.length === 1, bal);

r = await page.evaluate((m) => window.__app.recordBalanceCorrection(m, 2000, undefined, { asOf: 'now' }), month);
await settle();
bal = await page.evaluate((m) => {
  const { currentBalanceEstimate } = window.__core;
  const b = window.__app.appState.budget;
  return { now: currentBalanceEstimate(b, m), n: b.balance.corrections.length };
}, month);
check('recalage « en ce moment » : une seule correction par mois', r === true && bal.now === 200_000 && bal.n === 1, bal);
check('saisie invalide refusée', (await page.evaluate((m) => window.__app.recordBalanceCorrection(m, 1.5), month)) === false);

// Une modification du budget (mutate) garde le solde.
await page.evaluate((m) => window.__app.setSalary(m, 'A', 230_000), month);
await settle();
check('setSalary garde budget.balance', await page.evaluate(() => window.__app.appState.budget.balance?.corrections.length === 1));

// --- Courses : mémoire des rayons ---------------------------------------------
const added = await page.evaluate(() => window.__app.addGrocery('tomates'));
await settle();
await page.evaluate((id) => window.__app.updateGrocery(id, { category: 'epicerie' }), added.item.id);
await settle();
await page.evaluate((id) => window.__app.toggleGrocery(id), added.item.id);
await settle();
const again = await page.evaluate(() => window.__app.addGrocery('2 Tomates'));
await settle();
check('mémoire des rayons appliquée au prochain ajout', again.added && again.item.category === 'epicerie', again);
const mem = await page.evaluate(() => window.__app.appState.groceries.categoryMemory);
check('mémoire enregistrée', JSON.stringify(mem) === '{"tomate":"epicerie"}', mem);

// --- Lanternes ------------------------------------------------------------------
check('lanterne verrouillée refusée', (await page.evaluate(() => window.__app.selectLantern('yukimi'))) === false);
await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__app.addFocusSession({ minutes: 10, who: 'a' }); });
await settle();
check('lanterne débloquée choisie', (await page.evaluate(() => window.__app.selectLantern('yukimi'))) === true);
await page.evaluate(() => window.__app.addFocusSession({ minutes: 5, who: 'b' }));
await settle();
check('le choix survit à une nouvelle session', await page.evaluate(() =>
  window.__core.activeLantern(window.__app.appState.focus) === 'yukimi' && window.__app.appState.focus.sessions.length === 4));

// --- Rechargement : tout est relu à l'identique ----------------------------------
await settle();
const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
await page.reload();
await ready();
await settle();
const after = await page.evaluate(() => JSON.stringify(window.__app.appState));
const persisted = JSON.parse(before);
const reloaded = JSON.parse(after);
check('rechargement : solde, paiements, mémoire, lanterne conservés',
  JSON.stringify(reloaded.budget.balance) === JSON.stringify(persisted.budget.balance) &&
  JSON.stringify(reloaded.groceries.categoryMemory) === JSON.stringify(persisted.groceries.categoryMemory) &&
  reloaded.focus.selectedLantern === 'yukimi' &&
  JSON.stringify(reloaded.budget.months) === JSON.stringify(persisted.budget.months));
check('validateAppState ok sur le stockage', await page.evaluate((k) => window.__core.validateAppState(JSON.parse(localStorage.getItem(k))).ok, KEY));

// --- Effacer l'historique garde le solde ---------------------------------------------
const prev = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});
await page.evaluate((m) => window.__app.removeBalanceCorrection(window.__app.appState.budget.selectedMonth), prev);
await page.evaluate((p) => window.__app.selectMonth(p), prev);
await settle();
await page.evaluate((m) => window.__app.selectMonth(m), month);
await settle();
const openBefore = await page.evaluate((m) => window.__core.openingBalance(window.__app.appState.budget, m), month);
await page.evaluate(() => window.__app.clearHistory());
await settle();
const afterClear = await page.evaluate((m) => ({
  opening: window.__core.openingBalance(window.__app.appState.budget, m),
  months: window.__app.appState.budget.months.length,
}), month);
check('effacer l’historique garde le solde d’ouverture', openBefore !== 0 && afterClear.opening === openBefore && afterClear.months === 1, { openBefore, afterClear });

check('aucune erreur console', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nQA domaine V4 : tout est vert.' : `\n${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
