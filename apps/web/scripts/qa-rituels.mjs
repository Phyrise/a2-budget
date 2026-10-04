/**
 * QA visuelle des rituels (agent RITUELS V3) : barre, cercle (3 étapes,
 * clôture, relecture), lanterne (préparation, en cours, fin), carnet —
 * à 390×844 et 1440×900, avec un état V2 réaliste construit par @a2/core.
 *
 * Usage (serveur de dev déjà lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5182 --strictPort &
 *   node apps/web/scripts/qa-rituels.mjs [port]
 * Captures : apps/web/qa/rituels/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5182);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'rituels');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;

/** Construit dans la page un état V2 valide (14 jours de vie commune). */
async function seed(page, { circles = false, lanterns = false } = {}) {
  await page.goto(`${APP}?module=maison`);
  const result = await page.evaluate(
    async ({ entry, circles, lanterns }) => {
      const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
      const now = new Date();
      const day = (n) => {
        const d = core.addDays(now, n);
        d.setHours(19, 30, 0, 0);
        return d;
      };
      let s = core.emptyAppState();
      s.budget.settings.personA.name = 'AL';
      s.budget.settings.personB.name = 'AC';
      const created = core.localDateKey(day(-20));
      const iso = core.isoWeekday(now);
      const mk = (input) => core.createTask(input, created);
      const tasks = [
        mk({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily', effort: 1 }),
        mk({ id: 't-vaisselle', title: 'Faire la vaisselle', assignee: 'b', recurrence: 'daily', effort: 2 }),
        mk({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'b', recurrence: 'weekly', weeklyDay: (iso % 7) + 1, effort: 2 }),
        mk({ id: 't-aspirateur', title: 'Passer l’aspirateur', assignee: 'b', recurrence: 'weekly', weeklyDay: iso, effort: 3 }),
        mk({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'monthly', monthlyDay: now.getDate(), effort: 3 }),
        mk({ id: 't-bureau', title: 'Ranger le bureau', assignee: 'a', recurrence: 'none', effort: 2 }),
        mk({ id: 't-courrier', title: 'Trier le courrier', assignee: 'a', recurrence: 'daily', effort: 1 }),
      ];
      s = { ...s, chores: { ...s.chores, tasks } };
      let n = 0;
      const toggle = (id, d) => {
        n += 1;
        const r = core.toggleTaskToday(s, id, d, `c-${n}`);
        s = r.state;
      };
      for (let k = 14; k >= 1; k--) {
        const d = day(-k);
        toggle('t-vaisselle', d);
        if (k % 3 !== 0) toggle('t-plantes', d);
        if (k % 4 === 0) toggle('t-courrier', d);
      }
      // Aujourd'hui : une seule tâche faite, le reste attend.
      toggle('t-plantes', new Date(now.getTime() - 3600_000));
      if (circles) {
        const lastWeek = core.weekStartKey(core.addDays(now, -7));
        s = {
          ...s,
          rituals: core.saveCircle(s.rituals, {
            id: 'circle-prev',
            weekStart: lastWeek,
            heldAt: day(-7).toISOString(),
            gratitude: [
              { from: 'a', to: 'b', text: 'Merci d’avoir fait la vaisselle 6 fois cette semaine' },
              { from: 'b', to: 'a', text: 'Merci pour le petit-déjeuner de dimanche' },
            ],
            burdens: [{ who: 'b', text: 'J’ai eu du mal avec le rythme du travail.' }],
            intentions: ['Une balade ensemble'],
          }),
        };
      }
      if (lanterns) {
        let focus;
        [25, 10, 15].forEach((m, i) => {
          focus = core.addFocusSession(focus, { id: `f-${i}`, startedAt: day(-i - 2).toISOString(), minutes: m, who: i === 1 ? 'both' : 'a' }).focus;
        });
        s = { ...s, focus };
      }
      const v = core.validateAppState(s);
      if (!v.ok) return { ok: false, reason: v.reason };
      localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
      localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', forestMotion: 'still', guardianSeen: false, offlineAnnounced: true }));
      return { ok: true, stage: s.forest.growthStage, creatures: s.forest.unlockedCreatureIds };
    },
    { entry: coreEntry, circles, lanterns },
  );
  if (!result.ok) throw new Error(`État invalide : ${result.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  await page.waitForTimeout(800);
  return result;
}

const shot = async (page, name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('capture', name);
};

const errors = [];
const browser = await chromium.launch({ args: process.env.GL === 'off' ? ['--disable-gpu', '--disable-webgl'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const only = process.env.ONLY; // « m » ou « d » pour une seule taille
for (const vp of [
  { tag: 'm', width: 390, height: 844 },
  { tag: 'd', width: 1440, height: 900 },
].filter((v) => !only || v.tag === only)) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.tag === 'm' ? 2 : 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${vp.tag} ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${vp.tag} console ${m.text()}`);
  });
  await page.clock.install();
  const seeded = await seed(page, { circles: true, lanterns: true });
  console.log(vp.tag, 'stade', seeded.stage, seeded.creatures.join(','));

  // Barre des rituels.
  const bar = page.locator('section.rituals');
  await bar.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -160));
  await shot(page, `${vp.tag}-01-barre`);
  await bar.screenshot({ path: join(outDir, `${vp.tag}-01b-barre-seule.png`) });

  // Cercle : trois étapes, clôture, relecture.
  await bar.getByRole('button', { name: 'Cercle de la semaine' }).click();
  const circle = page.getByRole('dialog', { name: 'Cercle de la semaine' });
  await circle.waitFor();
  await circle.locator('.ritual-chip').first().click();
  await shot(page, `${vp.tag}-02-cercle-merci`);
  await circle.locator('textarea').nth(1).fill('Merci pour ta patience, vraiment.');
  await circle.getByRole('button', { name: 'Continuer' }).click();
  await circle.locator('textarea').first().fill('J’ai eu du mal avec les soirées de la semaine.');
  await shot(page, `${vp.tag}-03-cercle-poids`);
  await circle.getByRole('button', { name: 'Continuer' }).click();
  await shot(page, `${vp.tag}-04-cercle-ajuster`);
  const apply = circle.locator('.circle-suggestion .btn').first();
  if (await apply.count()) await apply.click();
  await circle.locator('.ritual-chip').filter({ hasText: 'Une balade ensemble' }).click();
  await circle.getByRole('button', { name: 'Clore le cercle' }).click();
  await shot(page, `${vp.tag}-05-cercle-clos`);
  await circle.getByRole('button', { name: 'Retourner dans la forêt' }).click();
  for (let i = 0; i < 4; i++) {
    const t0 = Date.now();
    await page.evaluate(() => 1);
    console.log(`  réactivité après le cercle : ${Date.now() - t0} ms`);
    await page.waitForTimeout(500);
  }
  await shot(page, `${vp.tag}-06-apres-cercle`);
  await bar.scrollIntoViewIfNeeded();
  await bar.getByRole('button', { name: /Cercle de la semaine, tenu/ }).click();
  await circle.waitFor();
  await shot(page, `${vp.tag}-07-cercle-relire`);
  await circle.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await circle.waitFor({ state: 'hidden' });

  // Lanterne : préparation, en cours, fin.
  await bar.scrollIntoViewIfNeeded();
  await bar.getByRole('button', { name: /lanterne/i }).click();
  const lanternDialog = page.getByRole('dialog', { name: 'Allumer une lanterne' });
  await lanternDialog.waitFor();
  await lanternDialog.locator('.ritual-chip').first().click();
  await shot(page, `${vp.tag}-08-lanterne-preparer`);
  await lanternDialog.getByRole('button', { name: 'Allumer la lanterne' }).click();
  const running = page.getByRole('dialog', { name: 'Lanterne allumée', exact: true });
  await running.waitFor();
  await page.clock.fastForward('03:00');
  await shot(page, `${vp.tag}-09-lanterne-en-cours`);
  await page.clock.fastForward('07:10');
  const done = page.getByRole('dialog', { name: 'Lanterne', exact: true });
  await done.waitFor();
  await page.waitForTimeout(900);
  await shot(page, `${vp.tag}-10-lanterne-fin`);
  await done.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await done.waitFor({ state: 'hidden' });

  // Carnet.
  await bar.scrollIntoViewIfNeeded();
  await bar.getByRole('button', { name: 'Carnet de la forêt' }).click();
  const carnet = page.getByRole('dialog', { name: 'Carnet de la forêt' });
  await carnet.waitFor();
  await page.waitForTimeout(600);
  await shot(page, `${vp.tag}-11-carnet`);
  await carnet.locator('.sheet__body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot(page, `${vp.tag}-12-carnet-fin`);
  await context.close();
}

await browser.close();
console.log(errors.length ? `ERREURS :\n${errors.join('\n')}` : 'Aucune erreur de page.');
