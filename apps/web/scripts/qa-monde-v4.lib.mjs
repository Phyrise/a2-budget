/**
 * Outils de la QA MONDE V4 : position à l'écran d'une lumière en vol et de la
 * lanterne de pierre (lues dans le moteur exposé en dev, window.__worldEngine),
 * luminance locale d'une capture PNG.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const coreDir = dirname(require.resolve('playwright-core/package.json', { paths: [require.resolve('@playwright/test')] }));
const { PNG } = require(join(coreDir, 'lib/utilsBundle'));

/** Tête du vol le plus récent (px du viewport), haut de la feuille. */
export function flightProbe(page) {
  return page.evaluate(() => {
    const e = window.__worldEngine;
    const r = e.canvas.getBoundingClientRect();
    const f = e.framing;
    const toView = (p) => ({ x: Math.round(r.left + ((p.x - f.cx) / f.vw + 0.5) * r.width), y: Math.round(r.top + ((p.y - f.cy) / f.vh + 0.5) * r.height) });
    const flying = e.lights.flying(performance.now() / 1000);
    const last = flying[flying.length - 1];
    const sheet = document.querySelector('.screen-sheet')?.getBoundingClientRect();
    return {
      head: last ? { ...toView(last), k: Math.round(last.k * 100) / 100 } : null,
      sheetTop: Math.round(sheet?.top ?? r.bottom),
      animated: e.animated,
    };
  });
}

/** Boîte de la lanterne de pierre à l'écran (px du viewport). */
export function lanternBox(page) {
  return page.evaluate(() => {
    const e = window.__worldEngine;
    const r = e.canvas.getBoundingClientRect();
    const f = e.framing;
    const g = e.stone.geometry();
    const y = (v) => Math.round(r.top + ((v - f.cy) / f.vh + 0.5) * r.height);
    const sheet = document.querySelector('.screen-sheet')?.getBoundingClientRect();
    const x = (v) => Math.round(r.left + ((v - f.cx) / f.vw + 0.5) * r.width);
    const box = { left: x(g.ground.x - g.w / 2 / (e.cfg.manifest.size.w / e.cfg.manifest.size.h)), right: x(g.ground.x + g.w / 2 / (e.cfg.manifest.size.w / e.cfg.manifest.size.h)), top: y(g.ground.y - g.h), bottom: y(g.ground.y) };
    // Textes du héros (date, humeur) : la pierre ne doit passer sous aucune ligne de texte.
    const overlap = [...document.querySelectorAll('.maison-hero__date, .maison-hero__mood')].filter((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return [...range.getClientRects()].some((t) => t.width > 0 && t.left < box.right - 6 && t.right > box.left + 6 && t.top < box.bottom - 6 && t.bottom > box.top + 6);
    }).map((el) => `${el.className.split(' ')[0]} « ${el.textContent} »`);
    return { model: e.stone.model?.id ?? null, ...box, overlap, sheetTop: Math.round(sheet?.top ?? r.bottom) };
  });
}

/** Luminance moyenne (0..255) d'un carré de 9×9 px centré sur `p`. */
export function lumaAt(buf, p) {
  const png = PNG.sync.read(buf);
  let sum = 0;
  let n = 0;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = (y * png.width + x) * 4;
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  }
  return n ? sum / n : 0;
}
