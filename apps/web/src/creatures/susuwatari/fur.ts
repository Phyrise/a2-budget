/**
 * La fourrure d'une Noiraude, décrite une fois (« génome » reproductible par
 * graine) puis peinte hors écran par `sprites.ts`.
 *
 * Tout est exprimé en unités de R, le rayon nominal (bout moyen des poils) :
 * - un cœur plein légèrement bosselé (0,8 R) ;
 * - des poils intérieurs serrés qui texturent le corps et hérissent son bord ;
 * - la frange : des centaines de poils effilés, regroupés en touffes dont les
 *   pointes convergent (le contour en épis des peintures), plus courts dessous ;
 * - quelques poils fins et longs, translucides (frange douce) ;
 * - quelques mèches grises en haut à gauche (volume, lumière de la lampe).
 * Chaque poil a une phase : les images de « frisottis » le font onduler en
 * boucle (angle et longueur), sans changer la silhouette d'ensemble.
 */
import { rng } from '../../world/engine/noise';

/** Familles de poils (peintes en lots, chacune avec sa palette). */
export const Kind = {
  /** Poil intérieur (texture du corps, bord hérissé). */
  Inner: 0,
  /** Poil de la frange (épis). */
  Fringe: 1,
  /** Poil fin et long, translucide. */
  Fine: 2,
  /** Mèche grise (volume). */
  Sheen: 3,
  /** Pointe éclairée (fonds sombres). */
  Rim: 4,
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

export interface Strand {
  kind: Kind;
  /** Angle de la base (rad, 0 = droite, π/2 = bas). */
  a: number;
  /** Écart d'angle de la pointe (convergence vers la touffe). */
  pull: number;
  /** Rayon de la base et de la pointe (× R). */
  r0: number;
  r1: number;
  /** Demi-largeur à la base (× R). */
  w: number;
  /** Courbure (× R, signée). */
  bend: number;
  /** Phase et amplitude du frisottis. */
  phase: number;
  wave: number;
  /** Teinte (index dans la palette du type) et opacité. */
  tone: number;
  alpha: number;
}

export interface FurGenome {
  /** Rayon du cœur (× R) selon l'angle : bosses douces. */
  lump: (a: number) => number;
  strands: Strand[];
}

/** Différence d'angle ramenée dans ]-π, π]. */
function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Densité des poils proportionnelle au périmètre (R en px appareil). */
function counts(radiusPx: number) {
  const k = Math.max(0.5, Math.min(2.2, radiusPx / 48));
  return {
    inner: Math.round(460 * k),
    fringe: Math.round(620 * k),
    fine: Math.round(80 * k),
    sheen: Math.round(30 * k),
    rim: Math.round(70 * k),
  };
}

/**
 * Génome de la fourrure. `radiusPx` règle seulement la densité (plus de
 * poils sur un grand corps) : la silhouette dépend de la seule graine.
 */
export function furGenome(seed: number, radiusPx: number): FurGenome {
  const rand = rng(seed * 7919 + 17);
  const TAU = Math.PI * 2;

  // Bosses basses fréquences du contour.
  const harmonics = (
    [
      [2, 0.045],
      [3, 0.035],
      [5, 0.022],
      [7, 0.014],
    ] as const
  ).map(([k, amp]) => ({ k, amp, p: rand() * TAU }));
  const lump = (a: number) => 1 + harmonics.reduce((s, h) => s + h.amp * Math.sin(h.k * a + h.p), 0);

  // Touffes : 22–30 épis inégaux autour du corps.
  const tuftCount = 22 + Math.floor(rand() * 9);
  const tufts = Array.from({ length: tuftCount }, (_, i) => ({
    a: ((i + (rand() - 0.5) * 0.7) / tuftCount) * TAU,
    width: (TAU / tuftCount) * (0.55 + rand() * 0.5),
    strength: 0.55 + rand() * 0.75,
  }));
  const nearestTuft = (a: number) => {
    let best = tufts[0]!;
    let bestD = Infinity;
    for (const t of tufts) {
      const d = Math.abs(angleDiff(a, t.a));
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };
  // Dessous un peu tassé (elle est posée), dessus un peu plus ébouriffé.
  const sideFactor = (a: number) => 1 - 0.1 * Math.max(0, Math.sin(a)) + 0.04 * Math.max(0, -Math.sin(a));

  const n = counts(radiusPx);
  const strands: Strand[] = [];
  const push = (s: Strand) => strands.push(s);

  for (let i = 0; i < n.inner; i++) {
    const a = rand() * TAU;
    const r0 = 0.4 + rand() * 0.38;
    push({
      kind: Kind.Inner,
      a,
      pull: (rand() - 0.5) * 0.2,
      r0,
      r1: Math.max(r0 + 0.1, (0.84 + rand() * 0.13) * lump(a) * sideFactor(a)),
      w: 0.018 + rand() * 0.022,
      bend: (rand() - 0.5) * 0.08,
      phase: rand() * TAU,
      wave: 0.4,
      tone: Math.floor(rand() * 3),
      alpha: 1,
    });
  }

  for (let i = 0; i < n.fringe; i++) {
    const a = rand() * TAU;
    const tuft = nearestTuft(a);
    const d = angleDiff(a, tuft.a);
    const q = Math.max(0, 1 - Math.abs(d) / tuft.width);
    const reach = (0.92 + rand() * 0.1 + 0.2 * q * q * tuft.strength) * lump(a) * sideFactor(a);
    const r0 = 0.72 + rand() * 0.14;
    const outer = reach > 1.06;
    push({
      kind: Kind.Fringe,
      a,
      pull: -d * (0.35 + 0.3 * q) + (rand() - 0.5) * 0.06,
      r0,
      r1: Math.max(r0 + 0.12, reach),
      w: (outer ? 0.011 : 0.016) + rand() * 0.014,
      bend: (rand() - 0.5) * 0.09,
      phase: tuft.a * 3 + rand() * 1.2,
      wave: 1,
      tone: Math.floor(rand() * 3),
      alpha: 1,
    });
  }

  for (let i = 0; i < n.fine; i++) {
    const a = rand() * TAU;
    push({
      kind: Kind.Fine,
      a,
      pull: (rand() - 0.5) * 0.2,
      r0: 0.78 + rand() * 0.1,
      r1: (1.02 + rand() * 0.22) * lump(a) * sideFactor(a),
      w: 0.004 + rand() * 0.005,
      bend: (rand() - 0.5) * 0.12,
      phase: rand() * TAU,
      wave: 1.4,
      tone: 0,
      alpha: 0.25 + rand() * 0.35,
    });
  }

  // Mèches grises : arc haut-gauche, à la surface du corps.
  for (let i = 0; i < n.sheen; i++) {
    const a = -Math.PI * 0.62 + (rand() - 0.5) * 1.5;
    const r0 = 0.38 + rand() * 0.34;
    push({
      kind: Kind.Sheen,
      a,
      pull: (rand() - 0.5) * 0.15,
      r0,
      r1: r0 + 0.14 + rand() * 0.18,
      w: 0.006 + rand() * 0.008,
      bend: (rand() - 0.5) * 0.06,
      phase: rand() * TAU,
      wave: 0.5,
      tone: 0,
      alpha: 0.1 + rand() * 0.2,
    });
  }

  // Pointes éclairées : dessus du corps, dans la frange.
  for (let i = 0; i < n.rim; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
    const tuft = nearestTuft(a);
    const d = angleDiff(a, tuft.a);
    const q = Math.max(0, 1 - Math.abs(d) / tuft.width);
    push({
      kind: Kind.Rim,
      a,
      pull: -d * 0.4,
      r0: 0.84 + rand() * 0.08,
      r1: (0.97 + rand() * 0.1 + 0.16 * q * tuft.strength) * lump(a),
      w: 0.008 + rand() * 0.008,
      bend: (rand() - 0.5) * 0.08,
      phase: tuft.a * 3 + rand() * 1.2,
      wave: 1,
      tone: 0,
      alpha: 0.5 + rand() * 0.5,
    });
  }
  return { lump, strands };
}

/**
 * Trace un poil effilé (deux courbes qui se rejoignent en pointe) dans le
 * chemin courant. `R` en px, centre (cx, cy), ondulation de l'image `frame`.
 */
export function traceStrand(ctx: CanvasRenderingContext2D, s: Strand, cx: number, cy: number, R: number, phi: number): void {
  const sway = s.wave * (0.045 * Math.sin(phi + s.phase) + 0.02 * Math.sin(2 * phi + s.phase * 1.3));
  const grow = 1 + s.wave * 0.045 * Math.sin(phi + s.phase * 1.7);
  const a0 = s.a + sway * 0.3;
  const a1 = s.a + s.pull + sway;
  const r1 = s.r0 + (s.r1 - s.r0) * grow;
  const bx = cx + Math.cos(a0) * s.r0 * R;
  const by = cy + Math.sin(a0) * s.r0 * R;
  const tx = cx + Math.cos(a1) * r1 * R;
  const ty = cy + Math.sin(a1) * r1 * R;
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const w = s.w * R;
  const mx = (bx + tx) / 2 + nx * s.bend * R;
  const my = (by + ty) / 2 + ny * s.bend * R;
  ctx.moveTo(bx + nx * w, by + ny * w);
  ctx.quadraticCurveTo(mx + nx * w * 0.45, my + ny * w * 0.45, tx, ty);
  ctx.quadraticCurveTo(mx - nx * w * 0.45, my - ny * w * 0.45, bx - nx * w, by - ny * w);
  ctx.closePath();
}
