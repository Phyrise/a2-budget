/**
 * QA V4.1 coquille / Calendrier à 390 × 844 :
 *  1. coins arrondis de la feuille — le fond (bandeau peint ou forêt) a la
 *     même luminosité juste au-dessus de la feuille et dans le petit
 *     triangle laissé par l'arrondi (Maison, Courses, Budget, Calendrier) ;
 *     captures zoomées des deux coins ;
 *  2. Chatbus — traversée fluide : positions image par image (vitesse
 *     régulière, aucun retour en arrière), rebond et inclinaison, une
 *     planche de captures en mouvement ; contrat `catbusRun` (frames).
 * État injecté : fixtures @a2/core de la QA V4 Calendrier (validateAppState).
 *
 * Usage (serveur de dev lancé depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5184 --strictPort &
 *   node apps/web/scripts/qa-coquille-v41.mjs [port] [filtre]
 *
 * Sorties (gitignorées) : apps/web/qa/coquille-v41/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5184);
const filter = process.argv[3] ?? '';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'coquille-v41');
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
await page0.goto(`${BASE}qa/coquille-v41/fixtures.html`);
await page0.waitForFunction(() => window.__fixtures !== undefined, undefined, { timeout: 30_000 });
const fixtures = await page0.evaluate(() => window.__fixtures);
await page0.close();

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(module, extra = {}) {
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
    [KEY, UI_KEY, fixtures.busy, module],
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${BASE}?module=${module}`);
  await page.waitForSelector('.screen-sheet');
  await page.waitForTimeout(1800);
  return { context, page };
}

const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, `${name}.png`), ...opts });

async function step(name, fn) {
  if (filter && !name.includes(filter)) return;
  try {
    await fn();
  } catch (e) {
    check(`${name} : exception`, false, String(e).slice(0, 300));
  }
}

/** Luminance moyenne (0–255) d'un carré 3 × 3 px CSS, lue dans une capture. */
async function lumaAt(page, points) {
  const png = await page.screenshot();
  return page.evaluate(
    async ({ b64, pts, dpr }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return pts.map(([x, y]) => {
        const d = g.getImageData(Math.round((x - 1) * dpr), Math.round((y - 1) * dpr), 3 * dpr, 3 * dpr).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        return s / (d.length / 4);
      });
    },
    { b64: png.toString('base64'), pts: points, dpr: 2 },
  );
}

for (const module of ['maison', 'courses', 'budget', 'calendar']) {
  await step(`coins-${module}`, async () => {
    const { context, page } = await open(module);
    const box = await page.locator('.screen-sheet').first().boundingBox();
    const top = Math.round(box.y);
    await shot(page, `coin-${module}`, { clip: { x: 0, y: top - 46, width: 130, height: 92 } });
    await shot(page, `coin-${module}-droit`, { clip: { x: 260, y: top - 46, width: 130, height: 92 } });
    // Mesure sur un fond uni (peinture et forêt masquées, compagnons du
    // perchoir aussi) : seuls les voiles de la coquille font varier la teinte.
    await page.addStyleTag({
      content: '.app-world > :not(.app-world__shade) { display: none !important } .app-world { background: rgb(150, 150, 150) !important } .world-window > *, .perch { visibility: hidden !important }',
    });
    await page.waitForTimeout(100);
    // Point dans le triangle de l'arrondi (3 px du bord, 3 px sous le haut)
    // et juste au-dessus de la feuille.
    const [cornerL, aboveL, cornerR, aboveR] = await lumaAt(page, [
      [box.x + 3, top + 3],
      [box.x + 3, top - 4],
      [box.x + box.width - 4, top + 3],
      [box.x + box.width - 4, top - 4],
    ]);
    const dl = Math.abs(cornerL - aboveL);
    const dr = Math.abs(cornerR - aboveR);
    check(`${module} : coin gauche fondu dans le bandeau`, dl < 6, `Δ ${dl.toFixed(1)} (coin ${cornerL.toFixed(0)}, dessus ${aboveL.toFixed(0)})`);
    check(`${module} : coin droit fondu dans le bandeau`, dr < 6, `Δ ${dr.toFixed(1)} (coin ${cornerR.toFixed(0)}, dessus ${aboveR.toFixed(0)})`);
    await context.close();
  });
}

await step('catbus', async () => {
  const { context, page } = await open('calendar');
  await page.locator('.cal-add').click();
  await page.waitForTimeout(400);
  await page.locator('#event-sentence').fill('pique-nique au parc dimanche 12h');
  await page.waitForTimeout(150);
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForSelector('.cal-catbus');
  // Positions image par image (rAF) pendant toute la traversée.
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = [];
        const t0 = performance.now();
        const tick = () => {
          const track = document.querySelector('.cal-catbus__track');
          const body = document.querySelector('.cal-catbus__body');
          const tilt = document.querySelector('.cal-catbus__tilt');
          if (!track || !body || !tilt) return resolve(out);
          const r = { left: track.getBoundingClientRect().left, top: body.getBoundingClientRect().top };
          const m = new DOMMatrix(getComputedStyle(tilt).transform);
          out.push({ t: performance.now() - t0, x: r.left, y: r.top, angle: (Math.atan2(m.b, m.a) * 180) / Math.PI });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  writeFileSync(join(outDir, 'catbus-samples.json'), JSON.stringify(samples, null, 1));
  const mid = samples.filter((s) => s.x < 390 && s.x > -200);
  const back = mid.slice(1).filter((s, i) => s.x > mid[i].x).length;
  check('Chatbus : jamais de recul', back === 0, `${back} recul(s) / ${mid.length}`);
  // Vitesse régulière : écart maximal à la droite x(t) des moindres carrés.
  const n = mid.length;
  const mt = mid.reduce((a, s) => a + s.t, 0) / n;
  const mx = mid.reduce((a, s) => a + s.x, 0) / n;
  const slope = mid.reduce((a, s) => a + (s.t - mt) * (s.x - mx), 0) / mid.reduce((a, s) => a + (s.t - mt) ** 2, 0);
  const dev = Math.max(...mid.map((s) => Math.abs(mx + slope * (s.t - mt) - s.x)));
  check('Chatbus : vitesse régulière (écart à la droite < 6 px)', dev < 6, `${dev.toFixed(1)} px, ${(-slope).toFixed(2)} px/ms`);
  const ys = mid.map((s) => s.y);
  check('Chatbus : rebond de course', Math.max(...ys) - Math.min(...ys) >= 4, `${(Math.max(...ys) - Math.min(...ys)).toFixed(1)} px`);
  const angles = mid.map((s) => s.angle);
  check('Chatbus : légère inclinaison', Math.max(...angles) - Math.min(...angles) >= 1, `${Math.min(...angles).toFixed(1)}° → ${Math.max(...angles).toFixed(1)}°`);
  check('Chatbus : traversée complète < 2 s', samples.at(-1).t < 2000, `${samples.at(-1).t.toFixed(0)} ms`);
  await context.close();

  // Planche : six instants de la traversée.
  const { context: c2, page: p2 } = await open('calendar');
  await p2.locator('.cal-add').click();
  await p2.waitForTimeout(400);
  await p2.locator('#event-sentence').fill('goûter samedi 16h');
  await p2.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
  await p2.waitForSelector('.cal-catbus');
  const y = await p2.locator('.cal-catbus').evaluate((el) => el.getBoundingClientRect().top);
  for (let i = 0; i < 6; i += 1) {
    await shot(p2, `catbus-${i}`, { clip: { x: 0, y: y - 20, width: 390, height: 150 } });
    await p2.waitForTimeout(170);
  }
  await c2.close();
});

await step('catbus-frames', async () => {
  // Contrat `catbusRun` : la QA ne peut pas injecter d'images dans le
  // manifeste ; elle vérifie que la pose courante est bien unique à tout instant.
  const { context, page } = await open('calendar');
  await page.locator('.cal-add').click();
  await page.waitForTimeout(400);
  await page.locator('#event-sentence').fill('balade lundi 10h');
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForSelector('.cal-catbus');
  const visible = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const counts = [];
        const tick = () => {
          const imgs = [...document.querySelectorAll('.cal-catbus__bus')];
          if (imgs.length === 0) return resolve(counts);
          counts.push(imgs.filter((el) => Number(getComputedStyle(el).opacity) > 0.5).length);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  check('Chatbus : une seule pose visible à la fois', visible.every((n) => n === 1), JSON.stringify([...new Set(visible)]));
  await context.close();
});

await browser.close();
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications, ${errors.length} erreur(s)`);
for (const e of errors) console.log('  ', e);
process.exit(failed.length || errors.length ? 1 : 0);
