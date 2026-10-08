/**
 * Objets que portent les Noiraudes, dessinés par le code : une pièce d'or
 * (le compte), un kompeitō pastel étoilé (le bonbon des Noiraudes), un petit
 * morceau de charbon (la chaufferie de Kamaji). Chaque objet est peint une
 * fois par taille (palier de 1 px appareil) dans une petite toile gardée en
 * cache, puis posé par drawImage : rien de coûteux à chaque image.
 */

export type ItemKind = 'coin' | 'konpeito' | 'coal';
export type KonpeitoTone = 'pink' | 'yellow' | 'green' | 'white' | 'blue' | 'purple';

export const KONPEITO_TONES: readonly KonpeitoTone[] = ['pink', 'yellow', 'green', 'white', 'blue', 'purple'];

const PASTEL: Record<KonpeitoTone, [string, string, string]> = {
  pink: ['#fde3ea', '#f4b6c6', '#d98aa0'],
  yellow: ['#fff3c8', '#f6dc86', '#d8b452'],
  green: ['#e6f6dc', '#bfe3a6', '#8fbf74'],
  white: ['#ffffff', '#f3ece0', '#cfc4b2'],
  blue: ['#e2eefb', '#b4d2f0', '#86a9d0'],
  purple: ['#efe4fb', '#d3bcef', '#a98bcf'],
};

export interface Item {
  kind: ItemKind;
  tone: KonpeitoTone;
  /** Rayon (px CSS). */
  r: number;
  /** Deux collés (kompeitō) : posés l'un sur l'autre. */
  pair: boolean;
  /** Centre (px CSS du calque) ; au sol, `y` est le sol et `z` la hauteur. */
  x: number;
  y: number;
  z: number;
  vz: number;
  spin: number;
  alpha: number;
  /** Défile avec la page (sinon attaché à l'écran). */
  page: boolean;
}

export function makeItem(kind: ItemKind, r: number, tone: KonpeitoTone = 'yellow'): Item {
  return { kind, tone, r, pair: false, x: 0, y: 0, z: 0, vz: 0, spin: (Math.random() - 0.5) * 0.6, alpha: 1, page: true };
}

export function randomTone(rand: () => number = Math.random): KonpeitoTone {
  return KONPEITO_TONES[Math.floor(rand() * KONPEITO_TONES.length)] ?? 'yellow';
}

function paintCoin(ctx: CanvasRenderingContext2D, c: number, r: number): void {
  // Pièce d'or vue un peu de biais : tranche, face bombée, trou carré (mon).
  ctx.fillStyle = '#8a5a1c';
  ctx.beginPath();
  ctx.ellipse(c, c + r * 0.12, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
  g.addColorStop(0, '#fff2b8');
  g.addColorStop(0.45, '#f1c95a');
  g.addColorStop(1, '#b9842c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(c, c, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 76, 20, 0.55)';
  ctx.lineWidth = Math.max(0.6, r * 0.09);
  ctx.beginPath();
  ctx.ellipse(c, c, r * 0.72, r * 0.64, 0, 0, Math.PI * 2);
  ctx.stroke();
  const h = r * 0.2;
  ctx.fillStyle = 'rgba(96, 58, 14, 0.85)';
  ctx.fillRect(c - h, c - h * 0.9, h * 2, h * 1.8);
}

function paintKonpeito(ctx: CanvasRenderingContext2D, c: number, r: number, tone: KonpeitoTone): void {
  // Petite étoile bosselée : 10 cornes douces, reflet en haut à gauche.
  const [light, mid, dark] = PASTEL[tone];
  const n = 10;
  ctx.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.74;
    const x = c + Math.cos(a) * rr;
    const y = c + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const m = a - Math.PI / (n * 2);
      const k = i % 2 === 0 ? r * 0.86 : r * 0.9;
      ctx.quadraticCurveTo(c + Math.cos(m) * k, c + Math.sin(m) * k, x, y);
    }
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.05, c, c, r);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 60, 50, 0.25)';
  ctx.lineWidth = Math.max(0.5, r * 0.06);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(c - r * 0.3, c - r * 0.32, r * 0.18, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function paintCoal(ctx: CanvasRenderingContext2D, c: number, r: number): void {
  // Morceau de charbon : facettes irrégulières, une arête plus claire.
  const pts = [
    [-0.95, 0.1],
    [-0.55, -0.7],
    [0.2, -0.95],
    [0.85, -0.45],
    [0.95, 0.35],
    [0.35, 0.85],
    [-0.5, 0.75],
  ] as const;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(c + x * r, c + y * r * 0.85) : ctx.lineTo(c + x * r, c + y * r * 0.85)));
  ctx.closePath();
  ctx.fillStyle = '#211b18';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c - 0.55 * r, c - 0.6 * r);
  ctx.lineTo(c + 0.2 * r, c - 0.8 * r);
  ctx.lineTo(c + 0.1 * r, c - 0.1 * r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120, 108, 98, 0.55)';
  ctx.fill();
}

const sprites = new Map<string, HTMLCanvasElement>();

function sprite(kind: ItemKind, tone: KonpeitoTone, px: number): HTMLCanvasElement {
  const r = Math.max(2, Math.round(px));
  const key = `${kind}:${kind === 'konpeito' ? tone : ''}:${r}`;
  const known = sprites.get(key);
  if (known) return known;
  const pad = Math.ceil(r * 0.3) + 2;
  const side = (r + pad) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = side / 2;
    if (kind === 'coin') paintCoin(ctx, c, r);
    else if (kind === 'konpeito') paintKonpeito(ctx, c, r, tone);
    else paintCoal(ctx, c, r);
  }
  // Quelques dizaines de paliers au plus (tailles fixes par usage).
  if (sprites.size > 96) sprites.clear();
  sprites.set(key, canvas);
  return canvas;
}

/** Dessine l'objet centré en (x, y) (px CSS) ; `glow` : halo doux (nuit, doigt). */
export function drawItem(ctx: CanvasRenderingContext2D, item: Item, x: number, y: number, dpr: number, glow = 0): void {
  if (item.alpha <= 0.01) return;
  const img = sprite(item.kind, item.tone, item.r * dpr);
  const s = img.width / dpr;
  ctx.globalAlpha = Math.min(1, item.alpha);
  if (glow > 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createRadialGradient(x, y, 0, x, y, item.r * 2.4);
    g.addColorStop(0, `rgba(255, 236, 190, ${0.45 * glow})`);
    g.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - item.r * 2.4, y - item.r * 2.4, item.r * 4.8, item.r * 4.8);
  }
  const copies = item.pair ? 2 : 1;
  for (let i = 0; i < copies; i++) {
    const oy = i === 0 ? 0 : -item.r * 1.35;
    const ox = i === 0 ? 0 : item.r * 0.2;
    const a = item.spin + i * 0.7;
    ctx.setTransform(dpr * Math.cos(a), dpr * Math.sin(a), -dpr * Math.sin(a), dpr * Math.cos(a), dpr * (x + ox), dpr * (y + oy));
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

/** Petite étincelle à quatre branches (Noiraude dorée, kompeitō qui arrive). */
export function drawGlint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, dpr: number): void {
  if (alpha <= 0.02) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = '#fff4c8';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}
