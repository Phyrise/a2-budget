/**
 * QA de la coquille des saisons : captures des bandeaux de saison (Budget
 * Chihiro, Courses Kiki) à 390×844 et des fonds portrait à 1440×900, en
 * automne et en hiver simulés (horloge Playwright), plus la section
 * « Saisons » du panneau développeur. Planche réduite pour relecture.
 *
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5184 --strictPort &
 *   node apps/web/scripts/qa-coquille.mjs [port]
 *
 * Sorties (gitignorées) : apps/web/qa/coquille/*.png, *.small.jpg et sheet.jpg.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5184);
const base = `http://127.0.0.1:${port}/a2-budget/`;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'coquille');
mkdirSync(outDir, { recursive: true });

const DATES = { autumn: '2026-10-20T10:00:00', winter: '2027-01-15T10:00:00', summer: '2027-07-10T10:00:00' };
const shots = [];
const failures = [];

async function capture(browser, { name, season, module, viewport, kind }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(DATES[season]));
  await page.goto(`${base}?module=${module}`);
  await page.locator('.screen-sheet').waitFor();
  const sel = `img.app-world__${kind}[data-universe="${module}"]`;
  await page.waitForFunction((s) => {
    const img = document.querySelector(s);
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === '1';
  }, sel, { timeout: 15_000 });
  const info = await page.locator(sel).evaluate((img) => ({ season: img.dataset.season, src: img.getAttribute('src') }));
  const want = season === 'summer' ? 'base' : season;
  if (info.season !== want) failures.push(`${name}: saison ${info.season} ≠ ${want}`);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
  console.log(`${name}: ${info.season} ${info.src}`);
  await context.close();
}

async function devPanel(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(DATES.autumn));
  await page.addInitScript(() => localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ devMode: true })));
  await page.goto(`${base}?module=budget`);
  await page.locator('.screen-sheet').waitFor();
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = page.getByRole('dialog', { name: 'Mode développeur' });
  await dev.locator('fieldset', { hasText: 'Saison' }).getByRole('button', { name: 'Hiver' }).click();
  const section = dev.locator('section[aria-labelledby="dev-seasons"]');
  await section.scrollIntoViewIfNeeded();
  const file = join(outDir, 'dev-seasons.png');
  await section.screenshot({ path: file });
  shots.push(file);
  console.log('dev:', (await section.innerText()).replace(/\s+/g, ' '));
  await context.close();
}

const browser = await chromium.launch();
const phone = { width: 390, height: 844 };
const desk = { width: 1440, height: 900 };
for (const season of ['autumn', 'winter', 'summer']) {
  for (const module of ['budget', 'courses']) {
    await capture(browser, { name: `${season}-${module}-phone`, season, module, viewport: phone, kind: 'banner' });
  }
}
for (const season of ['autumn', 'winter']) {
  await capture(browser, { name: `${season}-budget-desktop`, season, module: 'budget', viewport: desk, kind: 'backdrop' });
}
await devPanel(browser);

// Planche réduite (sips sur macOS) pour relecture sans saturer le contexte.
try {
  for (const f of shots) execFileSync('sips', ['-Z', '480', '-s', 'format', 'jpeg', f, '--out', f.replace(/\.png$/, '.small.jpg')], { stdio: 'ignore' });
  const fig = (f) => {
    const n = f.split('/').pop().replace(/\.png$/, '');
    return `<figure style="margin:0"><img src="${n}.small.jpg" style="height:420px;display:block"><figcaption>${n}</figcaption></figure>`;
  };
  const rows = [shots.filter((f) => f.includes('-phone')), shots.filter((f) => !f.includes('-phone'))];
  const html = `<body style="margin:6px;background:#222;color:#eee;font:12px system-ui">${rows
    .map((r) => `<div style="display:flex;gap:6px;margin-bottom:6px">${r.map(fig).join('')}</div>`)
    .join('')}</body>`;
  writeFileSync(join(outDir, 'sheet.html'), html);
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.goto(pathToFileURL(join(outDir, 'sheet.html')).href);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'sheet.png'), fullPage: true });
  execFileSync('sips', ['-Z', '1400', '-s', 'format', 'jpeg', join(outDir, 'sheet.png'), '--out', join(outDir, 'sheet.jpg')], { stdio: 'ignore' });
} catch {
  /* sips absent : captures pleine taille seulement */
}
await browser.close();
console.log(failures.length === 0 ? 'OK' : `ÉCHECS :\n${failures.join('\n')}`);
process.exit(failures.length === 0 ? 0 : 1);
