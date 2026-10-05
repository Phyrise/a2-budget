/**
 * QA de l'agent ASSETS-SAISONS : les variantes saisonnières des manifests
 * (world/manifest.ts → seasons, themes/manifest.ts → budgetTheme.seasons /
 * coursesTheme.seasons) servies par Vite. Vérifie que chaque URL se charge,
 * les dimensions (forêt 1024×1536, LUT 1089×33, bandeaux 1536×1024 / 1024×1536),
 * que la profondeur réutilisée est bien l'URL de base, et que chaque nom de
 * fichier suit le motif « season- » (exclu du précache par la coquille).
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5191 --strictPort &
 *   node apps/web/scripts/qa-saisons-assets.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/saisons-assets/report.json et
 * sheet-*.jpg (planches réduites : forêt par saison + bandeaux).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5191);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, 'qa', 'saisons-assets');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, 'check.html'),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>saisons</title>
<style>body{margin:0;background:#111;color:#eee;font:11px system-ui}
.sheet{display:grid;gap:4px;padding:4px}.sheet figure{margin:0}.sheet img{display:block;width:100%}
figcaption{padding:2px 0}</style></head>
<body><script type="module" src="./check.ts"></script></body></html>\n`,
);
writeFileSync(
  join(outDir, 'check.ts'),
  `import { manifest } from '../../src/world/manifest';
import { budgetTheme, coursesTheme } from '../../src/themes/manifest';

type Row = { key: string; url: string; w: number; h: number; ok: boolean; note?: string };
const rows: Row[] = [];
const load = (url: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
async function check(key: string, url: string | null, w: number, h: number, sheet?: HTMLElement) {
  if (!url) { rows.push({ key, url: '', w: 0, h: 0, ok: false, note: 'absent' }); return; }
  const im = await load(url);
  const name = url.split('/').pop() ?? '';
  const ok = !!im && im.naturalWidth === w && im.naturalHeight === h;
  rows.push({ key, url, w: im?.naturalWidth ?? 0, h: im?.naturalHeight ?? 0, ok,
    note: name.startsWith('season-') ? undefined : 'nom hors motif season-' });
  if (sheet && im) {
    const f = document.createElement('figure');
    f.innerHTML = '<figcaption></figcaption>';
    f.querySelector('figcaption')!.textContent = key;
    f.prepend(im);
    sheet.append(f);
  }
}
function sheet(id: string, cols: number) {
  const s = document.createElement('div');
  s.className = 'sheet'; s.id = id;
  s.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  s.style.width = cols * 180 + 'px';
  document.body.append(s);
  return s;
}
const baseDepth = new Set(Object.values(manifest.stages).map((s) => s.depth));
const seasons = manifest.seasons ?? {};
for (const [name, set] of Object.entries(seasons)) {
  const s = sheet('forest-' + name, 7);
  for (const [n, img] of Object.entries(set!.stages)) {
    await check(name + ' stade ' + n, img.color, 1024, 1536, s);
    const reused = baseDepth.has(img.depth);
    rows.push({ key: name + ' profondeur ' + n, url: img.depth ?? '', w: 0, h: 0,
      ok: reused || !!img.depth, note: reused ? 'profondeur de base' : 'profondeur propre' });
  }
  await check(name + ' LUT nuit', set!.nightLut, 1089, 33);
}
const b = sheet('banners', 4);
for (const [theme, t] of [['budget', budgetTheme], ['courses', coursesTheme]] as const) {
  for (const [season, banners] of Object.entries(t.seasons ?? {})) {
    await check(theme + ' ' + season + ' paysage', banners!.landscape, 1536, 1024, b);
    await check(theme + ' ' + season + ' portrait', banners!.portrait, 1024, 1536, b);
  }
}
(window as unknown as { __qa: unknown }).__qa = {
  seasons: Object.keys(seasons),
  themeSeasons: { budget: Object.keys(budgetTheme.seasons ?? {}), courses: Object.keys(coursesTheme.seasons ?? {}) },
  rows,
};
`,
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
await page.goto(`http://localhost:${port}/a2-budget/qa/saisons-assets/check.html`);
await page.waitForFunction(() => '__qa' in window, null, { timeout: 60000 });
const qa = await page.evaluate(() => window.__qa);
writeFileSync(join(outDir, 'report.json'), JSON.stringify(qa, null, 1));
for (const id of ['forest-spring', 'forest-autumn', 'forest-winter', 'banners']) {
  const el = page.locator(`#${id}`);
  if (await el.count()) await el.screenshot({ path: join(outDir, `sheet-${id}.jpg`), type: 'jpeg', quality: 70 });
}
await browser.close();

const bad = qa.rows.filter((r) => !r.ok || (r.note && r.note.startsWith('nom')));
console.log(`saisons forêt : ${qa.seasons.join(', ')} ; bandeaux : budget ${qa.themeSeasons.budget.join('/')}, courses ${qa.themeSeasons.courses.join('/')}`);
console.log(`${qa.rows.length} contrôles, ${bad.length} en échec`);
for (const r of bad) console.log('  ÉCHEC', r.key, r.w + '×' + r.h, r.note ?? '');
process.exit(bad.length ? 1 : 0);
