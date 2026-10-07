/**
 * Pré-rendu hors écran des Noiraudes, à la densité réelle de l'écran :
 * rien de coûteux n'est fait à chaque image (pas de shadowBlur ni de filtre
 * pendant l'animation, seulement des drawImage).
 *
 * Un jeu de sprites par (variante de fourrure, rayon en px appareil, rim) :
 * - `core`   : cœur + poils intérieurs + mèches grises (opaque, fixe) ;
 * - `fringe` : FRAMES images de frange (épis, poils fins, pointes
 *              éclairées) qui ondulent en boucle — fondues à l'affichage ;
 * - `halo`   : lueur douce derrière le corps (fonds sombres, `rim` > 0) ;
 * - `eye`    : blanc de l'œil légèrement ombré ; `glow` : lueur de nuit.
 * Rayons regroupés par paliers de 12 % : l'affichage n'étire jamais un
 * sprite de plus de ±6 %. Construction étalée (budget de temps par image).
 */
import { Kind, furGenome, traceStrand, type FurGenome } from './fur';

/** Nombre d'images de frisottis (boucle). */
export const FRAMES = 4;
/** Variantes de fourrure (graines) partagées par toutes les Noiraudes. */
export const VARIANTS = 4;
/** Marge du sprite autour du rayon nominal (poils fins, halo). */
const EXTENT = 1.32;

/** Palette tirée des peintures : noir de suie chaud, jamais d'un noir pur. */
export const SOOT = {
  core: '#0f0c0b',
  inner: ['#0c0908', '#0f0b0a', '#13100e'],
  fringe: ['#0b0807', '#100c0b', '#16110f'],
  fine: '#120e0c',
  sheen: '#4a413c',
  rim: '#c9b894',
  limb: '#17110f',
  eye: ['#f8eed8', '#f2e6cb', '#e2d2b0'],
  pupil: '#1a120f',
} as const;

export interface BodySprites {
  /** Rayon nominal R du sprite (px appareil). */
  radius: number;
  /** Côté des images carrées (px appareil), centre du corps au milieu. */
  side: number;
  core: HTMLCanvasElement;
  fringe: HTMLCanvasElement[];
  halo: HTMLCanvasElement | null;
  /** Blanc de l'œil (ellipse EYE.rx × EYE.ry) et sa lueur de nuit. */
  eye: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

/** Proportions des yeux (× R) : partagées avec le dessin en direct. */
export const EYE = { rx: 0.195, ry: 0.235, gap: 0.28, y: -0.08, pupil: 0.068 } as const;

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

/** Remplit en un seul chemin tous les poils d'un lot (rapide). */
function fillBatch(ctx: CanvasRenderingContext2D, genome: FurGenome, pick: (k: Kind, tone: number, alpha: number) => boolean, color: string, alpha: number, c: number, R: number, phi: number) {
  ctx.beginPath();
  let any = false;
  for (const s of genome.strands) {
    if (!pick(s.kind, s.tone, s.alpha)) continue;
    traceStrand(ctx, s, c, c, R, phi);
    any = true;
  }
  if (!any) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Lots d'opacité : les poils translucides sont regroupés par paliers. */
const ALPHA_STEPS = [0.3, 0.45, 0.6, 0.8, 1] as const;
function step(alpha: number): number {
  return ALPHA_STEPS.reduce((best, a) => (Math.abs(a - alpha) < Math.abs(best - alpha) ? a : best), 1);
}

function paintCore(genome: FurGenome, R: number, side: number): HTMLCanvasElement {
  const c = canvas(side, side);
  const ctx = ctx2d(c);
  const m = side / 2;
  // Cœur bosselé.
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = 0.8 * R * genome.lump(a);
    const x = m + Math.cos(a) * r;
    const y = m + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.fillStyle = SOOT.core;
  ctx.fill();
  SOOT.inner.forEach((color, tone) => fillBatch(ctx, genome, (k, t) => k === Kind.Inner && t === tone, color, 1, m, R, 0));
  for (const a of ALPHA_STEPS) {
    fillBatch(ctx, genome, (k, _t, al) => k === Kind.Sheen && step(al) === a, SOOT.sheen, a, m, R, 0);
  }
  return c;
}

function paintFringe(genome: FurGenome, R: number, side: number, frame: number, rim: number): HTMLCanvasElement {
  const c = canvas(side, side);
  const ctx = ctx2d(c);
  const m = side / 2;
  const phi = (frame / FRAMES) * Math.PI * 2;
  // Poils fins d'abord (derrière), en traits translucides.
  for (const a of ALPHA_STEPS) {
    fillBatch(ctx, genome, (k, _t, al) => k === Kind.Fine && step(al) === a, SOOT.fine, a, m, R, phi);
  }
  SOOT.fringe.forEach((color, tone) => {
    fillBatch(ctx, genome, (k, t, al) => k === Kind.Fringe && t === tone && al >= 1, color, 1, m, R, phi);
    fillBatch(ctx, genome, (k, t, al) => k === Kind.Fringe && t === tone && al < 1, color, 0.88, m, R, phi);
  });
  if (rim > 0) {
    for (const a of ALPHA_STEPS) {
      fillBatch(ctx, genome, (k, _t, al) => k === Kind.Rim && step(al) === a, SOOT.rim, a * 0.15 * rim, m, R, phi);
    }
  }
  return c;
}

/** Halo : l'ombre floue d'un disque dessiné hors champ (pré-rendu uniquement). */
function paintHalo(genome: FurGenome, R: number, side: number, rim: number): HTMLCanvasElement {
  const c = canvas(side, side);
  const ctx = ctx2d(c);
  const m = side / 2;
  const off = side * 2;
  ctx.shadowColor = `rgba(236, 222, 190, ${0.24 * rim})`;
  ctx.shadowBlur = R * 0.22;
  ctx.shadowOffsetX = off;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 0.96 * R * genome.lump(a);
    const x = m - off + Math.cos(a) * r;
    const y = m + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.fillStyle = '#000';
  ctx.fill();
  return c;
}

function paintEye(R: number): HTMLCanvasElement {
  const rx = EYE.rx * R;
  const ry = EYE.ry * R;
  const c = canvas(rx * 2 + 2, ry * 2 + 2);
  const ctx = ctx2d(c);
  const cx = c.width / 2;
  const cy = c.height / 2;
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, 0, cx, cy, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, SOOT.eye[0]);
  g.addColorStop(0.55, SOOT.eye[1]);
  g.addColorStop(1, SOOT.eye[2]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Ombre de la paupière (le bas de l'œil, sous la fourrure).
  const lid = ctx.createLinearGradient(0, cy + ry * 0.2, 0, cy + ry);
  lid.addColorStop(0, 'rgba(80, 60, 40, 0)');
  lid.addColorStop(1, 'rgba(80, 60, 40, 0.18)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = lid;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function paintGlow(R: number): HTMLCanvasElement {
  const r = EYE.ry * R * 2.4;
  const c = canvas(r * 2, r * 2);
  const ctx = ctx2d(c);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255, 238, 196, 0.42)');
  g.addColorStop(0.45, 'rgba(255, 228, 170, 0.12)');
  g.addColorStop(1, 'rgba(255, 228, 170, 0)');
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

export function buildBody(variant: number, radius: number, rim: number): BodySprites {
  const R = radius;
  const side = Math.ceil(R * EXTENT * 2) + 4;
  const genome = furGenome(variant + 1, R);
  return {
    radius: R,
    side,
    core: paintCore(genome, R, side),
    fringe: Array.from({ length: FRAMES }, (_, f) => paintFringe(genome, R, side, f, rim)),
    halo: rim > 0 ? paintHalo(genome, R, side, rim) : null,
    eye: paintEye(R),
    glow: paintGlow(R),
  };
}

/** Palier de rayon (12 %) : un rayon voulu → rayon du sprite à construire. */
export function bucketRadius(radius: number): number {
  const k = Math.round(Math.log(Math.max(4, radius)) / Math.log(1.12));
  return Math.round(Math.pow(1.12, k));
}

/**
 * Cache des sprites d'un calque. `get` rend le meilleur sprite DISPONIBLE
 * (le palier exact, sinon le plus proche déjà construit) et met le palier
 * manquant en file ; `pump` construit la file dans un budget de temps.
 */
export class SpriteCache {
  private sets = new Map<string, BodySprites>();
  private queue: Array<{ key: string; variant: number; radius: number }> = [];
  private used = new Map<string, number>();
  constructor(private rim: number) {}

  setRim(rim: number): void {
    if (rim === this.rim) return;
    this.rim = rim;
    this.sets.clear();
    this.queue = [];
  }

  get(variant: number, radius: number, now: number): BodySprites | null {
    const r = bucketRadius(radius);
    const key = `${variant}:${r}`;
    const hit = this.sets.get(key);
    this.used.set(key, now);
    if (hit) return hit;
    if (!this.queue.some((q) => q.key === key)) this.queue.push({ key, variant, radius: r });
    // En attendant : le palier le plus proche de la même variante.
    let best: BodySprites | null = null;
    for (const [k, set] of this.sets) {
      if (!k.startsWith(`${variant}:`)) continue;
      if (best === null || Math.abs(set.radius - r) < Math.abs(best.radius - r)) best = set;
    }
    return best;
  }

  /** Construit des sprites en file tant que le budget (ms) le permet ; au moins un. */
  pump(budgetMs: number, now: number): void {
    const start = performance.now();
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.sets.set(next.key, buildBody(next.variant, next.radius, this.rim));
      if (performance.now() - start > budgetMs) break;
    }
    // Les paliers oubliés depuis 10 s (curseur de taille) sont libérés.
    if (this.sets.size > 16) {
      for (const [key, at] of this.used) {
        if (now - at > 10 && this.sets.delete(key)) this.used.delete(key);
      }
    }
  }

  /** Construit tout de suite (premier affichage). */
  warm(variant: number, radius: number, now: number): void {
    this.get(variant, radius, now);
    this.pump(Infinity, now);
  }
}
