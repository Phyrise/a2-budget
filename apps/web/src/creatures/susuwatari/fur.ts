/**
 * La fourrure d'une Noiraude, décrite une fois (« génome » reproductible par
 * graine) d'après `SootSpriteParams`, puis peinte hors écran par `sprites.ts`.
 *
 * Tout est en unités de Rd, le rayon du disque noir :
 * - le contour du disque : presque un cercle (`ratio`), à peine bosselé
 *   (`wobble`) ;
 * - les poils : des pointes effilées enracinées SOUS le bord (racines entre
 *   rootOut − depth et rootOut), dirigées vers l'extérieur selon la normale au
 *   contour (± jitter), courtes (lenMin–lenMax), droites si bend = 0 ;
 *   répartis régulièrement (un par secteur) : le halo reste dense et égal ;
 * - le duvet : des poils fins et translucides entre les autres (`fuzz`).
 * Le disque est peint PAR-DESSUS les poils (sprites.ts) : on ne voit que
 * leur partie qui dépasse. Chaque poil a une phase : les images de
 * « frisottis » le font osciller un peu (angle, longueur) en boucle.
 */
import { rng } from '../../world/engine/noise';
import type { SootSpriteParams } from './params';

export interface Hair {
  /** Racine (× Rd, depuis le centre). */
  x: number;
  y: number;
  /** Direction au repos (rad, 0 = droite, π/2 = bas). */
  dir: number;
  /** Longueur et demi-largeur à la base (× Rd). */
  len: number;
  w: number;
  /** Flèche signée (× longueur ; 0 : poil droit). */
  bend: number;
  phase: number;
  /** Teinte (0–2, du plus noir au plus clair). */
  tone: number;
  /** Duvet (fin, translucide). */
  fine: boolean;
  /** Sur le dessus : pointe éclairée sur fond sombre. */
  lit: boolean;
}

export interface FurGenome {
  /** Point du contour du disque à l'angle a (× Rd). */
  edge: (a: number) => { x: number; y: number };
  hairs: Hair[];
  /** Portée maximale (contour ou pointes, frisottis compris), × Rd. */
  reach: number;
}

const TAU = Math.PI * 2;

/** Différence d'angle ramenée dans ]-π, π]. */
function angleDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Bosses basses fréquences du contour (somme des poids = 1 : amplitude max = wobble). */
const HARMONICS = [
  [2, 0.3],
  [3, 0.24],
  [5, 0.18],
  [7, 0.14],
  [11, 0.08],
  [17, 0.06],
] as const;

export function furGenome(seed: number, p: SootSpriteParams): FurGenome {
  const rand = rng(seed * 7919 + 17);
  const { hair, body } = p;
  const waves = HARMONICS.map(([k, w]) => ({ k, w, ph: rand() * TAU }));
  const lump = (a: number) => 1 + body.wobble * waves.reduce((s, h) => s + h.w * Math.sin(h.k * a + h.ph), 0);
  const edge = (a: number) => {
    const r = lump(a);
    return { x: Math.cos(a) * r, y: Math.sin(a) * body.ratio * r };
  };
  // Normale extérieure d'une ellipse de demi-axes 1 × ratio.
  const normal = (a: number) => Math.atan2(Math.sin(a), body.ratio * Math.cos(a));

  // Épis (anciens essais) : les pointes convergent vers 22–30 touffes.
  const tuftCount = 22 + Math.floor(rand() * 9);
  const tufts = Array.from({ length: tuftCount }, (_, i) => ({
    a: ((i + (rand() - 0.5) * 0.7) / tuftCount) * TAU,
    width: (TAU / tuftCount) * (0.55 + rand() * 0.5),
    strength: 0.3 + rand() * 0.7,
  }));
  const nearestTuft = (a: number) => tufts.reduce((best, t) => (Math.abs(angleDiff(a, t.a)) < Math.abs(angleDiff(a, best.a)) ? t : best), tufts[0]!);

  const hairs: Hair[] = [];
  let reach = (1 + body.wobble) * Math.max(1, body.ratio);
  const grow = 1 + 0.06 * p.anim.wave;
  const make = (a: number, fine: boolean) => {
    const r0 = hair.rootOut - hair.depth * rand();
    let len = hair.lenMin + (hair.lenMax - hair.lenMin) * rand();
    // Dessous tassé (elle est posée), sans passer sous la longueur minimale.
    len = Math.max(Math.min(hair.lenMin, len), len * (1 - hair.under * Math.max(0, Math.sin(a)) ** 2));
    let tilt = (rand() - 0.5) * 2 * hair.jitter;
    if (hair.tufts > 0) {
      const t = nearestTuft(a);
      const d = angleDiff(a, t.a);
      const q = Math.max(0, 1 - Math.abs(d) / t.width);
      len *= 1 + hair.tufts * q * q * t.strength * 0.8;
      tilt += Math.max(-1.2, Math.min(1.2, -d / Math.max(0.05, len))) * hair.tufts * 0.5;
    }
    if (fine) len *= hair.fuzzLen * (0.7 + rand() * 0.5);
    const e = edge(a);
    const h: Hair = {
      x: e.x * r0,
      y: e.y * r0,
      dir: normal(a) + tilt,
      len,
      w: (hair.width / 2) * (fine ? 0.42 : 1) * (0.75 + rand() * 0.5),
      bend: (rand() - 0.5) * 2 * hair.bend,
      phase: rand() * TAU,
      tone: fine ? 1 : Math.floor(rand() * 3),
      fine,
      lit: !fine && Math.sin(a) < -0.25,
    };
    hairs.push(h);
    const tip = Math.hypot(h.x + Math.cos(h.dir) * len * grow, h.y + Math.sin(h.dir) * len * grow);
    reach = Math.max(reach, tip + Math.abs(h.bend) * len * 0.5 + 0.02);
  };

  // Un poil par secteur (le halo reste égal), duvet décalé d'un demi-secteur.
  const n = Math.max(0, Math.round(hair.count));
  for (let i = 0; i < n; i++) make(((i + rand()) / n) * TAU, false);
  const nf = Math.max(0, Math.round(hair.count * hair.fuzz));
  for (let i = 0; i < nf; i++) make(((i + 0.5 + (rand() - 0.5) * 0.9) / nf) * TAU, true);
  return { edge, hairs, reach };
}

/**
 * Trace un poil effilé (deux courbes qui se rejoignent en pointe) dans le
 * chemin courant. Centre (cx, cy) et Rd en px ; `phi` : phase du frisottis.
 */
export function traceHair(ctx: CanvasRenderingContext2D, h: Hair, cx: number, cy: number, Rd: number, phi: number, wave: number): void {
  const sway = wave * (0.06 * Math.sin(phi + h.phase) + 0.025 * Math.sin(2 * phi + h.phase * 1.3));
  const grow = 1 + wave * 0.05 * Math.sin(phi + h.phase * 1.7);
  const dir = h.dir + sway;
  const L = h.len * grow * Rd;
  const bx = cx + h.x * Rd;
  const by = cy + h.y * Rd;
  const nx = -Math.sin(dir);
  const ny = Math.cos(dir);
  const tx = bx + Math.cos(dir) * L;
  const ty = by + Math.sin(dir) * L;
  const w = h.w * Rd;
  const sag = h.bend * L * (1 + 0.25 * wave * Math.sin(phi + h.phase * 0.7));
  const mx = (bx + tx) / 2 + nx * sag;
  const my = (by + ty) / 2 + ny * sag;
  ctx.moveTo(bx + nx * w, by + ny * w);
  ctx.quadraticCurveTo(mx + nx * w * 0.45, my + ny * w * 0.45, tx, ty);
  ctx.quadraticCurveTo(mx - nx * w * 0.45, my - ny * w * 0.45, bx - nx * w, by - ny * w);
  ctx.closePath();
}
