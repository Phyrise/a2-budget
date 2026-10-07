import { chromium } from '@playwright/test';
const [, , qs, outDir, ...cands] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:5183/a2-budget/world-lab.html?ui=0&lights=0&${qs}`);
await p.waitForFunction(() => window.__worldEngine?.stone?.model, null, { timeout: 20000 });
await p.waitForTimeout(2500);
for (const c of cands) {
  const [x, y, d] = c.split(',').map(Number);
  await p.evaluate(([x, y, d]) => { const e = window.__worldEngine; e.stone.ground = { x, y, depth: d }; e.lantern.geo = e.stone.geometry(); e.requestFrame(true); }, [x, y, d]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${outDir}/${c}.png`, clip: { x: 150, y: 150, width: 240, height: 300 } });
}
await b.close();
