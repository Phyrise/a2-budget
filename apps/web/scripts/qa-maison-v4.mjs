/**
 * QA Maison V4 (agent UI-MAISON-LANTERNES), 390 × 844, état injecté
 * (fixtures @a2/core, validateAppState) :
 * - envol de la luciole : depuis la case (immédiat, la ligne est là) et
 *   depuis le menu ⋯ (après la fermeture de la feuille, rien ne recouvre
 *   la case) — trace DEV `window.__maisonPulses` ;
 * - lanterne lancée depuis le menu ⋯ : bandeau compact au-dessus de la
 *   navigation, la forêt visible au-dessus ;
 * - fin de lanterne : floraison, « Nouvelle lanterne débloquée », la poser,
 *   carnet des lanternes ;
 * - carnet sans triche : silhouettes à part, aucune URL de vrai sprite,
 *   menu contextuel bloqué, stades à venir sans peinture.
 *
 * Usage (depuis la racine du worktree, serveur de dev lancé sur le port) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5182 --strictPort &
 *   node apps/web/scripts/qa-maison-v4.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/maison-v4/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5182);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'maison-v4');
mkdirSync(outDir, { recursive: true });

const BASE = `http://127.0.0.1:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const UI_KEY = 'a2-budget:ui:v1';

writeFileSync(
  join(outDir, 'fixtures.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>fixtures</title></head>
<body><script type="module" src="../../scripts/qa-maison-v4.fixtures.ts"></script></body></html>\n`,
);

const browser = await chromium.launch();
const errors = [];
const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok });
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(detail));
};

const fxPage = await browser.newPage();
fxPage.on('pageerror', (e) => errors.push(`fixtures: ${e}`));
await fxPage.goto(`${BASE}qa/maison-v4/fixtures.html`);
await fxPage.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
const fixtures = await fxPage.evaluate(() => window.__fixtures);
await fxPage.close();

const VP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(state, { motion = 'full', clock = false } = {}) {
  const context = await browser.newContext({ ...VP, locale: 'fr-FR' });
  await context.addInitScript(
    ([key, uiKey, value, forestMotion]) => {
      if (sessionStorage.getItem('qa-init')) return;
      sessionStorage.setItem('qa-init', '1');
      localStorage.setItem(key, value);
      localStorage.setItem(
        uiKey,
        JSON.stringify({ module: 'maison', forestMotion, guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true }),
      );
    },
    [KEY, UI_KEY, state, motion],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  if (clock) await page.clock.install();
  await page.goto(`${BASE}?module=maison`);
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(clock ? 0 : 1800);
  return { page, context };
}

const persisted = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const lastPulse = (page) => page.evaluate(() => (window.__maisonPulses ?? []).at(-1) ?? null);
const shot = (page, name) => page.screenshot({ path: join(outDir, `${name}.png`) });

// --- 1. Envol de la luciole -------------------------------------------------
{
  const { page, context } = await open(fixtures.home);
  const box = page.getByRole('checkbox', { name: 'Arroser le basilic' });
  await box.scrollIntoViewIfNeeded();
  await box.click();
  const p = await lastPulse(page);
  check('case cochée : luciole lancée tout de suite, depuis la case encore là', p?.taskId === 't-basilic' && p.onRow && p.inSheet && !p.dialogOpen, p);

  await page.getByRole('button', { name: /Options : Tourner les plantes/ }).click();
  const menu = page.getByRole('dialog', { name: 'Tourner les plantes', exact: true });
  await menu.waitFor();
  const before = await page.evaluate(() => (window.__maisonPulses ?? []).length);
  await menu.getByRole('button', { name: /AL l’a fait/ }).click();
  const immediate = await page.evaluate(() => (window.__maisonPulses ?? []).length);
  await page.waitForTimeout(700);
  const q = await lastPulse(page);
  check('menu ⋯ : la luciole attend la fermeture de la feuille', immediate === before, { before, immediate });
  check('menu ⋯ : envol depuis la case, rien ne la recouvre', q?.taskId === 't-plantes' && q.onRow && q.inSheet && !q.dialogOpen, q);
  const done = await persisted(page);
  check('menu ⋯ : la tâche est cochée tout de suite', done.chores.completions.some((c) => c.taskId === 't-plantes'));
  await context.close();
}

// --- 2. Lanterne lancée depuis le menu ⋯ : bandeau + forêt -----------------
{
  const { page, context } = await open(fixtures.home);
  await page.getByRole('button', { name: /Options : Ranger le bureau/ }).click();
  const menu = page.getByRole('dialog', { name: 'Ranger le bureau', exact: true });
  await menu.getByRole('button', { name: '15 minutes', exact: true }).click();
  await menu.getByRole('button', { name: /Allumer une lanterne de 15 minutes/ }).click();
  await page.waitForTimeout(2200);
  const bar = page.locator('.lantern-bar');
  const barBox = await bar.boundingBox();
  const navBox = await page.getByRole('navigation', { name: 'Modules de la maison' }).boundingBox();
  check('bandeau juste au-dessus de la navigation', barBox && navBox && barBox.y + barBox.height <= navBox.y + 1 && navBox.y - (barBox.y + barBox.height) < 40, { barBox, navBox });
  check('bandeau compact (≤ 80 px)', barBox && barBox.height <= 80, barBox);
  const scrollY = await page.evaluate(() => window.scrollY);
  check('la page est remontée vers la forêt', scrollY < 8, scrollY);
  const canvas = await page.locator('canvas').first().boundingBox();
  check('la forêt est visible au-dessus du bandeau', canvas && canvas.y < 200 && canvas.height > 300, canvas);
  check('aucune grande fenêtre ouverte', (await page.locator('dialog[open]').count()) === 0);
  await shot(page, '02-lanterne-bandeau');
  // Ambiance dépliée.
  await bar.locator('.lantern-bar__info').click();
  await page.waitForTimeout(300);
  await shot(page, '03-lanterne-bandeau-ambiance');
  await context.close();
}

// --- 3. Fin : floraison, nouvelle lanterne, la poser, carnet -------------------
{
  const { page, context } = await open(fixtures.home, { motion: 'still', clock: true });
  await page.getByRole('button', { name: /Options : Ranger le bureau/ }).click();
  const menu = page.getByRole('dialog', { name: 'Ranger le bureau', exact: true });
  await menu.getByRole('button', { name: '5 minutes', exact: true }).click();
  await menu.getByRole('button', { name: /Allumer une lanterne de 5 minutes/ }).click();
  await page.clock.fastForward('05:10');
  const end = page.getByRole('region', { name: 'Fin de la lanterne' });
  await end.waitFor();
  await page.clock.runFor(2000);
  const text = await end.innerText();
  check('fin : floraison et nouvelle lanterne (Oribe)', /a fleuri/.test(text) && /nouvelle lanterne débloquée/i.test(text) && /Oribe/.test(text), text);
  check('fin : proposer de cocher la tâche liée', /Cocher «\s?Ranger le bureau\s?»/.test(text), text);
  await shot(page, '04-lanterne-fin');
  await end.getByRole('button', { name: 'La poser', exact: true }).click();
  await page.clock.runFor(300);
  check('nouvelle lanterne posée dans la forêt', (await persisted(page)).focus.selectedLantern === 'oribe');
  await end.getByRole('button', { name: 'Le carnet', exact: true }).click();
  await page.clock.runFor(900);
  const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
  check('carnet ouvert sur les lanternes (Oribe posée)', /L’Oribe du sous-bois/.test(await carnet.locator('.carnet-lantern-preview').innerText()));
  const locked = await carnet.locator('.carnet-lantern.is-locked img').evaluateAll((imgs) => imgs.map((i) => i.src));
  check('lanternes verrouillées : silhouettes seulement (4)', locked.length === 4 && locked.every((s) => /-silhouette/.test(s)), locked);
  await shot(page, '05-carnet-lanternes');
  await context.close();
}

// --- 4. Carnet sans triche ---------------------------------------------------
{
  const { page, context } = await open(fixtures.home, { motion: 'still' });
  await page.getByRole('button', { name: 'Carnet de la forêt' }).click();
  const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
  await carnet.waitFor();
  await page.waitForTimeout(700);
  const unmet = await carnet.locator('.carnet-creature.is-unmet img').evaluateAll((imgs) => imgs.map((i) => i.src));
  check('créatures non rencontrées : 4 silhouettes', unmet.length === 4 && unmet.every((s) => /silhouette-/.test(s)), unmet);
  const ids = ['leaf-sprite', 'ember-wisp', 'mushroom-pip', 'water-drip'];
  const leaked = await page.evaluate(
    (list) => [...document.querySelectorAll('img')].map((i) => i.src).filter((s) => list.some((id) => s.includes(`/${id}`)) && !/silhouette-/.test(s)),
    ids,
  );
  check('aucune URL de vrai sprite non rencontré dans la page', leaked.length === 0, leaked);
  const met = await carnet.locator('.carnet-creature:not(.is-unmet) img').count();
  check('créatures rencontrées : vraie image (kodama + 2)', met === 3, met);
  const blocked = await carnet.locator('.carnet-creature.is-unmet img').first().evaluate((img) => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    img.dispatchEvent(e);
    return e.defaultPrevented && img.getAttribute('draggable') === 'false';
  });
  check('menu contextuel et appui long bloqués', blocked);
  check('stades à venir : brume, pas de peinture', (await carnet.locator('.carnet-stage.is-future img').count()) === 0);
  await shot(page, '06-carnet-creatures');
  await context.close();
}

await browser.close();
const failed = checks.filter((c) => !c.ok);
check('aucune erreur console', errors.length === 0, errors);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications ok`);
process.exit(failed.length === 0 && errors.length === 0 ? 0 : 1);
