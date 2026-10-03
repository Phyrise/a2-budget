/**
 * Labo (dev seulement) : génère une carte de profondeur et des masques
 * approximatifs pour le stade 6 (peinture maîtresse du stub), afin de tester
 * le moteur avec des données « réelles » avant le pipeline d'assets.
 *
 *   node apps/web/src/world/lab/tools/gen-maps.mjs
 *
 * Profondeur (blanc = près) : formes peintes à la main + dégradé + flou.
 * Masques RGBA : R eau (cascade, bassin, ruisseau), G feuillage (verdeur),
 * B cèdre, A trouées de lumière.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

/** PNG RGBA 8 bits non prémultiplié (le canvas 2D détruirait RGB là où A = 0). */
function encodePng(w, h, rgba) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../assets/stub/01-master-portrait.jpg');
const out = resolve(here, '../assets');
const b64 = readFileSync(src).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<img id="im" src="data:image/jpeg;base64,${b64}">`);
await page.waitForFunction(() => document.getElementById('im').complete);

const result = await page.evaluate(() => {
  const W = 512;
  const H = 768;
  const img = document.getElementById('im');
  const cv = (w = W, h = H) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const base = cv();
  const bctx = base.getContext('2d');
  bctx.drawImage(img, 0, 0, W, H);
  const px = bctx.getImageData(0, 0, W, H).data;
  const P = (pts) => pts.map(([x, y]) => [x * W, y * H]);
  const poly = (ctx, pts, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    P(pts).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  const g = (v) => `rgb(${v},${v},${v})`;

  // ---------------------------------------------------------------- profondeur
  const d = cv();
  const dc = d.getContext('2d');
  const grad = dc.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, g(70));
  grad.addColorStop(0.3, g(40));
  grad.addColorStop(0.55, g(95));
  grad.addColorStop(0.75, g(170));
  grad.addColorStop(1, g(235));
  dc.fillStyle = grad;
  dc.fillRect(0, 0, W, H);
  // Arbres latéraux plus proches.
  poly(dc, [[0, 0], [0.1, 0], [0.12, 0.45], [0.06, 0.62], [0, 0.62]], g(150));
  poly(dc, [[0.9, 0.05], [1, 0.05], [1, 0.6], [0.93, 0.55]], g(130));
  // Cèdre : mi-profondeur, la base avance.
  poly(dc, [[0.47, 0], [0.84, 0], [0.86, 0.3], [0.9, 0.55], [0.95, 0.66], [0.34, 0.66], [0.4, 0.5], [0.44, 0.25]], g(120));
  poly(dc, [[0.34, 0.55], [0.95, 0.55], [1, 0.7], [0.3, 0.7]], g(150));
  // Tronc couché à gauche.
  poly(dc, [[0, 0.52], [0.12, 0.55], [0.5, 0.66], [0.5, 0.72], [0.1, 0.66], [0, 0.63]], g(185));
  // Eau : un peu plus loin que les rochers qui la bordent.
  poly(dc, [[0.6, 0.7], [0.82, 0.72], [0.8, 0.86], [0.66, 0.95], [0.62, 1], [0.44, 1], [0.42, 0.86], [0.58, 0.8]], g(175));
  // Rochers et fougères du premier plan.
  poly(dc, [[0, 0.75], [0.25, 0.78], [0.42, 0.84], [0.45, 1], [0, 1]], g(242));
  poly(dc, [[0.62, 0.86], [0.85, 0.8], [1, 0.8], [1, 1], [0.6, 1]], g(250));
  const dblur = cv();
  const dbc = dblur.getContext('2d');
  dbc.filter = 'blur(10px)';
  dbc.drawImage(d, 0, 0);

  // ---------------------------------------------------------------- masques
  const water = cv();
  const wc = water.getContext('2d');
  wc.fillStyle = '#000';
  wc.fillRect(0, 0, W, H);
  // Cascade, bassin, ruisseau vers le spectateur.
  poly(wc, [[0.63, 0.715], [0.69, 0.71], [0.7, 0.79], [0.64, 0.8]], '#fff');
  poly(wc, [[0.74, 0.76], [0.8, 0.76], [0.8, 0.82], [0.74, 0.82]], '#fff');
  poly(wc, [[0.44, 0.835], [0.6, 0.81], [0.78, 0.82], [0.8, 0.86], [0.68, 0.9], [0.64, 0.95], [0.6, 1], [0.47, 1], [0.43, 0.92]], '#fff');
  const wblur = cv();
  const wbc = wblur.getContext('2d');
  wbc.filter = 'blur(3px)';
  wbc.drawImage(water, 0, 0);
  const cedar = cv();
  const cc = cedar.getContext('2d');
  cc.fillStyle = '#000';
  cc.fillRect(0, 0, W, H);
  poly(cc, [[0.47, 0], [0.84, 0], [0.86, 0.3], [0.9, 0.55], [0.95, 0.66], [0.34, 0.66], [0.4, 0.5], [0.44, 0.25]], '#fff');
  const cblur = cv();
  const cbc = cblur.getContext('2d');
  cbc.filter = 'blur(6px)';
  cbc.drawImage(cedar, 0, 0);

  const dd = dbc.getImageData(0, 0, W, H).data;
  const wd = wbc.getImageData(0, 0, W, H).data;
  const cd = cbc.getImageData(0, 0, W, H).data;
  const depthOut = cv();
  const masksOut = cv();
  const dImg = depthOut.getContext('2d').createImageData(W, H);
  const mImg = masksOut.getContext('2d').createImageData(W, H);
  const sm = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < W * H; i++) {
    const y = Math.floor(i / W) / H;
    const r = px[i * 4] / 255;
    const gg = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;
    const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const v = dd[i * 4];
    dImg.data.set([v, v, v, 255], i * 4);
    const wv = wd[i * 4] / 255;
    const cv2 = cd[i * 4] / 255;
    const green = Math.min(1, Math.max(0, (gg - Math.max(r, b)) * 7 + (gg > r ? 0.2 : 0))) * sm(0.03, 0.15, l);
    const gaps = (1 - sm(0.2, 0.5, y)) * sm(0.42, 0.7, l);
    mImg.data.set(
      [Math.round(wv * 255), Math.round(green * (1 - wv) * (1 - cv2 * 0.7) * 255), Math.round(cv2 * 255), Math.round(Math.min(1, gaps * 1.5) * 255)],
      i * 4,
    );
  }
  depthOut.getContext('2d').putImageData(dImg, 0, 0);
  let bin = '';
  for (let i = 0; i < mImg.data.length; i++) bin += String.fromCharCode(mImg.data[i]);
  return { depth: depthOut.toDataURL('image/png'), masks: btoa(bin), w: W, h: H };
});

const save = (name, url) => writeFileSync(resolve(out, name), Buffer.from(url.split(',')[1], 'base64'));
save('depth-6.png', result.depth);
writeFileSync(resolve(out, 'masks-6.png'), encodePng(result.w, result.h, Buffer.from(result.masks, 'base64')));
await browser.close();
console.log('ok', out);
