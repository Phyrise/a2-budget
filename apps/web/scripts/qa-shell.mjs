/**
 * QA de la coquille V3.2 (COQUILLE-SONS-DEV), sur le serveur de dev :
 * - 390 × 844 tactile : quatre onglets (lisibles de 320 à 430 px), bandeaux
 *   des univers (Chihiro, Kiki, cèdre pour le Calendrier), accents, carte
 *   « Objectif de la semaine », historique du Calendrier, petits sons des
 *   modules (pièces, kompeitō, balai, clochette), mode développeur (panneau,
 *   aperçus non persistants, bandeau « Aperçu », copie JSON, remise à zéro) ;
 * - 1440 × 900 : fonds portrait des univers en fondu, forêt pour Maison et
 *   Calendrier, panneau DEV.
 * État construit par @a2/core (validateAppState ok).
 *
 * Usage (depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5184 --strictPort &
 *   node apps/web/scripts/qa-shell.mjs [port]
 * Sorties : apps/web/qa/shell/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { seedShellState } from './qa-shell.seed.mjs';

const port = Number(process.argv[2] ?? 5184);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'shell');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;
const STATE_KEY = 'a2-budget:state:v1';

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || detail === '' ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};
const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, `${name}.png`), ...opts });
const nav = (page) => page.getByRole('navigation', { name: 'Modules de la maison' });
const go = async (page, name) => {
  await nav(page).getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(650);
};
const shown = (page, universe, kind) =>
  page.evaluate(
    ([u, k]) => {
      const img = document.querySelector(`.app-world__${k}[data-universe="${u}"]`);
      return img ? { shown: img.classList.contains('is-shown'), opacity: getComputedStyle(img).opacity, src: img.getAttribute('src') } : null;
    },
    [universe, kind],
  );

async function seed(page, module, devMode = false) {
  await page.goto(`${APP}?module=${module}`);
  const r = await page.evaluate(seedShellState, { entry: coreEntry, module, devMode });
  if (!r.ok) throw new Error(`État invalide : ${r.reason}`);
  await page.reload();
  await page.locator('.screen-sheet').first().waitFor();
  await page.waitForTimeout(600);
  return r;
}

/** Enregistre les sons demandés au moteur (même instance de module que l'app). */
async function recordCues(page) {
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/a2-budget/src/app/sound/engine.ts');
    window.__cues = [];
    m.soundEngine.subscribe((rec) => window.__cues.push(rec.cue));
  });
}
const cues = (page) => page.evaluate(() => window.__cues.slice());

const browser = await chromium.launch();
const errors = [];
const track = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
};

// ============================== Mobile 390 × 844 ==============================
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, locale: 'fr-FR' });
await mobile.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${port}` });
const page = await mobile.newPage();
track(page);
const seeded = await seed(page, 'maison');
console.log(`état : stade ${seeded.stage}, ${seeded.lifetimeCare} soins, semaine ${seeded.goal.creditsThisWeek}/${seeded.goal.target} (${seeded.goal.level}, ${seeded.goal.trend})`);

check('quatre onglets', (await nav(page).getByRole('button').count()) === 4);
check('Maison actif', (await nav(page).getByRole('button', { name: 'Maison', exact: true }).getAttribute('aria-current')) === 'page');
await shot(page, '01-maison');

const goal = page.locator('.weekly-goal');
await goal.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const goalText = await goal.innerText();
check('objectif : niveau en mots', /La forêt (se repose|va bien|s’épanouit|dort)/.test(goalText), goalText);
check('objectif : aucun chiffre affiché', !/\d/.test(goalText), goalText);
check('objectif : explique le plafond', goalText.includes('trois soins par jour'), goalText);
await goal.screenshot({ path: join(outDir, '02-objectif-semaine.png') });

// Pilule lisible de 320 à 430 px.
for (const width of [320, 360, 430]) {
  await page.setViewportSize({ width, height: 844 });
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const navEl = document.querySelector('.app-nav');
    const r = navEl.getBoundingClientRect();
    const labels = [...navEl.querySelectorAll('.app-nav__label')];
    return { left: r.left, right: r.right, vw: window.innerWidth, clipped: labels.filter((l) => l.scrollWidth > l.clientWidth + 0.5).map((l) => l.textContent) };
  });
  check(`pilule à ${width} px : dans l’écran, libellés entiers`, m.left >= 0 && m.right <= m.vw && m.clipped.length === 0, m);
  if (width === 320) await page.locator('.app-dock').screenshot({ path: join(outDir, '03-pilule-320.png') });
}
await page.setViewportSize({ width: 390, height: 844 });

// Univers : bandeaux.
await recordCues(page);
await go(page, 'Budget');
let b = await shown(page, 'budget', 'banner');
check('Budget : bandeau Chihiro affiché', b?.shown && Number(b.opacity) > 0.98 && b.src.includes('banner-landscape'), b);
const accent = await page.evaluate(() => getComputedStyle(document.querySelector('.app-nav__item.is-active .icon')).color);
check('Budget : accent or sur l’onglet actif', accent === 'rgb(239, 201, 111)', accent);
await shot(page, '04-budget');

// Sons du budget : pièces (salaire), kompeitō (dépense ajoutée).
const salary = page.locator('#salary-a');
await salary.click();
await salary.fill('2 350');
await salary.blur();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Ajouter une dépense' }).click();
const label = page.locator('[id$="-add-label"]');
await label.fill('Mutuelle');
const amount = page.locator('[id$="-add-amount"]');
await amount.click();
await amount.fill('42');
await amount.press('Enter');
await page.waitForTimeout(400);
let heard = await cues(page);
check('sons du budget : pièces puis kompeitō', heard.includes('coins') && heard.includes('konpeito'), heard);

await go(page, 'Courses');
b = await shown(page, 'courses', 'banner');
check('Courses : bandeau Kiki affiché', b?.shown && Number(b.opacity) > 0.98 && b.src.includes('courses/banner-landscape'), b);
check('Budget : bandeau effacé', (await shown(page, 'budget', 'banner'))?.shown === false);
await shot(page, '05-courses');
await page.getByRole('checkbox', { name: /Lait/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Vider le panier/ }).click();
await page.waitForTimeout(400);
const confirm = page.getByRole('dialog').getByRole('button', { name: /Vider/ });
if (await confirm.count()) await confirm.first().click();
await page.waitForTimeout(400);
heard = await cues(page);
check('sons des courses : balai puis clochette', heard.includes('broom') && heard.includes('shopBell'), heard);

await go(page, 'Calendrier');
b = await shown(page, 'calendar', 'banner');
check('Calendrier : bandeau de la forêt', b?.shown && Number(b.opacity) > 0.98, b);
check('?module=calendar dans l’URL', new URL(page.url()).searchParams.get('module') === 'calendar', page.url());
check('Calendrier : titre focalisé', await page.locator('#calendar-title').evaluate((el) => el === document.activeElement));
await shot(page, '06-calendrier');
await page.getByRole('button', { name: 'Événements passés', exact: true }).click();
const hist = page.getByRole('dialog', { name: 'Événements passés' });
await hist.waitFor();
await page.waitForTimeout(400);
const histText = await hist.innerText();
check('historique : derniers événements passés', histText.includes('Dîner chez Léa et Hugo') && histText.includes('Anniversaire de maman') && !histText.includes('Kyoto'), histText.slice(0, 300));
await shot(page, '07-calendrier-historique');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Mode développeur.
await go(page, 'Maison');
check('pas de bouton DEV par défaut', (await page.locator('.dev-chip').count()) === 0);
await page.getByRole('button', { name: 'Réglages', exact: true }).click();
const settings = page.getByRole('dialog', { name: 'Réglages' });
const devSwitch = settings.getByRole('switch', { name: 'Mode développeur' });
await devSwitch.scrollIntoViewIfNeeded();
await devSwitch.click();
check('interrupteur activé', (await devSwitch.getAttribute('aria-checked')) === 'true');
await settings.locator('.settings-about').screenshot({ path: join(outDir, '08-reglages-dev.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).forest, STATE_KEY);
await page.locator('.dev-chip').click();
const dev = page.getByRole('dialog', { name: 'Mode développeur' });
await dev.waitFor();
await page.waitForTimeout(400);
const devText = await dev.innerText();
check('panneau : stade et soins', devText.includes(`${before.growthStage} / 7`) && devText.includes('Soins cumulés'), devText.slice(0, 200));
check('panneau : constantes', ['DAILY_CREDIT_CAP', 'VITALITY_PER_CREDIT', 'DAILY_DECAY', 'INACTIVITY_GRACE_DAYS', 'GUARDIAN_STREAK', 'WEEKLY_GOAL_LEVELS'].every((c) => devText.includes(c)));
check('panneau : objectif et partage chiffrés', devText.includes(`${seeded.goal.creditsThisWeek} / ${seeded.goal.target}`) && devText.includes('Efforts A · B'));
await shot(page, '09-dev-panneau');
await dev.getByRole('button', { name: 'Copier l’état (JSON)' }).click();
await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
let snap = null;
try {
  snap = JSON.parse(clip);
} catch {
  /* vide */
}
check('copie JSON : progression et constantes', snap?.forestProgress?.stage === before.growthStage && Array.isArray(snap?.constants?.GROWTH_THRESHOLDS), clip.slice(0, 120));

const stageFieldset = dev.locator('fieldset', { hasText: 'Stade' });
await stageFieldset.getByRole('button', { name: '7', exact: true }).click();
await dev.locator('fieldset', { hasText: 'Saison' }).getByRole('button', { name: 'Hiver' }).click();
await page.waitForTimeout(200);
await dev.locator('#dev-previews').scrollIntoViewIfNeeded();
await shot(page, '10-dev-apercus');
await dev.getByRole('button', { name: 'Voir la forêt' }).click();
await page.waitForTimeout(1200);
check('bandeau « Aperçu » visible', await page.getByText('Aperçu — vos données ne changent pas').isVisible());
await shot(page, '11-apercu-stade7-hiver');
const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).forest, STATE_KEY);
check('aperçu : données inchangées', JSON.stringify(after) === JSON.stringify(before));
await page.getByRole('button', { name: 'Revenir à la vraie forêt' }).click();
check('retour au réel : bandeau effacé', (await page.locator('.preview-banner').count()) === 0);
// Quitter le mode efface tout aperçu.
await page.locator('.dev-chip').click();
await dev.waitFor();
await dev.locator('fieldset', { hasText: 'Humeur' }).getByRole('button', { name: 'Florissante' }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('aperçu actif après fermeture du panneau', await page.locator('.preview-banner').isVisible());
await page.getByRole('button', { name: 'Réglages', exact: true }).click();
await settings.getByRole('switch', { name: 'Mode développeur' }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('mode quitté : plus de DEV ni d’aperçu', (await page.locator('.dev-chip').count()) === 0 && (await page.locator('.preview-banner').count()) === 0);

// Sons des univers : légers et courts (rendu hors ligne, même bus que l'app).
for (const cue of ['coins', 'konpeito', 'broom', 'shopBell', 'woodNote']) {
  for (const gentle of [false, true]) {
    const m = await page.evaluate(
      async ([c, g]) => {
        const { buildBus } = await import(/* @vite-ignore */ '/a2-budget/src/app/sound/engine.ts');
        const { renderCue } = await import(/* @vite-ignore */ '/a2-budget/src/app/sound/voices.ts');
        const rate = 44100;
        const ctx = new OfflineAudioContext(2, rate * 3, rate);
        renderCue(buildBus(ctx, ctx.destination), c, 0.01, { who: 'none', gentle: g });
        const buf = await ctx.startRendering();
        let peak = 0;
        let end = 0;
        let nan = false;
        for (let ch = 0; ch < 2; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < d.length; i++) {
            const v = Math.abs(d[i]);
            if (Number.isNaN(v)) nan = true;
            if (v > peak) peak = v;
            if (v > 0.003) end = Math.max(end, i / rate);
          }
        }
        return { peak, end, nan };
      },
      [cue, gentle],
    );
    const ok = !m.nan && m.peak > 0.01 && m.peak < 0.3 && m.end <= 1.2;
    check(`son ${cue}${gentle ? ' (doux)' : ''} : crête ${m.peak.toFixed(3)}, fin ${m.end.toFixed(2)} s`, ok, m);
  }
}
await mobile.close();

// ============================= Ordinateur 1440 × 900 ==========================
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
const dp = await desk.newPage();
track(dp);
await seed(dp, 'maison', true);
await shot(dp, '20-bureau-maison');
await go(dp, 'Budget');
await dp.waitForTimeout(500);
b = await shown(dp, 'budget', 'backdrop');
check('bureau : fond portrait Chihiro', b?.shown && Number(b.opacity) > 0.98 && b.src.includes('banner-portrait'), b);
await shot(dp, '21-bureau-budget');
await go(dp, 'Courses');
await dp.waitForTimeout(500);
b = await shown(dp, 'courses', 'backdrop');
check('bureau : fond portrait Kiki', b?.shown && Number(b.opacity) > 0.98 && b.src.includes('banner-portrait'), b);
check('bureau : Chihiro effacé (fondu)', (await shown(dp, 'budget', 'backdrop'))?.shown === false);
await shot(dp, '22-bureau-courses');
await go(dp, 'Calendrier');
await dp.waitForTimeout(800);
const anyBackdrop = await dp.evaluate(() => [...document.querySelectorAll('.app-world__backdrop.is-shown')].length);
check('bureau : la forêt pour le Calendrier', anyBackdrop === 0);
await shot(dp, '23-bureau-calendrier');
await dp.locator('.dev-chip').click();
await dp.getByRole('dialog', { name: 'Mode développeur' }).waitFor();
await dp.waitForTimeout(400);
await shot(dp, '24-bureau-dev');
await desk.close();

await browser.close();
const real = errors.filter((e) => !/favicon|DevTools|Download the React/.test(e));
check('aucune erreur de page', real.length === 0, real);
console.log(failures.length === 0 ? '\nQA coquille : tout est bon.' : `\nQA coquille : ${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
