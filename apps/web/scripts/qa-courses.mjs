/**
 * QA visuelle de l'univers Kiki (écran Courses) à 390×844 : liste vide,
 * rayons illustrés + bonjour de Kiki, coup de balai en cours (animations
 * figées), panier à moitié / plein avec Jiji, retour depuis le panier,
 * envol de Kiki, mouvement réduit, bureau 1440×900.
 * État réaliste construit DANS LA PAGE avec @a2/core (validateAppState).
 *
 * Usage (depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5182 --strictPort --host 127.0.0.1 &
 *   node apps/web/scripts/qa-courses.mjs [port]
 * Sorties (gitignorées) : apps/web/qa/courses/*.png
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5182);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'courses');
mkdirSync(outDir, { recursive: true });
const APP = `http://127.0.0.1:${port}/a2-budget/`;

/** Construit l'état dans la page (fonction autonome). */
async function seed({ entry, withItems }) {
  const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
  const now = new Date();
  const ago = (days, h = 18) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, h, 10);
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';
  let g = s.groceries;
  let n = 0;
  const add = (label, when, by) => {
    n += 1;
    const r = core.addGroceryItem(g.items, label, { id: `g-${n}`, now: when, addedBy: by });
    g = { ...g, items: r.items };
    return r.item;
  };
  // Trois passages en caisse passés : de quoi nourrir « Souvent pris ».
  const trips = [
    [20, ['Pommes', 'Lait', 'Pain', 'Café', 'Œufs', 'Lessive']],
    [13, ['Pommes', 'Lait', 'Yaourts', 'Pâtes', 'Café']],
    [6, ['Lait', 'Pain', 'Tomates', 'Café', 'Papier toilette']],
  ];
  for (const [d, labels] of trips) {
    for (const label of labels) {
      const item = add(label, ago(d + 1), 'a');
      g = { ...g, items: core.toggleGroceryItem(g.items, item.id, ago(d)) };
    }
    g = core.clearDoneGroceries(g, ago(d));
  }
  if (withItems) {
    for (const [label, by] of [
      ['2 pommes', 'a'],
      ['Courgettes', 'b'],
      ['Lait x2', 'a'],
      ['Comté 200 g', 'b'],
      ['Baguette', 'a'],
      ['500 g de farine', 'b'],
      ['Thé earl grey', 'a'],
      ['Petits pois surgelés', 'b'],
      ['Liquide vaisselle', 'a'],
    ]) {
      add(label, ago(0, 9), by);
    }
  }
  s = { ...s, groceries: g };
  const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
  if (!v.ok) return { ok: false, reason: v.reason };
  localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
  localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'courses', forestMotion: 'full', guardianSeen: true, offlineAnnounced: true }));
  localStorage.removeItem('a2-budget:courses:v1');
  return { ok: true, items: g.items.length, history: g.history.length };
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open({ withItems = true, vp = MOBILE, reduced = false } = {}) {
  const context = await browser.newContext({ ...vp, locale: 'fr-FR', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${APP}?module=courses`);
  const r = await page.evaluate(seed, { entry: coreEntry, withItems });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet.courses').waitFor();
  await page.waitForTimeout(1200);
  return { context, page };
}

const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, `${name}.png`), ...opts });
const freeze = (page) => page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
const thaw = (page) => page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
const pose = (page) => page.locator('.basket-stage').getAttribute('data-pose');
const fill = (page) => page.locator('.basket-stage').getAttribute('data-fill');
const box = (page, name) => page.getByRole('checkbox', { name, exact: true });

// 1. Liste vide.
{
  const { context, page } = await open({ withItems: false });
  check('liste vide : Kiki et sa liste', await page.locator('.kiki-empty__kiki').isVisible());
  check('liste vide : titre', (await page.locator('.kiki-empty__title').textContent())?.includes('Qu’est-ce qu’il nous faut'));
  check('suggestions illustrées', (await page.locator('.suggestions__icon').count()) > 0);
  await shot(page, '01-liste-vide');
  await context.close();
}

// 2 → 7. Liste avec rayons, coup de balai, panier, retour, envol.
{
  const { context, page } = await open();
  check('bonjour de Kiki (première ouverture du jour)', await page.locator('.kiki-hello').isVisible());
  check('icônes de rayon', (await page.locator('.aisle__icon').count()) >= 5);
  check('Jiji dans le panier vide', (await pose(page)) === 'inBasket');
  await shot(page, '02-rayons-bonjour');

  await box(page, 'Courgettes').click();
  await page.waitForTimeout(260);
  await freeze(page);
  await shot(page, '03-coup-de-balai');
  await thaw(page);
  await page.waitForTimeout(1000);
  await box(page, 'Thé earl grey').click();
  await page.waitForTimeout(420);
  await freeze(page);
  await shot(page, '03b-article-en-vol');
  await thaw(page);
  await page.waitForTimeout(900);
  check('les articles sont tombés dans le panier', (await page.locator('.item-list--basket .item-row').count()) === 2);
  check('le focus n’est pas perdu', await page.evaluate(() => document.activeElement !== document.body));
  check('Jiji dans le sac juste après', (await pose(page)) === 'inBag');

  await box(page, 'Pommes (×2)').click();
  await page.waitForTimeout(150);
  await box(page, 'Baguette').click();
  await page.waitForTimeout(2600);
  check('panier à moitié', (await fill(page)) === 'half');
  check('Jiji prend le thé au repos', (await pose(page)) === 'teacup');
  await page.locator('.basket').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(300);
  await shot(page, '04-panier-moitie');

  // Retour depuis le panier.
  await page.locator('.item-list--basket').getByRole('checkbox', { name: 'Baguette' }).click();
  await page.waitForTimeout(40);
  await page.evaluate(() => document.querySelector('.aisles .item-row.is-returning')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(160);
  await freeze(page);
  await shot(page, '05-retour-du-panier');
  await thaw(page);
  await page.waitForTimeout(700);
  check('décocher ramène l’article dans son rayon', (await page.locator('.aisles .item-row', { hasText: 'Baguette' }).count()) === 1);

  // Tout cocher.
  for (const name of ['Baguette', 'Lait (×2)', 'Comté (200 g)', 'Farine (500 g)', 'Petits pois surgelés', 'Liquide vaisselle']) {
    const b = box(page, name);
    if ((await b.count()) === 0) {
      console.log(`  (case introuvable : ${name})`);
      continue;
    }
    await b.first().click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2600);
  check('panier plein', (await fill(page)) === 'full');
  check('Jiji sur le panier quand tout est coché', (await pose(page)) === 'onBasket');
  check('Kiki tient le panier', await page.locator('.kiki-done').isVisible());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await shot(page, '06-panier-plein');

  // Envol.
  await page.locator('.basket').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Vider le panier', exact: true }).click();
  await page.waitForTimeout(650);
  await freeze(page);
  check('Kiki s’envole', await page.locator('.kiki-flight').isVisible());
  await shot(page, '07-envol');
  await thaw(page);
  await page.waitForTimeout(1200);
  check('toast après l’envol', (await page.locator('.toast').textContent())?.includes('rangés dans l’historique'));
  check('envol terminé', (await page.locator('.kiki-flight').count()) === 0);
  await shot(page, '08-apres-envol');

  // Le bonjour ne revient pas le même jour.
  await page.reload();
  await page.locator('.screen-sheet.courses').waitFor();
  await page.waitForTimeout(600);
  check('pas de second bonjour le même jour', (await page.locator('.kiki-hello').count()) === 0);
  await context.close();
}

// Mouvement réduit : fondu simple, mêmes résultats.
{
  const { context, page } = await open({ reduced: true });
  await box(page, 'Courgettes').click();
  await page.waitForTimeout(700);
  check('mouvement réduit : article au panier', (await page.locator('.item-list--basket .item-row').count()) === 1);
  check('mouvement réduit : pas de Kiki balayeuse', (await page.locator('.sweep-fx').count()) === 0 || !(await page.locator('.sweep-fx').first().isVisible()));
  await context.close();
}

// Bureau.
{
  const { context, page } = await open({ vp: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } });
  await box(page, 'Courgettes').click();
  await page.waitForTimeout(1000);
  await shot(page, '09-bureau');
  await context.close();
}

await browser.close();
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications`);
if (errors.length) console.log('Erreurs :\n' + errors.join('\n'));
process.exit(failed.length || errors.length ? 1 : 0);
