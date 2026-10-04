/**
 * QA CORRECTIONS V3.1 (Chromium, 390 × 844).
 *
 * 1. Lanterne : floraison sonore seulement menée au bout, jamais après un
 *    arrêt anticipé, jamais si le son de la lanterne est coupé (harnais :
 *    store réel + WorldProvider + useSoundEvents + useLanternController,
 *    horloge simulée).
 * 2. Contexte audio : mis en veille au repos (après un geste sans son, après
 *    le dernier son) et tout de suite quand les petits sons sont coupés.
 * 3. Clavier (app réelle, état réaliste @a2/core) : hauteur réduite sans
 *    clavier (écran partagé) → barre visible ; rotation clavier ouvert →
 *    barre gardée cachée, puis revenue quand le clavier se ferme.
 *
 * Usage (serveur de dev déjà lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5187 --strictPort &
 *   node apps/web/scripts/qa-corrections-v31.mjs [port]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5187);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'corrections-v31');
mkdirSync(outDir, { recursive: true });
const APP = `http://localhost:${port}/a2-budget/`;
const KEY = 'a2-budget:state:v1';
const failures = [];
const errors = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};

writeFileSync(
  join(outDir, 'harness.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QA corrections</title></head>
<body><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'harness.tsx'),
  `import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as core from '@a2/core';
import { AppProvider, useApp } from '../../src/state/store';
import { WorldProvider } from '../../src/world/WorldContext';
import { useSoundEvents, soundEngine } from '../../src/app/sound';
import { setSoundEnabled } from '../../src/app/sound/prefs';
import { lantern } from '../../src/features/rituals/lantern/lanternStore';
import { useLanternController } from '../../src/features/rituals/lantern/useLanternController';

const w = window as unknown as Record<string, unknown>;
Object.assign(w, { __core: core, __sound: soundEngine, __lantern: lantern, __setSound: setSoundEnabled });
const records: Array<{ cue: string }> = [];
w.__records = records;
soundEngine.subscribe((r) => records.push(r));
function Shell() {
  const ctx = useApp();
  useSoundEvents();
  useLanternController({ onFinished: () => undefined });
  useEffect(() => { w.__app = ctx; }, [ctx]);
  return <pre>{ctx.appState ? 'ready' : 'loading'}</pre>;
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><AppProvider><WorldProvider><Shell /></WorldProvider></AppProvider></StrictMode>,
);
`,
);

const browser = await chromium.launch();
const track = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
};
const harness = `${APP}qa/corrections-v31/harness.html`;

// --- 1. Lanterne (horloge simulée) -------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  track(page);
  await page.clock.install();
  await page.goto(harness);
  await page.waitForFunction(() => window.__app?.appState != null);
  await page.mouse.click(10, 10); // geste : débloque le son
  const sessions = () => page.evaluate(() => window.__app.appState.focus?.sessions?.length ?? 0);
  const lanternCues = () => page.evaluate(() => window.__records.filter((r) => r.cue === 'lantern').length);
  const reset = () => page.evaluate(() => { window.__lantern.reset(); window.__records.length = 0; });

  await page.evaluate(() => { window.__lantern.setSound('rain'); window.__lantern.start({ minutes: 1, who: 'a', label: 'Plier le linge' }); });
  await page.clock.runFor(62_000);
  await page.waitForTimeout(100);
  check('lanterne menée au bout : une seule floraison', (await lanternCues()) === 1, await lanternCues());
  check('lanterne menée au bout : session mémorisée', (await sessions()) === 1);

  await reset();
  await page.evaluate(() => window.__lantern.start({ minutes: 5, who: 'b' }));
  await page.clock.runFor(95_000);
  await page.evaluate(() => window.__lantern.stop());
  await page.clock.runFor(1_000);
  await page.waitForTimeout(100);
  check('arrêt anticipé (1 min) : session mémorisée', (await sessions()) === 2);
  check('arrêt anticipé : aucune floraison', (await lanternCues()) === 0, await lanternCues());

  await reset();
  await page.evaluate(() => { window.__lantern.setSound('off'); window.__lantern.start({ minutes: 1, who: 'both' }); });
  await page.clock.runFor(62_000);
  await page.waitForTimeout(100);
  check('son de la lanterne coupé : aucune floraison', (await lanternCues()) === 0, await lanternCues());
  check('son coupé : session quand même mémorisée', (await sessions()) === 3);
  await page.close();
}

// --- 2. Veille du contexte audio -----------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  track(page);
  await page.goto(harness);
  await page.waitForFunction(() => window.__app?.appState != null);
  const state = () => page.evaluate(() => window.__sound.state());
  check('aucun contexte avant un geste', (await state()) === 'absent');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  check('geste : contexte réveillé', (await state()) === 'running', await state());
  await page.waitForTimeout(2200);
  check('geste sans son : contexte en veille ~1,5 s après', (await state()) === 'suspended', await state());
  await page.mouse.click(10, 10);
  await page.evaluate(() => window.__sound.play('growth'));
  await page.waitForTimeout(2000);
  check('pendant un son : contexte actif', (await state()) === 'running', await state());
  await page.waitForTimeout(3000);
  check('après le dernier son : contexte en veille', (await state()) === 'suspended', await state());
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__setSound(false));
  await page.waitForTimeout(200);
  check('petits sons coupés : veille immédiate', (await state()) === 'suspended', await state());
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  check('petits sons coupés : un geste ne réveille plus le contexte', (await state()) === 'suspended', await state());
  await page.evaluate(() => window.__setSound(true));
  await page.close();
}

// --- 3. Clavier ------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  track(page);
  await page.goto(`${APP}?module=courses`);
  const r = await page.evaluate(async (entry) => {
    const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
    const s = core.emptyAppState();
    const key = core.currentMonthKey(new Date());
    s.budget.months = [core.createMonthRecord(key, s.budget.settings)];
    s.budget.selectedMonth = key;
    const v = core.validateAppState(s);
    if (!v.ok) return v;
    localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'courses', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    return { ok: true };
  }, coreEntry);
  check('état réaliste valide (validateAppState)', r.ok, r);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  const dock = page.locator('.app-dock');
  const shown = () => dock.evaluate((el) => getComputedStyle(el).opacity !== '0');
  const size = async (width, height) => { await page.setViewportSize({ width, height }); await page.waitForTimeout(500); };
  const input = page.locator('#grocery-input');

  await size(390, 500); // écran partagé, aucun champ ciblé
  await input.tap();
  await page.waitForTimeout(400);
  check('hauteur réduite sans clavier, champ ciblé : barre visible', await shown());
  await input.blur();
  await size(390, 844);
  await page.screenshot({ path: join(outDir, '01-courses.png'), type: 'jpeg', quality: 60 });

  await input.tap();
  await size(390, 500); // clavier ouvert
  check('clavier ouvert : barre masquée', !(await shown()));
  await size(844, 200); // rotation, clavier toujours ouvert (viewport rétréci)
  check('rotation clavier ouvert : barre toujours masquée', !(await shown()));
  await size(844, 390); // clavier fermé, champ toujours ciblé
  check('clavier fermé après rotation : barre revenue', await shown());
  await size(844, 200); // clavier rouvert
  check('clavier rouvert : barre masquée', !(await shown()));
  await input.blur();
  await page.waitForTimeout(400);
  check('focus perdu : barre visible', await shown());
  await page.close();
}

// --- 4. Réglages : taux encore différents (capture) ------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  track(page);
  await page.goto(`${APP}?module=budget`);
  await page.evaluate(async (entry) => {
    const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
    const s = core.emptyAppState();
    const key = core.currentMonthKey(new Date());
    s.budget.settings.personB = { ...s.budget.settings.personB, baseRateBps: 3000, variableRateBps: 1500 };
    s.budget.months = [core.createMonthRecord(key, s.budget.settings)];
    s.budget.selectedMonth = key;
    if (!core.validateAppState(s).ok) throw new Error('état invalide');
    localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
    localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'budget', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
  }, coreEntry);
  await page.reload();
  await page.locator('.screen-sheet').waitFor();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const box = page.locator('.shared-rates');
  await box.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  check('réglages : note au présent + « Les rendre communs »',
    (await box.getByRole('note').innerText()).includes('encore des taux différents') &&
      (await box.getByRole('button', { name: 'Les rendre communs' }).isVisible()));
  await box.screenshot({ path: join(outDir, '02-taux-differents.jpg'), type: 'jpeg', quality: 70 });
  await page.close();
}

await browser.close();
check('aucune erreur de page', errors.length === 0, errors.slice(0, 3));
console.log(failures.length === 0 ? '\nQA corrections V3.1 : tout est vert.' : `\n${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
