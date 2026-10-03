/**
 * QA visuelle de l'agent UI : captures Playwright de chaque écran / état,
 * à 390 × 844 (iPhone) et 1440 × 900, avec des données réalistes construites
 * par le core (@a2/core) et injectées dans localStorage (a2-budget:state:v1).
 *
 * Usage (serveur de dev déjà lancé) :
 *   pnpm --filter @a2/web exec vite --port 5181 --strictPort &
 *   node apps/web/scripts/qa-ui.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/ui/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5181);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'ui');
mkdirSync(outDir, { recursive: true });

const BASE = `http://localhost:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

// ---------------------------------------------------------------------------
// Fixtures construites par le core, dans le navigateur (Vite résout @a2/core).
// ---------------------------------------------------------------------------
writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="./fixtures.ts"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'fixtures.ts'),
  `import {
  addDays, addGroceryItem, clearDoneGroceries, createMonthRecord, createTask, currentMonthKey,
  emptyAppState, isoWeekday, localDateKey, migrateState, toggleGroceryItem, toggleTaskToday,
  type AppState,
} from '@a2/core';

let seq = 0;
const id = (p: string) => \`\${p}-\${++seq}\`;
const at = (base: Date, h: number, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
function monthKey(d: Date, delta: number) {
  const x = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  return currentMonthKey(x);
}

function filled(opts: { paused?: boolean; deficit?: boolean; doneAll?: boolean; reserve?: boolean } = {}): AppState {
  const now = new Date();
  let s = emptyAppState();
  // Budget : trois mois.
  const settings = s.budget.settings;
  settings.defaultReserveTargetCents = 0;
  const m2 = createMonthRecord(monthKey(now, -2), settings);
  m2.salaryACents = 215_000; m2.salaryBCents = 352_000;
  const m1 = createMonthRecord(monthKey(now, -1), settings);
  m1.salaryACents = 220_000; m1.salaryBCents = 341_000;
  m1.expenses.push({ id: 'vet', label: 'Vétérinaire', amountCents: 8_500 });
  const m0 = createMonthRecord(monthKey(now, 0), settings);
  m0.salaryACents = 220_000; m0.salaryBCents = 367_500;
  if (opts.deficit) {
    m0.salaryACents = 150_000; m0.salaryBCents = 210_000;
    m0.expenses.push({ id: 'car', label: 'Réparation voiture', amountCents: 64_000 });
  }
  if (opts.reserve) m0.reserveTargetCents = 30_000;
  s.budget.months = [m2, m1, m0];
  s.budget.selectedMonth = m0.monthKey;

  // Maison : tâches réalistes.
  const today = isoWeekday(now);
  const created = localDateKey(addDays(now, -20));
  const t = (title: string, assignee: any, recurrence: any, extra: any = {}) =>
    createTask({ id: id('t'), title, assignee, recurrence, ...extra }, created);
  const tasks = [
    t('Arroser les plantes', 'a', 'daily'),
    t('Vider le lave-vaisselle', 'b', 'daily'),
    t('Sortir les poubelles', 'b', 'weekly', { weeklyDay: today }),
    t('Courses du marché', 'both', 'weekly', { weeklyDay: today }),
    t('Changer les draps', 'both', 'weekly', { weeklyDay: ((today + 1) % 7) + 1 }),
    t('Passer l’aspirateur', 'a', 'weekly', { weeklyDay: (today % 7) + 1 }),
    t('Nettoyer la salle de bain', 'b', 'weekly', { weeklyDay: ((today + 3) % 7) + 1 }),
    t('Payer le loyer', 'a', 'monthly', { monthlyDay: addDays(now, 4).getDate() }),
    createTask({ id: id('t'), title: 'Appeler le plombier', assignee: 'unassigned', recurrence: 'none' }, localDateKey(now)),
  ];
  s.chores.tasks = tasks;
  // Faits passés (10 jours) pour l'historique et la croissance.
  for (let d = 10; d >= 1; d--) {
    const day = addDays(now, -d);
    for (const [i, task] of tasks.entries()) {
      if (task.recurrence !== 'daily' && task.recurrence !== 'weekly') continue;
      if ((d + i) % 3 === 0) continue;
      const r = toggleTaskToday(s, task.id, at(day, 8 + i, 10 + d), id('c'));
      s = r.state;
    }
  }
  // Aujourd'hui : deux gestes faits.
  const doneNow = opts.doneAll ? tasks : [tasks[0]!];
  for (const [i, task] of doneNow.entries()) {
    const r = toggleTaskToday(s, task.id, at(now, Math.min(now.getHours(), 9 + i), 5 + i), id('c'));
    s = r.state;
  }
  if (opts.paused) {
    s.forest = { ...s.forest, paused: true, pausedAt: localDateKey(now), pauses: [...s.forest.pauses, { start: localDateKey(now), end: null }] };
  }

  // Courses : achats passés (suggestions) puis liste du jour.
  let g = s.groceries;
  for (let w = 3; w >= 1; w--) {
    const day = addDays(now, -w * 6);
    let items = g.items;
    for (const label of ['Lait', 'Pain', 'Œufs', 'Café', 'Bananes', w === 2 ? 'Fromage râpé' : 'Beurre']) {
      items = addGroceryItem(items, label, { id: id('g'), now: day }).items;
    }
    for (const item of items) items = toggleGroceryItem(items, item.id, day);
    g = clearDoneGroceries({ ...g, items }, day);
  }
  let items = g.items;
  for (const label of ['2 pommes', 'Tomates cerises', 'Pain', '500 g de farine', 'Yaourts x4', 'Liquide vaisselle', 'Sacs poubelle', 'Basilic', 'Riz complet']) {
    items = addGroceryItem(items, label, { id: id('g'), now: at(now, 8) }).items;
  }
  items = toggleGroceryItem(items, items[2]!.id, at(now, 9));
  items = toggleGroceryItem(items, items[7]!.id, at(now, 9, 5));
  s.groceries = { ...g, items };
  return s;
}

const check = (name: string, s: AppState) => {
  const r = migrateState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(\`fixture \${name} invalide : \${r.reason}\`);
  return JSON.stringify(s);
};

(window as any).__fixtures = {
  filled: check('filled', filled()),
  paused: check('paused', filled({ paused: true })),
  deficit: check('deficit', filled({ deficit: true })),
  doneAll: check('doneAll', filled({ doneAll: true })),
  reserve: check('reserve', filled({ reserve: true })),
};
`,
);

// ---------------------------------------------------------------------------

const browser = await chromium.launch();
const errors = [];

async function getFixtures() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
  await page.goto(`${BASE}qa/ui/fixtures.html`);
  await page.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 20_000 });
  const fx = await page.evaluate(() => window.__fixtures);
  await page.close();
  return fx;
}

const fixtures = await getFixtures();

const VIEWPORTS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  t: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  s: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

/** Ouvre l'app avec un état et des préférences donnés. */
async function open(vp, { state = null, raw = null, module = 'maison', prefs = {} } = {}) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], locale: 'fr-FR', reducedMotion: 'no-preference' });
  await context.addInitScript(
    ([key, uiKey, value, ui]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      localStorage.setItem(uiKey, JSON.stringify(ui));
    },
    [KEY, UI_KEY, raw ?? state, { module, forestMotion: 'full', guardianSeen: true, offlineAnnounced: true, ...prefs }],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${vp}/${module}: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${vp}/${module} console: ${m.text()}`);
  });
  await page.goto(BASE);
  await page.waitForSelector('.screen-sheet');
  await page.waitForTimeout(900);
  return { context, page };
}

async function shot(page, name, { full = false } = {}) {
  if (filter && !name.includes(filter)) return;
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: full });
  console.log('shot', name);
}

const want = (name) => !filter || name.includes(filter);

async function scenario(name, vp, opts, fn) {
  if (!want(name)) return;
  const { context, page } = await open(vp, opts);
  try {
    await fn(page);
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    console.log('FAIL', name, e.message);
  }
  await context.close();
}

for (const vp of (process.env.QA_VP ?? 'm,d').split(',')) {
  // --- Maison ---------------------------------------------------------------
  await scenario(`${vp}-maison-empty`, vp, { module: 'maison' }, async (page) => {
    await shot(page, `${vp}-maison-empty`);
  });
  await scenario(`${vp}-maison-filled`, vp, { module: 'maison', state: fixtures.filled }, async (page) => {
    await shot(page, `${vp}-maison-filled`);
    await shot(page, `${vp}-maison-filled-full`, { full: true });
  });
  await scenario(`${vp}-maison-check`, vp, { module: 'maison', state: fixtures.filled }, async (page) => {
    await page.locator('.task-list .check').first().click();
    await page.waitForTimeout(380);
    await shot(page, `${vp}-maison-check-anim`);
    await page.waitForTimeout(1600);
    await page.locator('.done-today .disclosure__toggle').click();
    await page.waitForTimeout(400);
    await shot(page, `${vp}-maison-check-done`, { full: true });
  });
  await scenario(`${vp}-maison-alldone`, vp, { module: 'maison', state: fixtures.doneAll }, async (page) => {
    await shot(page, `${vp}-maison-alldone`);
  });
  await scenario(`${vp}-maison-paused`, vp, { module: 'maison', state: fixtures.paused }, async (page) => {
    await shot(page, `${vp}-maison-paused`);
  });
  await scenario(`${vp}-maison-sheet`, vp, { module: 'maison', state: fixtures.filled }, async (page) => {
    await page.getByRole('button', { name: 'Ajouter une tâche' }).click();
    await page.waitForTimeout(500);
    await shot(page, `${vp}-maison-sheet-new`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.waitForTimeout(200);
    await shot(page, `${vp}-maison-sheet-error`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.locator('.task-row__body').nth(2).click();
    await page.waitForTimeout(500);
    await shot(page, `${vp}-maison-sheet-edit`);
    await page.locator('#task-recurrence-monthly').check();
    await page.waitForTimeout(200);
    await shot(page, `${vp}-maison-sheet-monthly`);
  });

  // --- Budget ---------------------------------------------------------------
  await scenario(`${vp}-budget-default`, vp, { module: 'budget' }, async (page) => {
    await shot(page, `${vp}-budget-default`);
  });
  await scenario(`${vp}-budget-filled`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await shot(page, `${vp}-budget-filled`);
    await page.locator('.breakdown .disclosure__toggle').click();
    await page.waitForTimeout(400);
    await shot(page, `${vp}-budget-filled-full`, { full: true });
  });
  await scenario(`${vp}-budget-deficit`, vp, { module: 'budget', state: fixtures.deficit }, async (page) => {
    await shot(page, `${vp}-budget-deficit`);
  });
  await scenario(`${vp}-budget-error`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await page.locator('#salary-a').click();
    await page.locator('#salary-a').fill('12,345');
    await page.locator('#salary-a').blur();
    await page.waitForTimeout(200);
    await shot(page, `${vp}-budget-error`);
    await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
    await page.waitForTimeout(300);
    await page.locator('.expense-add').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, `${vp}-budget-add-expense`);
  });
  await scenario(`${vp}-budget-past`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await page.waitForTimeout(400);
    await shot(page, `${vp}-budget-past`);
  });

  // --- Courses --------------------------------------------------------------
  await scenario(`${vp}-courses-empty`, vp, { module: 'courses' }, async (page) => {
    await shot(page, `${vp}-courses-empty`);
  });
  await scenario(`${vp}-courses-filled`, vp, { module: 'courses', state: fixtures.filled }, async (page) => {
    await shot(page, `${vp}-courses-filled`);
    await shot(page, `${vp}-courses-filled-full`, { full: true });
    await page.locator('#grocery-input').fill('lait x2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    await shot(page, `${vp}-courses-added`);
    await page.locator('.item-row__body').first().click();
    await page.waitForTimeout(500);
    await shot(page, `${vp}-courses-item-sheet`);
  });

  // --- Défilement, toasts, focus -------------------------------------------
  await scenario(`${vp}-maison-scrolled`, vp, { module: 'maison', state: fixtures.filled }, async (page) => {
    await page.mouse.wheel(0, 520);
    await page.waitForTimeout(500);
    await shot(page, `${vp}-maison-scrolled`);
  });
  await scenario(`${vp}-courses-scrolled`, vp, { module: 'courses', state: fixtures.filled }, async (page) => {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(500);
    await shot(page, `${vp}-courses-scrolled`);
  });
  await scenario(`${vp}-courses-toast`, vp, { module: 'courses', state: fixtures.filled }, async (page) => {
    await page.getByRole('button', { name: 'Retirer Tomates cerises' }).click();
    await page.waitForTimeout(400);
    await shot(page, `${vp}-courses-toast`);
  });
  await scenario(`${vp}-budget-reserve`, vp, { module: 'budget', state: fixtures.reserve }, async (page) => {
    await page.mouse.wheel(0, 560);
    await page.waitForTimeout(400);
    await shot(page, `${vp}-budget-reserve`);
  });
  await scenario(`${vp}-focus`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await shot(page, `${vp}-focus`);
  });

  await scenario(`${vp}-saved`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await page.locator('#salary-a').click();
    await page.locator('#salary-a').fill('2250');
    await page.locator('#salary-a').blur();
    await page.waitForTimeout(350);
    await shot(page, `${vp}-saved`);
  });
  await scenario(`${vp}-save-error`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'a2-budget:state:v1') throw new DOMException('Quota', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.locator('#salary-a').click();
    await page.locator('#salary-a').fill('2250');
    await page.locator('#salary-a').blur();
    await page.waitForTimeout(500);
    await shot(page, `${vp}-save-error`);
  });
  await scenario(`${vp}-update`, vp, { module: 'maison', state: fixtures.filled }, async (page) => {
    // Aperçu visuel de l'invite (needRefresh ne se simule pas en dev) : même balisage que UpdatePrompt.
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'update-prompt';
      el.innerHTML = `<svg class="icon update-prompt__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.8c.7 4.1 2.2 5.6 6.2 6.2-4 .7-5.5 2.2-6.2 6.2-.7-4-2.2-5.5-6.2-6.2 4-.6 5.5-2.1 6.2-6.2Z"/></svg><p class="update-prompt__text">Une nouvelle version est prête.</p><div class="update-prompt__actions"><button class="btn btn--ghost btn--sm"><span class="btn__label">Plus tard</span></button><button class="btn btn--primary btn--sm"><span class="btn__label">Actualiser</span></button></div>`;
      document.querySelector('.app').appendChild(el);
    });
    await page.waitForTimeout(400);
    await shot(page, `${vp}-update`);
  });

  // --- Feuilles globales ----------------------------------------------------
  for (const module of ['budget', 'maison', 'courses']) {
    await scenario(`${vp}-history-${module}`, vp, { module, state: fixtures.filled }, async (page) => {
      await page.locator('.app-header__end .icon-btn').first().click();
      await page.waitForTimeout(500);
      await shot(page, `${vp}-history-${module}`);
    });
  }
  await scenario(`${vp}-settings`, vp, { module: 'budget', state: fixtures.filled }, async (page) => {
    await page.getByRole('button', { name: 'Réglages' }).click();
    await page.waitForTimeout(500);
    await shot(page, `${vp}-settings-top`);
    await page.locator('.sheet__body').evaluate((el) => el.scrollBy(0, 900));
    await page.waitForTimeout(200);
    await shot(page, `${vp}-settings-mid`);
    await page.locator('.sheet__body').evaluate((el) => el.scrollBy(0, 2000));
    await page.waitForTimeout(200);
    await shot(page, `${vp}-settings-bottom`);
    await page.getByRole('button', { name: 'Tout effacer…' }).click();
    await page.waitForTimeout(400);
    await shot(page, `${vp}-settings-reset-confirm`);
  });
  await scenario(`${vp}-recovery`, vp, { module: 'budget', raw: '{"version":1,"months":[' }, async (page) => {
    await shot(page, `${vp}-recovery`);
  });
}

await browser.close();
if (errors.length) {
  console.log('\nErreurs :');
  for (const e of errors) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('\nAucune erreur de page.');
}
