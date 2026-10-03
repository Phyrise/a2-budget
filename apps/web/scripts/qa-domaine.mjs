/**
 * QA agent DOMAINE : exerce le store réel (React 19, StrictMode, localStorage)
 * dans Chromium, sans dépendre des écrans.
 *
 * Usage (serveur de dev déjà lancé) :
 *   pnpm --filter @a2/web exec vite --port 5191 --strictPort &
 *   node apps/web/scripts/qa-domaine.mjs [port]
 *
 * Le harnais (gitignoré) est écrit dans apps/web/qa/domaine/ : il monte
 * <AppProvider> en StrictMode et expose le contexte sur window.__app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5191);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'domaine');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, 'harness.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QA domaine</title></head>
<body><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'harness.tsx'),
  `import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from '../../src/state/store';

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

/** Chemins où deux valeurs JSON diffèrent (ordre des clés ignoré). */
function diffPaths(a, b, path = '$') {
  if (a === b) return [];
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return [`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`];
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: type`];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => diffPaths(a[k], b[k], `${path}.${k}`));
}
const url = `http://localhost:${port}/a2-budget/qa/domaine/harness.html`;
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
const settle = () => page.waitForTimeout(150);
await ready();

// --- Tâches -----------------------------------------------------------------
const created = await page.evaluate(() => {
  const app = window.__app;
  const daily = app.createHomeTask({ title: '  Arroser  ', assignee: 'a', recurrence: 'daily' });
  const weekly = app.createHomeTask({ title: 'Poubelles', assignee: 'b', recurrence: 'weekly' });
  const monthly = app.createHomeTask({ title: 'Draps', assignee: 'both', recurrence: 'monthly', monthlyDay: 31 });
  const empty = app.createHomeTask({ title: '   ', assignee: 'a', recurrence: 'daily' });
  const bad = app.createHomeTask({ title: 'X', assignee: 'a', recurrence: 'monthly', monthlyDay: 40 });
  const now = new Date();
  return { daily, weekly, monthly, empty, bad, isoDay: ((now.getDay() + 6) % 7) + 1 };
});
check('createHomeTask nettoie le titre', created.daily?.title === 'Arroser', created.daily);
check('weekly sans jour → aujourd’hui', created.weekly?.weeklyDay === created.isoDay, created.weekly);
check('monthly avec jour choisi', created.monthly?.monthlyDay === 31, created.monthly);
check('saisies invalides → null', created.empty === null && created.bad === null, created);
await settle();
check('3 tâches dans l’état', (await page.evaluate(() => window.__app.appState.chores.tasks.length)) === 3);

const toggles = await page.evaluate((task) => {
  const app = window.__app;
  const first = app.toggleHomeTask(task);
  const second = app.toggleHomeTask(task); // même tick (double tap)
  return { first, second };
}, created.daily);
check('toggle → completed + id', toggles.first.completed === true && typeof toggles.first.completionId === 'string', toggles);
check('double tap même tick → annule le même fait', toggles.second.completed === false && toggles.second.completionId === toggles.first.completionId, toggles);
await settle();
const afterDouble = await page.evaluate(() => ({
  completions: window.__app.appState.chores.completions.length,
  ledger: window.__app.appState.forest.creditLedger,
  care: window.__app.appState.forest.lifetimeCare,
}));
check('double tap : aucun fait, crédit en tombstone', afterDouble.completions === 0 && Object.values(afterDouble.ledger)[0]?.status === 'tombstoned' && afterDouble.care === 1, afterDouble);

const redo = await page.evaluate((task) => window.__app.toggleHomeTask(task), created.daily);
await settle();
const afterRedo = await page.evaluate(() => window.__app.appState.chores.completions.map((c) => c.id));
check('recocher → nouveau fait (id renvoyé = id stocké)', redo.completed && afterRedo.length === 1 && afterRedo[0] === redo.completionId, { redo, afterRedo });

const notDue = await page.evaluate((task) => {
  const isoDay = ((new Date().getDay() + 6) % 7) + 1;
  const other = (isoDay % 7) + 1;
  window.__app.updateHomeTask(task.id, { weeklyDay: other });
  return null;
}, created.weekly);
await settle();
const notDueResult = await page.evaluate((id) => {
  const task = window.__app.appState.chores.tasks.find((t) => t.id === id);
  return window.__app.toggleHomeTask(task);
}, created.weekly.id);
check('tâche non due aujourd’hui → rien', notDueResult.completed === false && notDueResult.completionId === null, { notDue, notDueResult });

const updates = await page.evaluate((ids) => {
  const app = window.__app;
  return {
    ok: app.updateHomeTask(ids.daily, { title: 'Arroser les plantes', recurrence: 'monthly' }),
    bad: app.updateHomeTask(ids.daily, { title: '  ' }),
    unknown: app.updateHomeTask('nope', { title: 'x' }),
  };
}, { daily: created.daily.id });
await settle();
const updated = await page.evaluate((id) => ({
  task: window.__app.appState.chores.tasks.find((t) => t.id === id),
  completion: window.__app.appState.chores.completions[0],
  day: new Date().getDate(),
}), created.daily.id);
check('updateHomeTask valide / invalide / inconnu', updates.ok === true && updates.bad === false && updates.unknown === false, updates);
check('passage en monthly → jour du mois = aujourd’hui', updated.task.recurrence === 'monthly' && updated.task.monthlyDay === updated.day, updated.task);
check('le fait passé garde son titre', updated.completion.taskTitle === 'Arroser', updated.completion);

const deletion = await page.evaluate((id) => [window.__app.deleteHomeTask(id), window.__app.deleteHomeTask(id)], created.daily.id);
await settle();
const afterDelete = await page.evaluate(() => ({
  tasks: window.__app.appState.chores.tasks.length,
  completions: window.__app.appState.chores.completions.length,
}));
check('deleteHomeTask : true puis false, faits conservés', deletion[0] === true && deletion[1] === false && afterDelete.tasks === 2 && afterDelete.completions === 1, { deletion, afterDelete });

// --- Courses ----------------------------------------------------------------
const adds = await page.evaluate(() => {
  const app = window.__app;
  return {
    pommes: app.addGrocery('2 pommes', 'a'),
    dup: app.addGrocery('pomme'),
    lait: app.addGrocery('lait x2', 'b'),
    farine: app.addGrocery('500 g de farine'),
    empty: app.addGrocery('   '),
  };
});
check('addGrocery quantité + rayon', adds.pommes.added && adds.pommes.item.quantity === '×2' && adds.pommes.item.category === 'fruits-legumes' && adds.pommes.item.addedBy === 'a', adds.pommes);
check('addGrocery doublon (même tick) → existant', adds.dup.added === false && adds.dup.item.id === adds.pommes.item.id, adds.dup);
check('addGrocery 500 g de farine', adds.farine.item.quantity === '500 g' && adds.farine.item.label === 'Farine', adds.farine);
check('addGrocery vide → null', adds.empty.added === false && adds.empty.item === null, adds.empty);
await settle();

await page.evaluate((id) => window.__app.toggleGrocery(id), adds.pommes.item.id);
await settle();
const cleared = await page.evaluate(() => window.__app.clearDoneGroceries());
await settle();
const groceries1 = await page.evaluate(() => window.__app.appState.groceries);
check('vider le panier → 1 archivé', cleared === 1 && groceries1.items.length === 2 && groceries1.history?.length === 1 && groceries1.history[0].label === 'Pommes', { cleared, groceries1 });

const removed = await page.evaluate((id) => window.__app.removeGrocery(id), adds.lait.item.id);
await settle();
const afterRemove = await page.evaluate(() => window.__app.appState.groceries.items.map((i) => i.label));
await page.evaluate((r) => window.__app.restoreGrocery(r), removed);
await settle();
const afterRestore = await page.evaluate(() => window.__app.appState.groceries.items.map((i) => i.label));
check('removeGrocery + restoreGrocery', removed?.index === 0 && afterRemove.join() === 'Farine' && afterRestore.join() === 'Lait,Farine', { removed, afterRemove, afterRestore });

await page.evaluate((id) => window.__app.updateGrocery(id, { quantity: '1 l', category: 'boissons' }), adds.lait.item.id);
await settle();
const lait = await page.evaluate((id) => window.__app.appState.groceries.items.find((i) => i.id === id), adds.lait.item.id);
check('updateGrocery quantité + rayon', lait.quantity === '1 l' && lait.category === 'boissons', lait);

// --- Personnes ----------------------------------------------------------------
const renamed = await page.evaluate(() => [window.__app.renamePerson('A', '  Arthur  '), window.__app.renamePerson('B', '  ')]);
await settle();
const people = await page.evaluate(() => ({
  household: window.__app.appState.household.people,
  settings: window.__app.appState.budget.settings.personA.name,
}));
check('renamePerson synchronise household.people', renamed[0] && !renamed[1] && people.household[0].name === 'Arthur' && people.settings === 'Arthur', { renamed, people });

// --- Persistance + rechargement ---------------------------------------------------
await page.waitForFunction(() => window.__app.saveStatus === 'saved');
const before = await page.evaluate(() => JSON.stringify(window.__app.appState));
await page.reload();
await ready();
await settle();
const after = await page.evaluate(() => ({ state: JSON.stringify(window.__app.appState), recovery: window.__app.recovery.kind }));
const diffs = diffPaths(JSON.parse(before), JSON.parse(after.state));
check('rechargement : état identique, pas de récupération', after.recovery === 'none' && diffs.length === 0, { recovery: after.recovery, diffs });

const summary = await page.evaluate(() => {
  const res = window.__app.importJson(window.__app.exportJson());
  return res.ok ? res.summary : res;
});
check('export → import : résumé tâches + courses', summary.taskCount === 2 && summary.completionCount === 1 && summary.groceryCount === 2, summary);

writeFileSync(join(outDir, 'state.json'), JSON.stringify(JSON.parse(before), null, 2));
await page.evaluate((k) => localStorage.removeItem(k), KEY);
check('aucune erreur console', errors.length === 0, errors);
await browser.close();

console.log(failures.length === 0 ? '\nTout est vert.' : `\n${failures.length} échec(s) : ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
