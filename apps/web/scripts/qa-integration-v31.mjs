/**
 * QA d'intégration V3.1 (lead), 390 × 844 tactile, sur le serveur de dev :
 * Budget (salaire + compléments, détail), Réglages (taux communs au curseur,
 * petits sons, pause), lune de l'en-tête, Maison (« À venir » replié / déplié
 * avec dix tâches le même jour, partage expliqué, lanterne présentée, état
 * gardé après rechargement), Courses avec clavier simulé (barre visible).
 * État construit par @a2/core (validateAppState ok).
 *
 * Usage :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5185 --strictPort &
 *   node apps/web/scripts/qa-integration-v31.mjs [port]
 * Sorties : apps/web/qa/integration-v31/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5185);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'integration-v31');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;
const UI_KEY = 'a2-budget:ui:v1';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};
const shot = (page, name) => page.screenshot({ path: join(outDir, `${name}.png`) });
const nbspOk = (text) => !/[^  (\s][:;?!€]/.test(text.replace(/https?:\S+/g, '').replace(/\d[:]\d/g, ''));

async function seed(page, module) {
  await page.goto(`${APP}?module=${module}`);
  const r = await page.evaluate(async ({ entry, module, uiKey }) => {
    const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
    const now = new Date();
    let s = core.emptyAppState();
    const key = core.currentMonthKey(now);
    const month = { ...core.createMonthRecord(key, s.budget.settings), salaryACents: 220000, salaryBCents: 300000, bonusBCents: 67500 };
    month.expenses = [
      { id: 'e-loyer', label: 'Loyer', amountCents: 150000 },
      { id: 'e-courses', label: 'Courses', amountCents: 34500 },
    ];
    s.budget.months = [month];
    s.budget.selectedMonth = key;
    const created = core.localDateKey(core.addDays(now, -30));
    const wd = core.isoWeekday(now);
    const inDays = (n) => ((wd - 1 + n) % 7) + 1;
    let n = 0;
    const t = (title, assignee, recurrence, extra = {}) => core.createTask({ id: `t-${++n}`, title, assignee, recurrence, ...extra }, created);
    const busy = ['Changer les draps', 'Laver les vitres', 'Passer la serpillière', 'Détartrer la bouilloire', 'Trier le courrier', 'Ranger le garage', 'Nettoyer le four', 'Arroser le balcon', 'Repasser les chemises', 'Vider le frigo'];
    s.chores.tasks = [
      t('Arroser les plantes', 'a', 'daily'),
      t('Vider le lave-vaisselle', 'b', 'daily', { effort: 2, rotation: true }),
      t('Sortir les poubelles', 'b', 'weekly', { weeklyDay: inDays(1), effort: 2 }),
      ...busy.map((title, i) => t(title, i % 3 === 0 ? 'both' : i % 2 === 0 ? 'a' : 'b', 'weekly', { weeklyDay: inDays(5), effort: (i % 3) + 1 })),
    ];
    const monday = core.startOfWeek(now);
    for (let d = new Date(monday); core.localDateKey(d) < core.localDateKey(now); d = core.addDays(d, 1)) {
      s = core.toggleTaskToday(s, 't-2', new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21), `c-${core.localDateKey(d)}`, { doneBy: 'b' }).state;
    }
    let items = s.groceries.items;
    for (const [i, raw] of ['2 pommes', 'Lait', 'Pain', 'Riz 1 kg'].entries()) {
      items = core.addGroceryItem(items, raw, { id: `g-${i}`, now }).items;
    }
    s = { ...s, groceries: { ...s.groceries, items } };
    const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
    if (!v.ok) return { ok: false, reason: v.reason };
    localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
    localStorage.setItem(uiKey, JSON.stringify({ module, forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    return { ok: true };
  }, { entry: coreEntry, module, uiKey: UI_KEY });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(500);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// --- Budget -------------------------------------------------------------------
await seed(page, 'budget');
check('compléments AC visibles (675 €)', await page.locator('#bonus-b').isVisible());
check('compléments AL repliés', (await page.getByRole('button', { name: 'Ajouter des compléments pour AL' }).count()) === 1);
const contribB = await page.locator('[data-testid=contribution-b]').innerText();
check('AC contribue 1 335 €', contribB.replace(/\s/g, '').includes('1335'), contribB);
const remaining = await page.locator('[data-testid=remaining]').innerText();
check('reste 370 €', remaining.replace(/\s/g, '').includes('370'), remaining);
await shot(page, '01-budget');
const detail = page.getByRole('button', { name: /détail/i }).first();
if (await detail.count()) {
  await detail.click();
  await page.waitForTimeout(300);
  const txt = await page.locator('.screen-sheet').innerText();
  check('détail : « de compléments »', txt.includes('de compléments'));
  await page.locator('text=de compléments').first().scrollIntoViewIfNeeded();
  await shot(page, '02-budget-detail');
} else check('bouton détail présent', false);
const budgetText = await page.locator('.screen-sheet').innerText();
check('Budget : espaces insécables', nbspOk(budgetText));

// --- En-tête : lune -----------------------------------------------------------
await page.locator('.app-dock').getByRole('button', { name: 'Maison', exact: true }).click();
await page.waitForTimeout(500);
const moon = page.locator('.app-header').getByRole('button', { name: 'Mettre la maison en pause' });
check('lune dans l’en-tête de Maison', (await moon.count()) === 1);
check('plus de bouton pause en bas de Maison', (await page.locator('.screen-sheet').getByRole('button', { name: 'Mettre la maison en pause' }).count()) === 0);

// --- Maison : À venir ---------------------------------------------------------
const up = page.locator('.upcoming-section');
await up.scrollIntoViewIfNeeded();
const upBox = await up.boundingBox();
check('À venir replié : compact (< 140 px)', upBox !== null && upBox.height < 140, upBox?.height);
await shot(page, '03-maison-avenir-replie');
await up.getByRole('button').first().click();
await page.waitForTimeout(400);
const upOpen = await up.boundingBox();
check('À venir déplié : plus haut', upOpen !== null && upBox !== null && upOpen.height > upBox.height + 80, upOpen?.height);
check('« +7 autres » proposé', (await up.getByRole('button', { name: /Voir les 7 autres/ }).count()) === 1);
await shot(page, '04-maison-avenir-deplie');
await page.reload();
await page.locator('.screen-sheet').waitFor();
await page.waitForTimeout(500);
check('À venir reste déplié après rechargement', (await page.locator('.upcoming-section').getByRole('button', { name: /Voir les 7 autres/ }).count()) === 1);
const prefs = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), UI_KEY);
check('préférence upcomingOpen enregistrée', prefs?.upcomingOpen === true, prefs);

// --- Maison : partage ---------------------------------------------------------
const balance = page.locator('.balance-card, [class*=balance]').first();
await balance.scrollIntoViewIfNeeded();
const balanceText = await balance.innerText();
check('« Le partage de la semaine »', balanceText.includes('Le partage de la semaine'));
check('partage : aucun chiffre', !/\d/.test(balanceText), balanceText);
await shot(page, '05-maison-partage');

// --- Maison : lanterne --------------------------------------------------------
const rituals = page.locator('section.rituals');
await rituals.scrollIntoViewIfNeeded();
await rituals.getByRole('button', { name: /^Lanterne/ }).click();
const setup = page.getByRole('dialog', { name: 'Allumer une lanterne', exact: true });
await setup.waitFor();
await page.waitForTimeout(500);
check('explication de la lanterne à la 1re ouverture', (await setup.getByRole('button', { name: 'Choisir une durée' }).count()) === 1);
await shot(page, '06-lanterne-explication');
await setup.getByRole('button', { name: 'Choisir une durée' }).click();
await page.waitForTimeout(300);
check('« Lancer N minutes »', (await setup.getByRole('button', { name: /^Lancer \d+ minutes?/ }).count()) === 1);
await shot(page, '07-lanterne-preparer');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.reload();
await page.locator('.screen-sheet').waitFor();
await page.locator('section.rituals').getByRole('button', { name: /^Lanterne/ }).click();
await setup.waitFor();
await page.waitForTimeout(400);
check('explication non remontrée après rechargement', (await setup.getByRole('button', { name: 'Choisir une durée' }).count()) === 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// --- Lune : pause -------------------------------------------------------------
await page.locator('.app-header').getByRole('button', { name: 'Mettre la maison en pause' }).click();
await page.waitForTimeout(600);
check('pause : soleil dans l’en-tête', (await page.locator('.app-header').getByRole('button', { name: 'Réveiller la forêt' }).count()) === 1);
await shot(page, '08-maison-pause');
await page.locator('.app-header').getByRole('button', { name: 'Réveiller la forêt' }).click();
await page.waitForTimeout(600);

// --- Réglages -----------------------------------------------------------------
await page.locator('.app-header').getByRole('button', { name: /Réglages/ }).click();
await page.waitForTimeout(500);
check('curseur taux de base', await page.locator('#shared-base-rate').isVisible());
check('curseur taux au-delà', (await page.locator('#shared-variable-rate').count()) === 1);
check('réglages sans « prérempli »', !(await page.locator('body').innerText()).toLowerCase().includes('prérempli'));
await page.locator('#rates-title').scrollIntoViewIfNeeded();
await shot(page, '09-reglages-taux');
await page.locator('#shared-base-rate').focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
const rates = await page.evaluate(() => JSON.parse(localStorage.getItem('a2-budget:state:v1')).budget.settings);
check('curseur : écrit pour les deux', rates.personA.baseRateBps === rates.personB.baseRateBps && rates.personA.baseRateBps === 4100, [rates.personA.baseRateBps, rates.personB.baseRateBps]);
check('section Préférences (sons)', (await page.getByRole('switch', { name: /Petits sons/ }).count()) + (await page.getByLabel(/Petits sons/).count()) > 0);
check('interrupteur pause', (await page.locator('#home-pause').count()) === 1);
await page.locator('#prefs-title').scrollIntoViewIfNeeded();
await shot(page, '10-reglages-sons-pause');
check('Réglages : espaces insécables', nbspOk(await page.getByRole('dialog').first().innerText()));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// --- Courses : clavier simulé -------------------------------------------------
await page.locator('.app-dock').getByRole('button', { name: 'Courses', exact: true }).click();
await page.waitForTimeout(500);
const dock = page.locator('.app-dock');
const input = page.locator('#grocery-input');
const opacity = () => dock.evaluate((el) => getComputedStyle(el).opacity);
await input.focus();
await page.setViewportSize({ width: 390, height: 480 });
await page.waitForTimeout(400);
check('clavier ouvert : barre effacée', (await opacity()) === '0');
await input.fill('Beurre');
await input.press('Enter');
await page.waitForTimeout(200);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
check('clavier fermé, focus gardé : barre revenue', (await opacity()) === '1');
await input.blur();
await page.waitForTimeout(300);
check('après blur : barre visible', (await opacity()) === '1');
await shot(page, '11-courses-apres-clavier');

check('aucune erreur console', errors.length === 0, errors.slice(0, 3));
await browser.close();
console.log(failures.length === 0 ? '\nTout est vert.' : `\n${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
