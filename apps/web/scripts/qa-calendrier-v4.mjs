/**
 * QA V4 Calendrier / Courses (agent UI-CALENDRIER-COURSES) à 390 × 844 :
 * grille avec tâches et événements, note visible, un seul « + », phrase
 * dans la feuille d'ajout, Chatbus, cochage d'une tâche depuis le
 * Calendrier, états vides Totoro ; Courses : le bandeau ne bouge pas quand
 * on coche (mesures image par image pendant 0–600 ms, avec et sans le
 * correctif), mémoire des rayons. État injecté (fixtures @a2/core,
 * validateAppState).
 *
 * Usage (serveur de dev lancé depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5184 --strictPort &
 *   node apps/web/scripts/qa-calendrier-v4.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/calendrier-v4/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5184);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'calendrier-v4');
mkdirSync(outDir, { recursive: true });

const BASE = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="../../scripts/qa-calendrier-v4.fixtures.ts"></script></body></html>\n`,
);

const browser = await chromium.launch();
const errors = [];
const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok });
  console.log(ok ? 'ok  ' : 'FAIL', label, detail);
};

const page0 = await browser.newPage();
page0.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
await page0.goto(`${BASE}qa/calendrier-v4/fixtures.html`);
await page0.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
const fixtures = await page0.evaluate(() => window.__fixtures);
await page0.close();

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(state, module = 'calendar', extra = {}) {
  const context = await browser.newContext({ ...PHONE, locale: 'fr-FR', ...extra });
  await context.addInitScript(
    ([key, uiKey, value, mod]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(uiKey, JSON.stringify({ module: mod, forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem('a2-budget:courses:v1', JSON.stringify({ greetedOn: today }));
    },
    [KEY, UI_KEY, state, module],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${BASE}?module=${module}`);
  await page.waitForSelector(module === 'calendar' ? '#calendar-title' : '#courses-title');
  await page.waitForTimeout(900);
  return { context, page };
}

const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, `${name}.png`), ...opts });

async function step(name, fn) {
  if (filter && !name.includes(filter)) return;
  console.log(`\n— ${name}`);
  try {
    await fn();
  } catch (e) {
    check(`${name} : exception`, false, String(e).split('\n')[0]);
  }
}

await step('calendrier', async () => {
  const { context, page } = await open(fixtures.busy);
  await shot(page, 'cal-top');
  await shot(page, 'cal-full', { fullPage: true });
  check('un seul bouton d’ajout', (await page.locator('.calendar button[aria-label^="Ajouter"]').count()) === 1);
  check('plus de saisie rapide hors feuille', (await page.locator('#cal-quick-input').count()) === 0);
  check('notes visibles (plume + 1re ligne)', (await page.locator('.cal-event__note').count()) >= 2);
  const apero = await page.locator('.cal-day-panel .cal-event', { hasText: 'Apéro' }).locator('.cal-event__note-text').innerText();
  check('première ligne seulement', apero === 'Inès apporte les olives', apero);
  check('icônes peintes dans la grille', (await page.locator('.cal-day__icon').count()) >= 5);
  check('anneaux de tâches dans la grille', (await page.locator('.cal-day__task').count()) >= 4);
  check('tâche faite il y a 3 jours : anneau plein', (await page.locator('.cal-day__task.is-done').count()) >= 1);
  check('quotidienne absente', (await page.locator('.calendar').getByText('Faire la vaisselle').count()) === 0);
  check('Totoro au paquet-feuille (anniversaire)', (await page.locator('.cal-kind-badge__gift').count()) >= 1);
  const tomorrow = page.locator('.cal-upcoming-section .cal-task', { hasText: 'Sortir les poubelles' });
  check('tâche de demain en lecture', (await tomorrow.count()) === 1 && (await tomorrow.getByRole('checkbox').count()) === 0);

  // Cochage depuis le Calendrier.
  const plants = page.locator('.cal-day-panel .cal-task', { hasText: 'Arroser les plantes' });
  await plants.scrollIntoViewIfNeeded();
  await plants.getByRole('checkbox').click();
  await page.waitForTimeout(250);
  await shot(page, 'cal-task-checked');
  check('cochée depuis le Calendrier', (await plants.getByRole('checkbox').getAttribute('aria-checked')) === 'true');
  const deco = await plants.locator('.cal-task__title').evaluate((el) => getComputedStyle(el).textDecorationLine);
  check('faite = barrée, toujours affichée', deco.includes('line-through'), deco);
  const done = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).chores.completions.some((c) => c.taskId === 't-plantes'), KEY);
  check('fait enregistré (Maison synchronisée)', done);

  // Ajout : l'unique « + » → feuille avec la phrase.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.cal-add').click();
  await page.waitForTimeout(400);
  await page.locator('#event-sentence').fill('pique-nique au parc dimanche 12h');
  await page.waitForTimeout(150);
  await shot(page, 'cal-sheet-sentence');
  check('phrase → titre', (await page.locator('#event-title').inputValue()).toLowerCase().includes('pique-nique'));
  check('phrase → heure', (await page.locator('#event-time').inputValue()) === '12:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(650);
  await shot(page, 'cal-catbus');
  check('le Chatbus traverse', (await page.locator('.cal-catbus').count()) === 1);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('le Chatbus n’élargit pas la page', wide <= 0, `${wide} px`);
  await page.waitForTimeout(1400);
  check('le Chatbus est reparti', (await page.locator('.cal-catbus').count()) === 0);

  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'cal-next-month', { fullPage: true });
  await context.close();
});

await step('mouvement-reduit', async () => {
  const { context, page } = await open(fixtures.busy, 'calendar', { reducedMotion: 'reduce' });
  await page.locator('.cal-add').click();
  await page.locator('#event-sentence').fill('dîner samedi 20h');
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(500);
  check('mouvement réduit : pas de Chatbus', (await page.locator('.cal-catbus').count()) === 0);
  await context.close();
});

await step('vide', async () => {
  const { context, page } = await open(fixtures.empty);
  await shot(page, 'cal-empty', { fullPage: true });
  check('Totoro endormi (jour libre)', (await page.locator('.cal-day-empty__art').count()) === 1);
  check('Totoro au parapluie (À venir)', (await page.locator('.cal-empty__art').count()) === 1);
  check('vide : toujours un seul « + »', (await page.locator('.calendar button[aria-label^="Ajouter"]').count()) === 1);
  await context.close();
});

/** Coche le premier article et mesure le bandeau image par image (0–700 ms). */
async function measureCheck(page, label) {
  await page.evaluate(() => {
    window.__frames = [];
    const t0 = performance.now();
    const banner = () => document.querySelector('.app-world__banner.is-shown') ?? document.querySelector('.app-world__banner');
    const loop = () => {
      const b = banner()?.getBoundingClientRect();
      const title = document.getElementById('courses-title')?.getBoundingClientRect();
      window.__frames.push({
        t: Math.round(performance.now() - t0),
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        vvW: Math.round(window.visualViewport?.width ?? 0),
        scale: window.visualViewport?.scale ?? 1,
        bannerW: b ? Math.round(b.width) : null,
        bannerH: b ? Math.round(b.height) : null,
        titleY: title ? Math.round(title.top) : null,
      });
      if (performance.now() - t0 < 750) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const first = page.locator('.aisles .item-row .check').first();
  await first.click();
  const shots = [];
  for (const at of [0, 150, 300, 450, 600]) {
    const name = `courses-${label}-${String(at).padStart(3, '0')}`;
    await shot(page, name, { clip: { x: 0, y: 0, width: 390, height: 300 } });
    shots.push(name);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => window.__frames);
  writeFileSync(join(outDir, `courses-${label}-frames.json`), JSON.stringify(frames, null, 1));
  return frames;
}

const stable = (frames, key) => new Set(frames.map((f) => f[key])).size === 1;

await step('courses', async () => {
  // Sans le correctif (pour comparaison) : on rend la ligne débordante.
  {
    const { context, page } = await open(fixtures.busy, 'courses');
    await page.addStyleTag({ content: '.screen-sheet.courses { overflow-x: visible !important; }' });
    const frames = await measureCheck(page, 'sans-correctif');
    const maxW = Math.max(...frames.map((f) => f.scrollW));
    console.log(`  sans correctif : largeur du document jusqu’à ${maxW} px (fenêtre ${frames[0]?.innerW} px)`);
    await context.close();
  }
  const { context, page } = await open(fixtures.busy, 'courses');
  const frames = await measureCheck(page, 'avec-correctif');
  check('cocher : le document ne s’élargit pas', frames.every((f) => f.scrollW <= f.innerW), JSON.stringify(frames.map((f) => f.scrollW).slice(0, 12)));
  check('cocher : bandeau de taille fixe', stable(frames, 'bannerW') && stable(frames, 'bannerH'));
  check('cocher : pas de zoom (échelle 1)', frames.every((f) => f.scale === 1));
  check('cocher : titre immobile', stable(frames, 'titleY'));

  // Mémoire des rayons : « café » passe en « Petit-déjeuner »… (premier rayon différent proposé).
  await page.locator('.aisles .item-row', { hasText: 'Café' }).locator('.item-row__label').first().click();
  await page.waitForTimeout(400);
  const select = page.locator('#item-category');
  const options = await select.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  const current = await select.inputValue();
  const target = options.find((o) => o !== current && o !== 'autre') ?? options[0];
  await select.selectOption(target);
  await page.waitForTimeout(150);
  const hint = await page.locator('#item-category-hint').innerText();
  check('feuille : « Je m’en souviendrai… »', hint.includes('Je m’en souviendrai'), hint);
  await shot(page, 'courses-sheet-memory');
  await page.getByRole('dialog').getByRole('button', { name: /Enregistrer/ }).click();
  await page.waitForTimeout(300);
  const toast = await page.locator('.toast').innerText().catch(() => '');
  check('toast de mémoire', toast.includes('Je m’en souviendrai'), toast);
  const memory = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).groceries.categoryMemory, KEY);
  check('rayon mémorisé', JSON.stringify(memory ?? {}).includes(target), JSON.stringify(memory));
  await context.close();
});

await browser.close();
const failed = checks.filter((c) => !c.ok);
check('aucune erreur console / page', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(`\n${checks.length - failed.length - (errors.length ? 1 : 0)}/${checks.length} vérifications OK`);
process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0);
