/**
 * QA agent SONS V3.1 — petits sons de la forêt.
 *
 * 1. Test unitaire Node de la détection / anti-rafale (src/app/sound/detect.check.mjs).
 * 2. Chromium : store réel (StrictMode) + useSoundEvents + <SoundSetting />,
 *    état réaliste construit avec @a2/core (9 jours de soins : le 10e geste
 *    fait grandir la forêt, rencontrer une créature et venir le gardien).
 *    Vérifie : silence au premier rendu et à l'import, chaque transition,
 *    préférence coupée, page cachée, nœuds WebAudio créés sans erreur.
 * 3. Rendu hors ligne (OfflineAudioContext) de chaque son : niveau et durée.
 *
 * Usage (serveur de dev déjà lancé) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5183 --strictPort &
 *   node apps/web/scripts/qa-sons.mjs [port]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5183);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'sons');
mkdirSync(outDir, { recursive: true });
const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};

// --- 1. Logique pure -------------------------------------------------------
try {
  execFileSync(process.execPath, [join(webRoot, 'src/app/sound/detect.check.mjs')], { stdio: 'inherit' });
  check('test unitaire de détection (node)', true);
} catch (e) {
  check('test unitaire de détection (node)', false, String(e));
}

// --- 2. Harnais Chromium -----------------------------------------------------
writeFileSync(
  join(outDir, 'harness.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QA sons</title></head>
<body style="background:#101814;padding:16px"><div id="root" style="max-width:420px"></div><script type="module" src="./harness.tsx"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'harness.tsx'),
  `import '../../src/styles/base.css';
import '../../src/styles/ui.css';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as core from '@a2/core';
import { AppProvider, useApp } from '../../src/state/store';
import { SoundSetting, useSoundEvents, soundEngine } from '../../src/app/sound';
import { buildBus } from '../../src/app/sound/engine';
import { renderCue } from '../../src/app/sound/voices';

const w = window as unknown as Record<string, unknown>;
w.__core = core;
w.__sound = soundEngine;
const records: unknown[] = [];
w.__records = records;
soundEngine.subscribe((r) => records.push(r));
w.__measure = async (cue: string, who: string, gentle: boolean) => {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, rate * 4, rate);
  const bus = buildBus(ctx, ctx.destination);
  renderCue(bus, cue as never, 0.01, { who: who as never, gentle });
  const buf = await ctx.startRendering();
  let peak = 0, sum = 0, end = 0, nan = false;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]!);
      if (Number.isNaN(v)) nan = true;
      if (v > peak) peak = v;
      sum += v * v;
      if (v > 0.003) end = Math.max(end, i / rate);
    }
  }
  return { peak, rms: Math.sqrt(sum / (buf.length * 2)), end, nan };
};
function Shell() {
  const ctx = useApp();
  useSoundEvents();
  useEffect(() => { w.__app = ctx; }, [ctx]);
  return <div style={{ color: '#eee' }}><SoundSetting /><pre id="state">{ctx.appState ? 'ready' : 'loading'}</pre></div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><AppProvider><Shell /></AppProvider></StrictMode>);
`,
);

const KEY = 'a2-budget:state:v1';
const url = `http://localhost:${port}/a2-budget/qa/sons/harness.html`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 520 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
// Compte les nœuds WebAudio créés (preuve que la synthèse s'exécute).
await page.addInitScript(() => {
  window.__nodes = 0;
  const proto = BaseAudioContext.prototype;
  for (const name of ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource', 'createConvolver']) {
    const orig = proto[name];
    proto[name] = function (...args) { window.__nodes++; return orig.apply(this, args); };
  }
});

const ready = () => page.waitForFunction(() => window.__app?.appState != null);
const settle = (ms = 250) => page.waitForTimeout(ms);
const take = () => page.evaluate(() => window.__records.splice(0).map((r) => (r.who !== 'none' ? `${r.cue}:${r.who}` : r.cue)));

await page.goto(url);
await page.waitForFunction(() => window.__core != null);
const seed = await page.evaluate(() => {
  const c = window.__core;
  let app = c.emptyAppState();
  const today = new Date();
  const day = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 9, 30);
  const created = c.localDateKey(day(-12));
  const mk = (id, title, assignee, extra = {}) => c.createTask({ id, title, assignee, recurrence: 'daily', ...extra }, created);
  app.chores.tasks.push(
    mk('t-a', 'Arroser les plantes', 'a'),
    mk('t-b', 'Sortir les poubelles', 'b', { effort: 3 }),
    mk('t-c', 'Préparer le dîner', 'both', { effort: 2 }),
    mk('t-d', 'Ranger l’entrée', 'unassigned'),
  );
  // Neuf jours de soins : AL arrose chaque jour.
  for (let d = -9; d <= -1; d++) app = c.toggleTaskToday(app, 't-a', day(d), `hist-${d}`).state;
  return { app, valid: c.validateAppState(app).ok, care: app.forest.lifetimeCare, streak: app.forest.currentStreak };
});
check('état réaliste valide (validateAppState)', seed.valid, seed);
check('historique : 9 soins, série de 9', seed.care === 9 && seed.streak === 9, seed);
await page.evaluate(([k, s]) => { localStorage.setItem(k, JSON.stringify(s)); localStorage.removeItem('a2-budget:sound:v1'); }, [KEY, seed.app]);
await page.reload();
await ready();
await settle(700);
check('premier rendu (rechargement) : aucun son', (await take()).length === 0);
check('contexte audio pas créé avant un geste', (await page.evaluate(() => window.__sound.state())) === 'absent');

await page.mouse.click(300, 480);
await settle(150);
check('premier geste : contexte audio débloqué', (await page.evaluate(() => window.__sound.state())) === 'running');

const nodesBefore = await page.evaluate(() => window.__nodes);
const act = async (fn, arg) => { await page.evaluate(fn, arg); await settle(); return take(); };
const toggle = (id) => act((i) => window.__app.toggleHomeTask(window.__app.appState.chores.tasks.find((t) => t.id === i)), id);

let heard = await toggle('t-a');
check('10e soin : lumière d’AL, créature, forêt qui grandit, gardien', JSON.stringify(heard) === JSON.stringify(['done:a', 'creature', 'growth', 'guardian']), heard);
const nodesAfter = await page.evaluate(() => window.__nodes);
check('nœuds WebAudio créés pour l’enchaînement', nodesAfter - nodesBefore > 20, { nodesBefore, nodesAfter });
heard = await toggle('t-a');
check('annuler le fait : note descendante', JSON.stringify(heard) === '["undo"]', heard);
heard = await toggle('t-b');
check('corvée d’AC : version ample', JSON.stringify(heard) === '["chore:b"]', heard);
heard = await toggle('t-c');
check('tâche à deux : carillon ensemble', JSON.stringify(heard) === '["done:both"]', heard);
heard = await act(() => window.__app.skipToday(window.__app.appState.chores.tasks.find((t) => t.id === 't-d')));
check('« pas aujourd’hui » : souffle de vent', JSON.stringify(heard) === '["skip"]', heard);
heard = await act(() => window.__app.saveCircle({ gratitude: [{ from: 'a', to: 'b', text: 'Merci pour le dîner' }], burdens: [], intentions: [] }));
check('cercle de la semaine : deux notes', JSON.stringify(heard) === '["circle"]', heard);
heard = await act(() => window.__app.addFocusSession({ minutes: 10, who: 'a', label: 'Rangement' }));
check('lanterne terminée : floraison', JSON.stringify(heard) === '["lantern"]', heard);
heard = await act(() => window.__app.importJson(window.__app.exportJson()));
check('import d’une sauvegarde : aucun son', heard.length === 0, heard);
await page.evaluate(() => window.__app.addGrocery('2 pommes'));
await settle();
check('courses / budget : aucun son', (await take()).length === 0);

// Préférence coupée par l'interrupteur (stockée dans sa clé dédiée).
await page.getByRole('switch', { name: 'Petits sons' }).click();
await settle();
const pref = await page.evaluate(() => localStorage.getItem('a2-budget:sound:v1'));
check('interrupteur : préférence enregistrée', pref === '{"enabled":false}', pref);
heard = await toggle('t-c');
check('sons coupés : rien', heard.length === 0, heard);
await page.getByRole('switch', { name: 'Petits sons' }).click();
await settle();
check('réactivés : une note douce confirme', JSON.stringify(await take()) === '["done"]');
await page.getByRole('button', { name: 'Écouter' }).click();
await page.getByRole('button', { name: 'Écouter' }).click();
await settle();
check('« Écouter » : un exemple différent à chaque appui', JSON.stringify(await take()) === '["done:a","done:b"]');
const sample = await page.locator('.sound-setting__sample').textContent();
check('« Écouter » : nom de l’exemple annoncé', sample === 'Une tâche faite par AC', sample);
await page.locator('#root').screenshot({ path: join(outDir, 'reglage.png') });

// Page cachée : le contexte se met en veille, rien ne sonne.
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await settle(500);
check('page cachée : contexte en veille', (await page.evaluate(() => window.__sound.state())) === 'suspended');
heard = await toggle('t-c');
check('page cachée : aucun son', heard.length === 0, heard);
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.mouse.click(300, 480);
await settle(150);
check('retour + geste : contexte réveillé', (await page.evaluate(() => window.__sound.state())) === 'running');

// Mouvement réduit : toujours des sons, sans erreur.
await page.emulateMedia({ reducedMotion: 'reduce' });
heard = await toggle('t-c');
check('mouvement réduit : le son reste', heard.length === 1, heard);

// --- 3. Niveau et durée de chaque son (rendu hors ligne) --------------------
const cases = [
  ['done', 'a'], ['done', 'b'], ['done', 'both'], ['done', 'none'], ['chore', 'b'], ['undo', 'none'],
  ['skip', 'none'], ['creature', 'none'], ['growth', 'none'], ['guardian', 'none'], ['circle', 'none'], ['lantern', 'none'],
];
const report = [];
for (const [cue, who] of cases) {
  for (const gentle of [false, true]) {
    const m = await page.evaluate(([c, w, g]) => window.__measure(c, w, g), [cue, who, gentle]);
    report.push({ cue, who, gentle, ...m });
    const maxEnd = cue === 'guardian' ? 3.1 : 1.3;
    const ok = !m.nan && m.peak > 0.01 && m.peak < 0.3 && m.end <= maxEnd;
    if (!gentle || !ok) check(`son ${cue}${who !== 'none' ? `:${who}` : ''}${gentle ? ' (doux)' : ''} : crête ${m.peak.toFixed(3)}, fin ${m.end.toFixed(2)} s`, ok, m);
  }
}
writeFileSync(join(outDir, 'niveaux.json'), JSON.stringify(report, null, 2));

check('aucune erreur dans la page', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nQA sons : tout est vert.' : `\nQA sons : ${failures.length} échec(s).`);
process.exit(failures.length === 0 ? 0 : 1);
