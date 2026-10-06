import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(webRoot, 'qa', 'probe');
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:5183/a2-budget/';
writeFileSync(join(out, 'fixtures.html'), `<!doctype html><html><body><script type="module" src="../../scripts/qa-maison-v3.fixtures.ts"></script></body></html>`);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fp = await browser.newPage();
await fp.goto(`${BASE}qa/probe/fixtures.html`);
await fp.waitForFunction(() => window.__fixtures !== undefined);
const state = await fp.evaluate(() => window.__fixtures.quiet);
await fp.close();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' });
await ctx.addInitScript(([s]) => {
  if (sessionStorage.getItem('qa-init')) return; sessionStorage.setItem('qa-init', '1');
  localStorage.setItem('a2-budget:state:v1', s);
  localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', forestMotion: 'full', guardianSeen: true, offlineAnnounced: true }));
}, [state]);
const page = await ctx.newPage();
page.on('console', (m) => console.log('console', m.type(), m.text()));
await page.goto(BASE);
await page.waitForSelector('.screen-sheet');
await page.waitForTimeout(4000);
const cb = page.getByRole('checkbox', { name: 'Arroser les plantes', exact: true });
const box = await cb.boundingBox();
console.log('checkbox', box, 'scrollY', await page.evaluate(() => scrollY));
await cb.click();
for (const ms of [200, 250, 250, 250, 250, 900]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: join(out, `t${Date.now() % 100000}.png`), clip: { x: 0, y: 0, width: 390, height: 600 } });
}
await browser.close();
