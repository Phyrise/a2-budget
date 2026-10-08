/**
 * Pré-rendu hors écran des Noiraudes, à la densité réelle de l'écran :
 * rien de coûteux n'est fait à chaque image (pas de shadowBlur ni de filtre
 * pendant l'animation, seulement des drawImage). Tout est lu dans
 * `SootSpriteParams` (params.ts) ; le cache (cache.ts) reconstruit les
 * sprites quand ces paramètres changent.
 *
 * Un jeu de sprites par (variante de fourrure, rayon en px appareil) :
 * - `frames` : FRAMES images du corps entier, fondues à l'affichage : duvet
 *              (flou si le contour l'est) et poils qui ondulent en boucle
 *              SOUS le disque fixe (racines cachées), le disque (net ou au
 *              contour flou), puis les poils peints PAR-DESSUS (`over`) ;
 * - `halo`   : lueur douce derrière le corps (fonds sombres, `rim` > 0) ;
 * - `eye`    : blanc de l'œil légèrement ombré ; `glow` : lueur de nuit.
 */
import { furGenome, traceHair, type FurGenome, type Hair, type HairShape } from './fur';
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
  shape: HairShape;
}

/** Flou du contour du corps (px appareil), 0 : net. */
function softness(k: Paint): number {
  const blur = Math.max(0, k.p.body.blur) * k.Rd;
  return blur > 0.4 ? blur : 0;
}

/**
 * Remplit en un seul chemin tous les poils d'un lot (rapide). `soft` (px) :
 * flou, par l'ombre d'un tracé hors champ (pas de filtre : Safari).
 */
function fillBatch(ctx: CanvasRenderingContext2D, k: Paint, pick: (h: Hair) => boolean, color: string, alpha: number, phi: number, soft = 0): void {
  if (alpha <= 0) return;
  const off = soft > 0 ? Math.ceil(k.m * 4) : 0;
  ctx.beginPath();
  let any = false;
  for (const h of k.genome.hairs) {
    if (!pick(h)) continue;
    traceHair(ctx, h, k.m - off, k.m, k.Rd, phi, k.p.anim.wave, k.shape);
    any = true;
  }
  if (!any) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  if (soft > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = soft;
    ctx.shadowOffsetX = off;
    ctx.fillStyle = '#000';
  } else ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Contour du disque ajouté au chemin courant (× scale, décalé de dx). */
function contourPath(ctx: CanvasRenderingContext2D, k: Paint, scale: number, dx = 0): void {
  for (let i = 0; i <= 120; i++) {
    const e = k.genome.edge((i / 120) * Math.PI * 2);
    const x = k.m + dx + e.x * k.Rd * scale;
    const y = k.m + e.y * k.Rd * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function contour(ctx: CanvasRenderingContext2D, k: Paint, scale: number, dx = 0): void {
  ctx.beginPath();
  contourPath(ctx, k, scale, dx);
}

/**
 * Le disque (fixe), peint entre les poils du dessous et ceux du dessus.
 * Contour flou (`blur`) : l'ombre d'un disque hors champ, centrée sur le
 * contour (moitié dedans, moitié dehors) — un corps diffus, « poilu ».
 */
function paintDisc(ctx: CanvasRenderingContext2D, k: Paint): void {
  const { body } = k.p;
  const color = sootColor(body.darkness);
  const soft = softness(k);
  if (soft > 0) {
    const off = Math.ceil(k.m * 4);
    ctx.save();
    ctx.shadowColor = color;
    // shadowBlur = 2σ ; bande 10–90 % ≈ 2,56σ ≈ `soft`.
    ctx.shadowBlur = soft * 0.8;
    ctx.shadowOffsetX = off;
    contour(ctx, k, 1, -off);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  } else {
    contour(ctx, k, 1);
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (body.sheen > 0) {
    // Reflet : une lumière très douce en haut à gauche (volume, pas de brillance).
    const g = ctx.createRadialGradient(k.m - k.Rd * 0.38, k.m - k.Rd * 0.45, 0, k.m - k.Rd * 0.2, k.m - k.Rd * 0.25, k.Rd * 1.05);
    g.addColorStop(0, `rgba(120, 104, 92, ${0.32 * body.sheen})`);
    g.addColorStop(0.5, `rgba(90, 78, 70, ${0.12 * body.sheen})`);
    g.addColorStop(1, 'rgba(60, 52, 46, 0)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function paintFrame(k: Paint, side: number, frame: number, rim: number, disc: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(side, side);
  const ctx = ctx2d(c);
  const { hair, body, glow, palette } = k.p;
  const phi = (frame / FRAMES) * Math.PI * 2;
  // Corps duveteux (contour flou) : le duvet passe DEVANT le disque, fines
  // stries d'encre translucides qui débordent du bord (texture du film).
  // Sinon (ancien rendu) : derrière, de la couleur du disque.
  const fibres = softness(k) > 0;
  const fuzz = (h: Hair) => h.fine;
  if (!fibres) fillBatch(ctx, k, fuzz, sootColor(body.darkness, hair.tone), hair.opacity * hair.fuzzAlpha, phi);
  // Poils du dessous, en trois teintes, puis le disque, puis ceux du dessus.
  const tones = (over: boolean) => {
    for (let tone = 0; tone < 3; tone++) {
      fillBatch(ctx, k, (h) => !h.fine && h.over === over && h.tone === tone, sootColor(hair.ink, tone * hair.tone), hair.opacity, phi);
    }
  };
  tones(false);
  ctx.drawImage(disc, 0, 0);
  if (fibres) fillBatch(ctx, k, fuzz, sootColor(hair.ink, hair.tone), hair.opacity * hair.fuzzAlpha, phi);
  tones(true);
  if (rim > 0) {
    // Pointes éclairées (fonds sombres) : seulement hors du disque.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, side, side);
    contourPath(ctx, k, 1);
    ctx.clip('evenodd');
    fillBatch(ctx, k, (h) => h.lit, palette.rim, glow.tips * rim, phi);
    ctx.restore();
  }
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
  const ring = Math.max(0, p.eyes.ring) * rx;
  if (ring > 0.3) {
    // Liseré sombre autour du blanc (il le détache du corps, comme dans le film).
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx - ring / 2), Math.max(0.5, ry - ring / 2), 0, 0, Math.PI * 2);
    ctx.lineWidth = ring;
    ctx.strokeStyle = p.palette.pupil;
    ctx.stroke();
  }
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
 * Libère tout de suite la mémoire de toiles qui ne servent plus (Safari sur
 * iPhone plafonne la mémoire des toiles et ne la rend qu'au ramasse-miettes :
 * pendant un glissé de curseur, des dizaines de sprites sont jetés).
 */
export function releaseCanvases(canvases: Iterable<HTMLCanvasElement | null>): void {
  for (const c of canvases) {
    if (!c) continue;
    c.width = 0;
    c.height = 0;
  }
}

export function spriteCanvases(set: BodySprites): HTMLCanvasElement[] {
  return [...set.frames, set.halo, set.eye, set.glow].filter((c): c is HTMLCanvasElement => c !== null);
}

/**
 * Construction pas à pas : chaque `next()` peint une seule toile (le disque,
 * puis chaque image de frisottis, puis halo et yeux), pour étaler le coût
 * sur plusieurs images d'animation. `made` reçoit chaque toile créée (pour
 * la libérer si le chantier est abandonné).
 */
export function* buildSteps(variant: number, radius: number, rim: number, p: SootSpriteParams, made: HTMLCanvasElement[] = []): Generator<void, BodySprites, void> {
  const R = radius;
  const Rd = R * p.body.radius;
  const genome = furGenome(variant + 1, p);
  // Marge : portée des poils, flou de la lueur, frisottis.
  const extent = Math.max(genome.reach * p.body.radius, rim > 0 ? p.body.radius + p.glow.blur * 1.6 : 0) + 0.04;
  const side = Math.ceil(R * extent * 2) + 4;
  // Demi-largeur minimale d'un poil : ~1 px appareil de trait.
  const k: Paint = { genome, p, Rd, m: side / 2, shape: { taper: p.hair.taper, cap: p.hair.cap, minW: 0.5 } };
  const disc = canvas(side, side);
  made.push(disc);
  paintDisc(ctx2d(disc), k);
  yield;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < FRAMES; f++) {
    frames.push(paintFrame(k, side, f, rim, disc));
    made.push(frames[f]!);
    yield;
  }
  // Le disque est déjà dans chaque image : sa toile est rendue.
  releaseCanvases([disc]);
  const set = { radius: R, side, frames, halo: rim > 0 ? paintHalo(k, R, side, rim) : null, eye: paintEye(p, R), glow: paintGlow(p, R) };
  made.push(...spriteCanvases(set).slice(FRAMES));
  return set;
}

export function buildBody(variant: number, radius: number, rim: number, p: SootSpriteParams): BodySprites {
  const steps = buildSteps(variant, radius, rim, p);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
