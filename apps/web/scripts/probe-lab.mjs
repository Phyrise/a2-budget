import { chromium } from '@playwright/test';
const [,, qs = '', outp = 'apps/web/qa/probe/lab.png', h = '977'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: Number(h) }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:5183/a2-budget/world-lab.html?ui=0&lights=0&${qs}`);
await page.waitForFunction(() => window.__worldEngine);
await page.waitForTimeout(2500);
await page.screenshot({ path: outp, clip: { x: 0, y: 0, width: 390, height: 528 } });
await browser.close();
