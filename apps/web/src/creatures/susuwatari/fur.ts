/**
 * La fourrure d'une Noiraude, décrite une fois (« génome » reproductible par
 * graine) d'après `SootSpriteParams`, puis peinte hors écran par `sprites.ts`.
 *
 * Tout est en unités de Rd, le rayon du disque noir :
 * - le contour du disque : presque un cercle (`ratio`), à peine bosselé
 *   (`wobble`) ;
 * - les poils : enracinés SOUS le bord (racines entre rootOut − depth et
 *   rootOut), dirigés vers l'extérieur selon la normale au contour (± jitter),
 *   de longueur lenMin–lenMax, droits si bend = 0 ; effilés en pointe
 *   (taper = 1) ou traits d'épaisseur constante au bout net ou arrondi
 *   (taper = 0, cap) ; répartis régulièrement (un par secteur) ;
 * - une part d'entre eux (`over`) est peinte PAR-DESSUS le corps : leur
 *   racine recule le long du poil jusque vers `inner` (la pointe ne bouge
 *   pas) — on les voit rentrer dans le corps, comme dans le film ;
 * - le duvet : des poils fins et translucides entre les autres (`fuzz`).
 * Les autres poils sont sous le disque (sprites.ts) : on ne voit que leur
 * partie qui dépasse. Chaque poil a une phase : les images de « frisottis »
 * le font osciller un peu (angle, longueur) en boucle.
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
  /** Peint par-dessus le corps (on le voit y rentrer). */
  over: boolean;
}

/** Forme des poils au tracé : effilement, bout, demi-largeur minimale (px). */
export interface HairShape {
  taper: number;
  cap: number;
  minW: number;
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
  // Tirages des réglages ajoutés depuis (poils sur le corps) : à part, pour
  // que les anciens modèles gardent exactement leur fourrure.
  const rand2 = rng(seed * 104729 + 3);
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
  let reach = (1 + body.wobble) * Math.max(1, body.ratio) + Math.max(0, body.blur) * 1.3;
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
      over: false,
    };
    if (!fine && hair.over > 0 && rand2() < hair.over) {
      // La racine recule le long du poil jusque vers `inner` (pointe fixe).
      const r = Math.hypot(h.x, h.y);
      const deep = hair.inner + (r - hair.inner) * rand2() * 0.7;
      const back = Math.max(0, r - Math.max(0, deep));
      h.x -= Math.cos(h.dir) * back;
      h.y -= Math.sin(h.dir) * back;
      h.len += back;
      h.over = true;
    }
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
 * Trace un poil dans le chemin courant : effilé en pointe (taper = 1) ou
 * trait d'épaisseur constante (taper = 0), bout net ou arrondi (cap).
 * Centre (cx, cy) et Rd en px ; `phi` : phase du frisottis.
 */
export function traceHair(ctx: CanvasRenderingContext2D, h: Hair, cx: number, cy: number, Rd: number, phi: number, wave: number, shape: HairShape): void {
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
  const taper = h.fine ? 1 : Math.max(0, Math.min(1, shape.taper));
  // Demi-largeur : jamais sous `minW` px (un poil reste visible en petit).
  const w = h.fine ? h.w * Rd : Math.max(h.w * Rd, shape.minW);
  const wt = w * (1 - taper);
  const wm = w * (1 - 0.55 * taper);
  const cap = h.fine ? 0 : Math.max(0, Math.min(1, shape.cap));
  const sag = h.bend * L * (1 + 0.25 * wave * Math.sin(phi + h.phase * 0.7));
  const mx = (bx + tx) / 2 + nx * sag;
  const my = (by + ty) / 2 + ny * sag;
  ctx.moveTo(bx + nx * w, by + ny * w);
  ctx.quadraticCurveTo(mx + nx * wm, my + ny * wm, tx + nx * wt, ty + ny * wt);
  if (wt > 0 && cap > 0.01) ctx.ellipse(tx, ty, wt * cap, wt, dir, Math.PI / 2, -Math.PI / 2, true);
  else ctx.lineTo(tx - nx * wt, ty - ny * wt);
  ctx.quadraticCurveTo(mx - nx * wm, my - ny * wm, bx - nx * w, by - ny * w);
  // Racine visible (poils sur le corps) : arrondie elle aussi.
  if (h.over && cap > 0.01) ctx.ellipse(bx, by, w * cap, w, dir, -Math.PI / 2, Math.PI / 2, true);
  ctx.closePath();
}
