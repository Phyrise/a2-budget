/**
 * QA agent UI-BUDGET-COQUILLE V3.1 : salaire + compléments (repliés / dépliés),
 * taux communs au curseur, lune de pause dans l'en-tête, barre de navigation
 * qui revient après le clavier. État V2 réaliste construit par @a2/core.
 *
 * Usage (serveur de dev déjà lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5181 --strictPort &
 *   node apps/web/scripts/qa-budget-coquille.mjs [port]
 * Sorties : apps/web/qa/budget-coquille/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const port = Number(process.argv[2] ?? 5181);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'budget-coquille');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};
const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, `${name}.png`), ...opts });
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

async function seed(page, module = 'budget') {
  await page.goto(`${APP}?module=${module}`);
  const r = await page.evaluate(async ({ entry, module }) => {
    const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
    const now = new Date();
    let s = core.emptyAppState();
    const key = core.currentMonthKey(now);
    const prev = core.currentMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const month = { ...core.createMonthRecord(key, s.budget.settings), salaryACents: 220000, salaryBCents: 300000 };
    const older = { ...core.createMonthRecord(prev, s.budget.settings), salaryACents: 220000, salaryBCents: 300000, bonusBCents: 41000 };
    s.budget.months = [older, month];
    s.budget.selectedMonth = key;
    const today = core.localDateKey(now);
    const created = core.localDateKey(core.addDays(now, -10));
    s.chores.tasks = [
      core.createTask({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily', effort: 1 }, created),
      core.createTask({ id: 't-linge', title: 'Plier le linge', assignee: 'both', recurrence: 'daily', effort: 2 }, created),
      core.createTask({ id: 't-sdb', title: 'Nettoyer la salle de bain', assignee: 'b', recurrence: 'daily', effort: 3 }, created),
    ];
    void today;
    const v = core.validateAppState(s);
    if (!v.ok) return { ok: false, reason: v.reason };
    localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module, forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    return { ok: true };
  }, { entry: coreEntry, module });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(400);
}

const inViewport = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  }, selector);

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// --- 1. Budget : compléments repliés ------------------------------------------
await seed(page, 'budget');
await shot(page, '01-budget-replie');
check('aucune mention « prérempli »', !(await page.locator('body').innerText()).toLowerCase().includes('prérempli'));
check('« + Compléments » visible pour AL et AC', (await page.locator('.person-card__add-bonus').count()) === 2);
for (const sel of ['#salary-a', '#salary-b', '[data-testid=contribution-a]', '[data-testid=contribution-b]', '[data-testid=household-total]', '[data-testid=expenses-total]', '[data-testid=remaining]']) {
  check(`premier écran (replié) : ${sel}`, await inViewport(page, sel));
}

// --- 2. Compléments dépliés : B 3000 € + 675 € → 1335 € ------------------------
await page.getByRole('button', { name: 'Ajouter des compléments pour AC' }).tap();
await page.waitForTimeout(150);
check('le champ compléments reçoit le focus', await page.evaluate(() => document.activeElement?.id === 'bonus-b'));
await page.locator('#bonus-b').fill('675');
await page.locator('#bonus-b').blur();
await page.waitForTimeout(250);
const contribB = await page.getByTestId('contribution-b').innerText();
check('AC verse 1 335,00 €', contribB.replace(/\s/g, '') === '1335,00€', contribB);
for (const sel of ['#salary-a', '#salary-b', '#bonus-b', '[data-testid=contribution-a]', '[data-testid=contribution-b]', '[data-testid=household-total]', '[data-testid=expenses-total]', '[data-testid=remaining]']) {
  check(`premier écran (déplié) : ${sel}`, await inViewport(page, sel));
}
const st = await stored(page);
const cur = st.budget.months.find((m) => m.monthKey === st.budget.selectedMonth);
check('compléments enregistrés (67500)', cur.bonusBCents === 67500 && cur.salaryBCents === 300000, cur);
await shot(page, '02-budget-deplie');

await page.getByRole('button', { name: 'Détail du calcul' }).tap();
await page.waitForTimeout(400);
const line = await page.locator('.breakdown__line').nth(1).innerText();
check('détail : « 20 % × 675 € de compléments »', /20\s%\s×\s675\s€\sde compléments/.test(line.replace(/[  ]/g, ' ')), line);
await page.locator('.breakdown').scrollIntoViewIfNeeded();
await shot(page, '03-budget-detail');

// --- 3. Réglages : curseurs de taux communs -----------------------------------
await page.getByRole('button', { name: 'Réglages', exact: true }).tap();
const dialog = page.getByRole('dialog', { name: 'Réglages' });
await dialog.waitFor();
await page.waitForTimeout(500);
check('Réglages sans « prérempli »', !(await dialog.innerText()).toLowerCase().includes('prérempli'));
check('aucun champ texte de taux', (await dialog.locator('.rate-input').count()) === 0);
check('deux curseurs', (await dialog.locator('input[type=range]').count()) === 2);
const base = dialog.locator('#shared-base-rate');
check('aria-valuetext « 40 % »', ((await base.getAttribute('aria-valuetext')) ?? '').replace(/\s/g, '') === '40%');
await base.scrollIntoViewIfNeeded();
await base.focus();
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(500);
let s2 = await stored(page);
check('flèches : taux de base 35 % pour les deux',
  s2.budget.settings.personA.baseRateBps === 3500 && s2.budget.settings.personB.baseRateBps === 3500, s2.budget.settings.personA);
await dialog.getByRole('button', { name: 'Taux au-delà : plus 1 %' }).tap();
await page.waitForTimeout(300);
s2 = await stored(page);
check('bouton + : taux au-delà 21 % pour les deux',
  s2.budget.settings.personA.variableRateBps === 2100 && s2.budget.settings.personB.variableRateBps === 2100);
// Glissement à la souris : pendant le geste, la valeur grandit.
const box = await dialog.locator('#shared-variable-rate').boundingBox();
await page.mouse.move(box.x + box.width * 0.21, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 8 });
await page.waitForTimeout(120);
await dialog.locator('.shared-rates').screenshot({ path: join(outDir, '04-reglages-curseurs-glissement.png') });
await page.mouse.up();
await page.waitForTimeout(500);
s2 = await stored(page);
check('glissement : taux au-delà ≈ 50 %', Math.abs(s2.budget.settings.personA.variableRateBps - 5000) <= 300 &&
  s2.budget.settings.personA.variableRateBps === s2.budget.settings.personB.variableRateBps, s2.budget.settings.personA.variableRateBps);
await dialog.locator('#shared-variable-rate').focus();
await page.keyboard.press('Home');
await page.keyboard.press('PageUp');
await page.keyboard.press('PageUp');
await page.waitForTimeout(500);
s2 = await stored(page);
check('Début puis Page haut ×2 : 20 %', s2.budget.settings.personA.variableRateBps === 2000, s2.budget.settings.personA.variableRateBps);
await dialog.locator('#rates-title').scrollIntoViewIfNeeded();
await shot(page, '05-reglages-taux');
await dialog.locator('#pause-title').scrollIntoViewIfNeeded();
await shot(page, '06-reglages-pause-preferences');
await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'hidden' });

// Le mois affiché garde ses taux : proposition dans le détail.
check('mois : proposition « Appliquer les taux communs »', await page.getByRole('button', { name: 'Appliquer les taux communs à ce mois' }).isVisible());
await page.getByRole('button', { name: 'Appliquer les taux communs à ce mois' }).tap();
await page.waitForTimeout(300);
const contribB2 = await page.getByTestId('contribution-b').innerText();
check('après application : AC 35 % × 3000 + 20 % × 675 = 1 185,00 €', contribB2.replace(/\s/g, '') === '1185,00€', contribB2);

// --- 4. Maison : lune dans l'en-tête -------------------------------------------
await page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name: 'Maison' }).tap();
await page.waitForTimeout(500);
const moon = page.locator('.app-header').getByRole('button', { name: 'Mettre la maison en pause' });
check('lune visible dans l’en-tête de Maison', await moon.isVisible());
await moon.tap();
await page.waitForTimeout(600);
check('pause enregistrée', (await stored(page)).forest.paused === true);
check('toast annulable', await page.locator('.toast').getByRole('button', { name: 'Annuler' }).isVisible());
await shot(page, '07-maison-pause-toast');
await page.locator('.toast').getByRole('button', { name: 'Annuler' }).tap();
await page.waitForTimeout(300);
check('annuler : la forêt est réveillée', (await stored(page)).forest.paused === false);
await moon.tap();
await page.waitForTimeout(4500);
const sun = page.locator('.app-header').getByRole('button', { name: 'Réveiller la forêt' });
check('soleil dans l’en-tête pendant la pause', await sun.isVisible());
await shot(page, '08-maison-en-pause', { clip: { x: 0, y: 0, width: 390, height: 420 } });
await sun.tap();
await page.waitForTimeout(300);
check('réveil depuis l’en-tête', (await stored(page)).forest.paused === false);

// --- 5. Clavier : la barre revient même si le champ garde le focus -------------
await page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name: 'Courses' }).tap();
await page.waitForTimeout(400);
const dock = page.locator('.app-dock');
const dockShown = () => dock.evaluate((el) => getComputedStyle(el).opacity !== '0');
await page.locator('#grocery-input').tap();
await page.waitForTimeout(400);
check('focus sans clavier (pas de rétrécissement) : barre visible', await dockShown());
await page.setViewportSize({ width: 390, height: 500 });
await page.waitForTimeout(600);
check('clavier ouvert (viewport rétréci) : barre masquée', !(await dockShown()));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
check('clavier fermé, focus conservé : barre revenue',
  (await dockShown()) && (await page.evaluate(() => document.activeElement?.id === 'grocery-input')));
await page.setViewportSize({ width: 390, height: 500 });
await page.waitForTimeout(400);
await page.locator('#grocery-input').blur();
await page.waitForTimeout(500);
check('blur : barre visible', await dockShown());
await page.setViewportSize({ width: 390, height: 844 });

// --- 6. Petits et grands écrans ---------------------------------------------------
const small = await browser.newContext({ ...devices['iPhone SE'], viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 });
const p320 = await small.newPage();
p320.on('pageerror', (e) => errors.push(String(e)));
await seed(p320, 'budget');
await p320.getByRole('button', { name: 'Ajouter des compléments pour AL' }).tap();
await p320.locator('#bonus-a').fill('120,50');
await p320.locator('#bonus-a').blur();
await p320.waitForTimeout(250);
check('320 px : pas de débordement horizontal', await p320.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
await shot(p320, '09-budget-320');
await small.close();

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pd = await desk.newPage();
pd.on('pageerror', (e) => errors.push(String(e)));
await seed(pd, 'maison');
await pd.getByRole('button', { name: 'Réglages', exact: true }).click();
await pd.getByRole('dialog', { name: 'Réglages' }).waitFor();
await pd.waitForTimeout(500);
await pd.locator('#rates-title').scrollIntoViewIfNeeded();
await shot(pd, '10-reglages-1440');
await desk.close();

check('aucune erreur console', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nQA budget-coquille : tout est vert.' : `\nQA budget-coquille : ${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
