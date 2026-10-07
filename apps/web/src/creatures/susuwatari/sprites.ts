/**
 * Pré-rendu hors écran des Noiraudes, à la densité réelle de l'écran :
 * rien de coûteux n'est fait à chaque image (pas de shadowBlur ni de filtre
 * pendant l'animation, seulement des drawImage).
 *
 * Un jeu de sprites par (variante de fourrure, rayon en px appareil, rim) :
 * - `frames` : FRAMES images du corps entier — frange (épis, poils fins,
 *              pointes éclairées) qui ondule en boucle, sous le cœur fixe
 *              (poils intérieurs, mèches grises) — fondues à l'affichage ;
 * - `halo`   : lueur douce derrière le corps (fonds sombres, `rim` > 0) ;
 * - `eye`    : blanc de l'œil légèrement ombré ; `glow` : lueur de nuit.
 * Rayons regroupés par paliers de 20 %, construits au-dessus du besoin :
 * l'affichage réduit un sprite (17 % au plus), ne l'agrandit jamais. Construction étalée : une toile par pas, dans un
 * budget de temps par image (`SpriteCache.pump`).
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
  /** Corps entier (frange de l'image f + cœur), une image par frisottis. */
  frames: HTMLCanvasElement[];
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

/** Le cœur (fixe), peint par-dessus la frange de chaque image. */
function paintCore(ctx: CanvasRenderingContext2D, genome: FurGenome, R: number, side: number): void {
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
}

function paintFrame(genome: FurGenome, R: number, side: number, frame: number, rim: number, core: HTMLCanvasElement): HTMLCanvasElement {
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
  ctx.drawImage(core, 0, 0);
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

/**
 * Construction pas à pas : chaque `next()` peint une seule toile (le cœur,
 * puis chaque image de frisottis, puis halo et yeux), pour étaler le coût
 * sur plusieurs images d'animation.
 */
export function* buildSteps(variant: number, radius: number, rim: number): Generator<void, BodySprites, void> {
  const R = radius;
  const side = Math.ceil(R * EXTENT * 2) + 4;
  const genome = furGenome(variant + 1, R);
  const core = canvas(side, side);
  paintCore(ctx2d(core), genome, R, side);
  yield;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < FRAMES; f++) {
    frames.push(paintFrame(genome, R, side, f, rim, core));
    yield;
  }
  return { radius: R, side, frames, halo: rim > 0 ? paintHalo(genome, R, side, rim) : null, eye: paintEye(R), glow: paintGlow(R) };
}

export function buildBody(variant: number, radius: number, rim: number): BodySprites {
  const steps = buildSteps(variant, radius, rim);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/**
 * Palier de rayon (20 %) : un rayon voulu → rayon du sprite à construire,
 * toujours au-dessus (l'affichage ne fait que réduire, de 17 % au plus :
 * le trait reste net).
 */
export function bucketRadius(radius: number): number {
  const k = Math.ceil(Math.log(Math.max(4, radius)) / Math.log(1.2) - 1e-9);
  return Math.ceil(Math.pow(1.2, k));
}

interface Job {
  key: string;
  variant: number;
  steps: Generator<void, BodySprites, void>;
}

/**
 * Cache des sprites d'un calque. `get` rend le meilleur sprite DISPONIBLE
 * (le palier exact, sinon le plus proche déjà construit) et met le palier
 * manquant en chantier ; `pump` avance les chantiers dans un budget de temps
 * (au moins une toile par appel).
 */
export class SpriteCache {
  private sets = new Map<string, BodySprites>();
  private jobs: Job[] = [];
  private used = new Map<string, number>();
  /** Dernier instant (performance.now) où une toile a été peinte. */
  builtAt = 0;
  constructor(private rim: number) {}

  setRim(rim: number): void {
    if (rim === this.rim) return;
    this.rim = rim;
    this.sets.clear();
    this.jobs = [];
  }

  get(variant: number, radius: number, now: number): BodySprites | null {
    const r = bucketRadius(radius);
    const key = `${variant}:${r}`;
    const hit = this.sets.get(key);
    this.used.set(key, now);
    if (hit) return hit;
    if (!this.jobs.some((j) => j.key === key)) this.jobs.push({ key, variant, steps: buildSteps(variant, r, this.rim) });
    // En attendant : le palier le plus proche de la même variante.
    let best: BodySprites | null = null;
    for (const [k, set] of this.sets) {
      if (!k.startsWith(`${variant}:`)) continue;
      if (best === null || Math.abs(set.radius - r) < Math.abs(best.radius - r)) best = set;
    }
    return best;
  }

  private advance(job: Job): boolean {
    const step = job.steps.next();
    this.builtAt = performance.now();
    if (!step.done) return false;
    this.sets.set(job.key, step.value);
    this.jobs.splice(this.jobs.indexOf(job), 1);
    return true;
  }

  /** Avance les chantiers tant que le budget (ms) le permet. */
  pump(budgetMs: number, now: number): void {
    const start = performance.now();
    while (this.jobs.length > 0) {
      this.advance(this.jobs[0]!);
      if (performance.now() - start > budgetMs) break;
    }
    // Les paliers oubliés depuis 10 s (curseur de taille) sont libérés.
    if (this.sets.size > 16) {
      for (const [key, at] of this.used) {
        if (now - at > 10 && this.sets.delete(key)) this.used.delete(key);
      }
    }
  }

  /** Premier affichage d'une variante : construite tout de suite (sinon le palier voisin sert). */
  warm(variant: number, radius: number, now: number): void {
    if (this.get(variant, radius, now) !== null) return;
    const key = `${variant}:${bucketRadius(radius)}`;
    const job = this.jobs.find((j) => j.key === key);
    if (job) while (!this.advance(job));
  }
}
