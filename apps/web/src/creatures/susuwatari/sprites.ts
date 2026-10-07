/**
 * Pré-rendu hors écran des Noiraudes, à la densité réelle de l'écran :
 * rien de coûteux n'est fait à chaque image (pas de shadowBlur ni de filtre
 * pendant l'animation, seulement des drawImage). Tout est lu dans
 * `SootSpriteParams` (params.ts) ; le cache (cache.ts) reconstruit les
 * sprites quand ces paramètres changent.
 *
 * Un jeu de sprites par (variante de fourrure, rayon en px appareil) :
 * - `frames` : FRAMES images du corps entier — poils et duvet qui ondulent en
 *              boucle, SOUS le disque fixe (racines cachées) — fondues à
 *              l'affichage ;
 * - `halo`   : lueur douce derrière le corps (fonds sombres, `rim` > 0) ;
 * - `eye`    : blanc de l'œil légèrement ombré ; `glow` : lueur de nuit.
 */
import { furGenome, traceHair, type FurGenome, type Hair } from './fur';
import { sootColor, withAlpha, type SootSpriteParams } from './params';

/** Nombre d'images de frisottis (boucle). */
export const FRAMES = 4;
/** Variantes de fourrure (graines) partagées par toutes les Noiraudes. */
export const VARIANTS = 4;

export interface BodySprites {
  /** Rayon nominal R du sprite (px appareil). */
  radius: number;
  /** Côté des images carrées (px appareil), centre du corps au milieu. */
  side: number;
  /** Corps entier (poils de l'image f + disque), une image par frisottis. */
  frames: HTMLCanvasElement[];
  halo: HTMLCanvasElement | null;
  /** Blanc de l'œil (ellipse eyes.size × eyes.size·aspect) et sa lueur de nuit. */
  eye: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D indisponible');
  return ctx;
}

interface Paint {
  genome: FurGenome;
  p: SootSpriteParams;
  /** Rayon du disque (px appareil) et centre du sprite. */
  Rd: number;
  m: number;
}

/** Remplit en un seul chemin tous les poils d'un lot (rapide). */
function fillBatch(ctx: CanvasRenderingContext2D, k: Paint, pick: (h: Hair) => boolean, color: string, alpha: number, phi: number): void {
  if (alpha <= 0) return;
  ctx.beginPath();
  let any = false;
  for (const h of k.genome.hairs) {
    if (!pick(h)) continue;
    traceHair(ctx, h, k.m, k.m, k.Rd, phi, k.p.anim.wave);
    any = true;
  }
  if (!any) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function contour(ctx: CanvasRenderingContext2D, k: Paint, scale: number, dx = 0): void {
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const e = k.genome.edge((i / 120) * Math.PI * 2);
    const x = k.m + dx + e.x * k.Rd * scale;
    const y = k.m + e.y * k.Rd * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Le disque (fixe), peint par-dessus les poils de chaque image. */
function paintDisc(ctx: CanvasRenderingContext2D, k: Paint): void {
  const { body } = k.p;
  contour(ctx, k, 1);
  ctx.fillStyle = sootColor(body.darkness);
  ctx.fill();
  if (body.sheen > 0) {
    // Reflet : une lumière très douce en haut à gauche (volume, pas de brillance).
    const g = ctx.createRadialGradient(k.m - k.Rd * 0.38, k.m - k.Rd * 0.45, 0, k.m - k.Rd * 0.2, k.m - k.Rd * 0.25, k.Rd * 1.05);
    g.addColorStop(0, `rgba(120, 104, 92, ${0.32 * body.sheen})`);
    g.addColorStop(0.5, `rgba(90, 78, 70, ${0.12 * body.sheen})`);
    g.addColorStop(1, 'rgba(60, 52, 46, 0)');
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function paintFrame(k: Paint, side: number, frame: number, rim: number, disc: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(side, side);
  const ctx = ctx2d(c);
  const { hair, body, glow, palette } = k.p;
  const phi = (frame / FRAMES) * Math.PI * 2;
  // Duvet d'abord (derrière), translucide ; puis les poils, en trois teintes.
  fillBatch(ctx, k, (h) => h.fine, sootColor(body.darkness, hair.tone), hair.opacity * hair.fuzzAlpha, phi);
  for (let tone = 0; tone < 3; tone++) {
    fillBatch(ctx, k, (h) => !h.fine && h.tone === tone, sootColor(body.darkness, tone * hair.tone), hair.opacity, phi);
  }
  if (rim > 0) fillBatch(ctx, k, (h) => h.lit, palette.rim, glow.tips * rim, phi);
  ctx.drawImage(disc, 0, 0);
  return c;
}

/** Halo : l'ombre floue d'un disque dessiné hors champ (pré-rendu uniquement). */
function paintHalo(k: Paint, R: number, side: number, rim: number): HTMLCanvasElement {
  const c = canvas(side, side);
  const ctx = ctx2d(c);
  const off = side * 2;
  const { glow, palette, hair } = k.p;
  ctx.shadowColor = withAlpha(palette.halo, glow.halo * rim);
  ctx.shadowBlur = R * glow.blur;
  ctx.shadowOffsetX = off;
  contour(ctx, k, Math.max(1, hair.rootOut + (hair.lenMin + hair.lenMax) * 0.35), -off);
  ctx.fillStyle = '#000';
  ctx.fill();
  return c;
}

function paintEye(p: SootSpriteParams, R: number): HTMLCanvasElement {
  const rx = p.eyes.size * R;
  const ry = rx * p.eyes.aspect;
  const c = canvas(rx * 2 + 2, ry * 2 + 2);
  const ctx = ctx2d(c);
  const cx = c.width / 2;
  const cy = c.height / 2;
  const [hi, mid, lo] = p.palette.eye;
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, 0, cx, cy, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, lo);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  if (p.eyes.lid > 0) {
    // Ombre de la paupière (le bas de l'œil, sous la fourrure).
    const lid = ctx.createLinearGradient(0, cy + ry * 0.2, 0, cy + ry);
    lid.addColorStop(0, 'rgba(80, 60, 40, 0)');
    lid.addColorStop(1, `rgba(80, 60, 40, ${p.eyes.lid})`);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = lid;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function paintGlow(p: SootSpriteParams, R: number): HTMLCanvasElement {
  const r = p.eyes.size * p.eyes.aspect * R * 2.4;
  const c = canvas(r * 2, r * 2);
  const ctx = ctx2d(c);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, withAlpha(p.palette.night, 0.42));
  g.addColorStop(0.45, withAlpha(p.palette.night, 0.12));
  g.addColorStop(1, withAlpha(p.palette.night, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Ombre au sol (ellipse floue), commune à toutes les tailles. */
let shadowSprite: HTMLCanvasElement | null = null;
export function shadow(): HTMLCanvasElement {
  if (shadowSprite) return shadowSprite;
  const c = canvas(96, 32);
  const ctx = ctx2d(c);
  ctx.setTransform(1, 0, 0, 1 / 3, 0, 0);
  const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  shadowSprite = c;
  return c;
}

/**
 * Construction pas à pas : chaque `next()` peint une seule toile (le disque,
 * puis chaque image de frisottis, puis halo et yeux), pour étaler le coût
 * sur plusieurs images d'animation.
 */
export function* buildSteps(variant: number, radius: number, rim: number, p: SootSpriteParams): Generator<void, BodySprites, void> {
  const R = radius;
  const Rd = R * p.body.radius;
  const genome = furGenome(variant + 1, p);
  // Marge : portée des poils, flou de la lueur, frisottis.
  const extent = Math.max(genome.reach * p.body.radius, rim > 0 ? p.body.radius + p.glow.blur * 1.6 : 0) + 0.04;
  const side = Math.ceil(R * extent * 2) + 4;
  const k: Paint = { genome, p, Rd, m: side / 2 };
  const disc = canvas(side, side);
  paintDisc(ctx2d(disc), k);
  yield;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < FRAMES; f++) {
    frames.push(paintFrame(k, side, f, rim, disc));
    yield;
  }
  return { radius: R, side, frames, halo: rim > 0 ? paintHalo(k, R, side, rim) : null, eye: paintEye(p, R), glow: paintGlow(p, R) };
}

export function buildBody(variant: number, radius: number, rim: number, p: SootSpriteParams): BodySprites {
  const steps = buildSteps(variant, radius, rim, p);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
