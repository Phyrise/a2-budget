/**
 * QA visuelle du Calendrier (agent CALENDRIER-UI, V3.2) : état vide, semaine
 * chargée, jour touché, mois suivant, saisie rapide qui pré-remplit la
 * feuille, édition d'un anniversaire, navigation clavier dans la grille,
 * à 390 × 844 et 1440 × 900. État injecté (fixtures @a2/core, validateAppState).
 *
 * Usage (serveur de dev lancé depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5183 --strictPort &
 *   node apps/web/scripts/qa-calendar.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/calendar/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5183);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'calendar');
mkdirSync(outDir, { recursive: true });

const BASE = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="../../scripts/qa-calendar.fixtures.ts"></script></body></html>\n`,
);

const browser = await chromium.launch();
const errors = [];
const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok });
  console.log(ok ? 'ok  ' : 'FAIL', label, detail);
};

async function getFixtures() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
  await page.goto(`${BASE}qa/calendar/fixtures.html`);
  await page.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
  const fx = await page.evaluate(() => window.__fixtures);
  await page.close();
  return fx;
}

const fixtures = await getFixtures();
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

async function open(state, device = PHONE) {
  const context = await browser.newContext({ ...device, locale: 'fr-FR' });
  await context.addInitScript(
    ([key, uiKey, value]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(uiKey, JSON.stringify({ module: 'calendar', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    },
    [KEY, UI_KEY, state],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${BASE}?module=calendar`);
  await page.waitForSelector('#calendar-title');
  await page.waitForTimeout(900);
  return { context, page };
}

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: join(outDir, `${name}.png`), ...opts });
  console.log('shot', name);
}

async function step(name, fn) {
  if (filter && !name.includes(filter)) return;
  console.log(`\n— ${name}`);
  try {
    await fn();
  } catch (e) {
    check(`${name} : exception`, false, String(e).split('\n')[0]);
  }
}

await step('vide', async () => {
  const { context, page } = await open(fixtures.empty);
  await shot(page, 'phone-empty', { fullPage: true });
  check('état vide illustré', (await page.locator('.cal-empty img').count()) === 1);
  check('aujourd’hui marqué', (await page.locator('.cal-day.is-today[aria-current="date"]').count()) === 1);
  await context.close();
});

await step('semaine', async () => {
  const { context, page } = await open(fixtures.busy);
  await shot(page, 'phone-busy-top');
  await shot(page, 'phone-busy-full', { fullPage: true });
  await page.evaluate(() => {
    const el = document.getElementById('cal-upcoming-title');
    window.scrollTo(0, (el?.getBoundingClientRect().top ?? 0) + window.scrollY - 110);
  });
  await page.waitForTimeout(300);
  await shot(page, 'phone-upcoming');
  check('À venir ne répète pas le jour montré', (await page.locator('.cal-upcoming-section .cal-upcoming__heading', { hasText: 'Aujourd’hui' }).count()) === 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const ages = await page.locator('.cal-event__age').allTextContents();
  check('âge seulement si l’année est connue', ages.length >= 1 && ages.every((t) => /32|ans/.test(t)), JSON.stringify(ages));
  check('anniversaire de Léa sans âge', (await page.locator('.cal-event--birthday', { hasText: 'Anniversaire de Léa' }).locator('.cal-event__age').count()) === 0);
  check('« Demain » dans À venir', (await page.locator('.cal-upcoming__heading', { hasText: 'Demain' }).count()) >= 1);
  // Le jour à quatre événements : « + ».
  const busyCell = page.locator('.cal-day', { has: page.locator('.cal-day__more') });
  check('pastille « + » au-delà de trois', (await busyCell.count()) === 1);
  await busyCell.first().click();
  await page.waitForTimeout(300);
  check('le jour touché montre ses 4 événements', (await page.locator('.cal-day-panel .cal-event').count()) === 4);
  await page.locator('.cal-day-panel').scrollIntoViewIfNeeded();
  await shot(page, 'phone-day-selected');
  // Clavier : flèche droite → jour suivant sélectionné.
  await busyCell.first().focus();
  const before = await page.locator('.cal-grid [aria-selected="true"] button').getAttribute('data-date');
  await page.keyboard.press('ArrowRight');
  const after = await page.locator('.cal-grid [aria-selected="true"] button').getAttribute('data-date');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-date'));
  check('flèche droite : jour suivant choisi et focalisé', before !== after && focused === after, `${before} → ${after}`);
  await page.keyboard.press('PageDown');
  const title = await page.locator('#calendar-title').innerText();
  check('Page suiv. : mois suivant', !title.includes(new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date())), title);
  await context.close();
});

await step('mois', async () => {
  const { context, page } = await open(fixtures.busy);
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await page.waitForTimeout(400);
  check('« Aujourd’hui » visible ailleurs', await page.getByRole('button', { name: 'Revenir à aujourd’hui' }).isVisible());
  check('aperçu du mois', /^En /.test(await page.locator('#cal-day-title').innerText()));
  await shot(page, 'phone-next-month', { fullPage: true });
  await page.getByRole('button', { name: 'Revenir à aujourd’hui' }).click();
  await page.waitForTimeout(300);
  check('retour au jour présent', (await page.locator('.cal-day.is-today.is-selected').count()) === 1);
  await context.close();
});

await step('saisie', async () => {
  const { context, page } = await open(fixtures.busy);
  await page.locator('#cal-quick-input').fill('dîner chez Léa samedi 20h');
  await page.locator('#cal-quick-input').press('Enter');
  await page.waitForTimeout(500);
  check('titre pré-rempli', (await page.locator('#event-title').inputValue()) === 'Dîner chez Léa');
  check('heure pré-remplie', (await page.locator('#event-time').inputValue()) === '20:00');
  check('nature repas', await page.locator('input[name="event-kind"][value="repas"]').isChecked());
  await shot(page, 'phone-sheet-quick');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(600);
  await shot(page, 'phone-after-add');
  // Anniversaire avec année : édition.
  await page.locator('.cal-event--birthday').first().click();
  await page.waitForTimeout(500);
  check('année de naissance pré-remplie', (await page.locator('#event-birth-year').inputValue()) === '1994');
  await shot(page, 'phone-sheet-birthday', { fullPage: true });
  await context.close();
});

await step('bureau', async () => {
  const { context, page } = await open(fixtures.busy, DESKTOP);
  await shot(page, 'desktop-busy');
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'desktop-next-month');
  await page.getByRole('button', { name: 'Revenir à aujourd’hui' }).click();
  await page.locator('.cal-day-panel button[aria-label^="Ajouter un événement"]').click();
  await page.waitForTimeout(500);
  await shot(page, 'desktop-sheet');
  await context.close();
  const empty = await open(fixtures.empty, DESKTOP);
  await shot(empty.page, 'desktop-empty');
  await empty.context.close();
});

await browser.close();
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications`);
if (errors.length) console.log('Erreurs :\n' + errors.join('\n'));
process.exit(failed.length || errors.length ? 1 : 0);
