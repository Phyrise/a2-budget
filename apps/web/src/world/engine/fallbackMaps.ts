/**
 * Replis quand le manifest n'a pas encore de profondeur ou de masques :
 * cartes basse résolution déduites de la peinture elle-même, volontairement
 * prudentes (effets réduits, jamais de déchirure).
 *
 * - profondeur synthétique : dégradé vertical (sol proche, fond brumeux loin)
 *   + luminance lissée (la brume claire est loin : perspective atmosphérique) ;
 * - masques : R eau (bas de l'image, tons froids peu saturés, atténué),
 *   G feuillage (verdeur), B cèdre (ellipse centrale), A trouées claires du haut.
 */
import { imageSize, type Decoded } from './loader';

export interface DataMap {
  data: Uint8Array;
  width: number;
  height: number;
}

const W = 160;

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      const xa = Math.min(w - 1, x + r + 1);
      const xr = Math.max(0, x - r);
      acc += src[y * w + xa]! - src[y * w + xr]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      const ya = Math.min(h - 1, y + r + 1);
      const yr = Math.max(0, y - r);
      acc += tmp[ya * w + x]! - tmp[yr * w + x]!;
    }
  }
  return out;
}

function blur3(src: Float32Array, w: number, h: number, r: number) {
  return boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function readPixels(img: Decoded): { px: Uint8ClampedArray; w: number; h: number } | null {
  const size = imageSize(img);
  const h = Math.round((W * size.h) / size.w);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img as CanvasImageSource, 0, 0, W, h);
  return { px: ctx.getImageData(0, 0, W, h).data, w: W, h };
}

export function synthesizeMaps(img: Decoded): { depth: DataMap; masks: DataMap } | null {
  const src = readPixels(img);
  if (!src) return null;
  const { px, w, h } = src;
  const n = w * h;
  const lum = new Float32Array(n);
  const green = new Float32Array(n);
  const water = new Float32Array(n);
  const gaps = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4]! / 255;
    const g = px[i * 4 + 1]! / 255;
    const b = px[i * 4 + 2]! / 255;
    const y = Math.floor(i / w) / h;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    green[i] = Math.min(1, Math.max(0, (g - Math.max(r, b)) * 6 + (g > r ? 0.15 : 0))) * smooth(0.04, 0.2, l);
    const cool = smooth(-0.02, 0.05, b - r);
    water[i] = smooth(0.6, 0.78, y) * cool * (1 - smooth(0.18, 0.4, sat)) * smooth(0.12, 0.3, l);
    gaps[i] = (1 - smooth(0.25, 0.5, y)) * smooth(0.45, 0.75, l);
  }
  // Luminance très lissée : ce qui est clair et brumeux est au loin.
  const lumS = blur3(lum, w, h, 10);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, lumS[i]!);
    hi = Math.max(hi, lumS[i]!);
  }
  const depthRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i % w) / w;
    const y = Math.floor(i / w) / h;
    const ln = (lumS[i]! - lo) / Math.max(1e-4, hi - lo);
    const vertical = 0.12 + 0.82 * smooth(0.3, 1.0, y);
    const sides = 0.18 * Math.pow(Math.abs(x - 0.5) * 2, 3);
    depthRaw[i] = Math.min(1, Math.max(0, 0.62 * vertical + 0.38 * (1 - ln) * (0.4 + 0.6 * y) + sides));
  }
  const depthS = blur3(depthRaw, w, h, 6);
  const waterS = blur3(water, w, h, 2);
  const greenS = blur3(green, w, h, 1);
  const gapsS = blur3(gaps, w, h, 3);
  const depth = new Uint8Array(n * 4);
  const masks = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = (i % w) / w;
    const y = Math.floor(i / w) / h;
    const d = Math.round(depthS[i]! * 255);
    depth[i * 4] = d;
    depth[i * 4 + 1] = d;
    depth[i * 4 + 2] = d;
    depth[i * 4 + 3] = 255;
    const wv = Math.min(1, waterS[i]! * 1.6);
    masks[i * 4] = Math.round(wv * 0.55 * 255);
    masks[i * 4 + 1] = Math.round(greenS[i]! * (1 - wv) * 0.6 * 255);
    const ex = (x - 0.5) / 0.2;
    const ey = (y - 0.46) / 0.42;
    masks[i * 4 + 2] = Math.round(Math.max(0, 1 - (ex * ex + ey * ey)) * 255);
    masks[i * 4 + 3] = Math.round(Math.min(1, gapsS[i]! * 1.4) * 255);
  }
  return { depth: { data: depth, width: w, height: h }, masks: { data: masks, width: w, height: h } };
}
