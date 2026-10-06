import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5183/a2-budget/';
const browser = await chromium.launch();
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
await page.goto(BASE);
await page.waitForSelector('.screen-sheet');
await page.waitForFunction(() => window.__worldEngine);
await page.waitForTimeout(2500);
const probe = () => page.evaluate(() => {
  const e = window.__worldEngine;
  const ls = [...e.lights.lights.values()].map((l) => ({ id: l.id.slice(0, 6), x: +l.x.toFixed(3), y: +l.y.toFixed(3), flight: l.flight && { sx: +l.flight.sx.toFixed(3), sy: +l.flight.sy.toFixed(3) }, born: +l.born.toFixed(2), inState: l.inState }));
  return { live: e.cfg.live, variant: e.cfg.variant, motion: e.cfg.motion, animated: e.animated, raf: e.raf, now: +(performance.now()/1000).toFixed(2), framing: { cx: e.framing.cx.toFixed(3), cy: e.framing.cy.toFixed(3), vw: e.framing.vw.toFixed(3), vh: e.framing.vh.toFixed(3), w: e.framing.w, h: e.framing.h }, canvas: e.canvas.getBoundingClientRect().toJSON(), ls };
});
console.log(JSON.stringify(await probe()));
await page.getByRole('checkbox', { name: process.argv[2] ?? 'Arroser les plantes', exact: true }).click();
await page.screenshot({ path: 'apps/web/qa/probe/p0.png', clip: { x: 0, y: 200, width: 390, height: 330 } });
for (const [i, ms] of [[1, 600], [2, 300], [3, 300], [4, 300]]) { await page.waitForTimeout(ms); await page.screenshot({ path: `apps/web/qa/probe/p${i}.png`, clip: { x: 0, y: 200, width: 390, height: 330 } }); }
await browser.close();
