/**
 * Pattes et bras d'une Noiraude, dessinés en direct (traits fins et courbes),
 * derrière le corps. Proportions lues dans `SootSpriteParams.limbs` (× R,
 * R = demi-diamètre affiché ; hanches et épaules × Rd, rayon du disque) : les
 * poses restent justes quand on raccourcit les membres.
 * - jambes arquées (`bow`) : genoux du même côté, vers l'avant (mirror = 0),
 *   ou en miroir, « ( ) » vers l'extérieur (mirror = 1, comme dans le film) ;
 * - pieds et mains : petits pieds ronds et paumes (toes = 0), ou trois bouts
 *   très fins en éventail (toes = 3), posés à plat au sol pour les orteils.
 */
import type { Susuwatari } from './creature';
import { sootColor, withAlpha, type SootSpriteParams } from './params';
import type { Point } from './types';

/** Repère du corps (matrice 2D : centre, inclinaison, écrasement). */
export interface BodyMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export function apply(m: BodyMatrix, x: number, y: number): Point {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/**
 * Genou (ou coude) : deux segments de longueur `len`, plié du côté `bend` ;
 * `at` : place du pli le long du membre (0,5 : au milieu, moins : plus haut).
 */
function joint(from: Point, to: Point, len: number, bend: number, at = 0.5): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.min(Math.hypot(dx, dy), len * 2 - 0.01) || 0.01;
  const ux = dx / (Math.hypot(dx, dy) || 1);
  const uy = dy / (Math.hypot(dx, dy) || 1);
  const h = Math.sqrt(Math.max(0, len * len - (d * d) / 4));
  const mx = from.x + ux * d * at;
  const my = from.y + uy * d * at;
  return { x: mx - uy * h * bend, y: my + ux * h * bend };
}

/**
 * Pli du genou (signe et force, pour `joint`) : vers l'avant de la marche
 * (mirror = 0) ou vers l'extérieur, en miroir (mirror = 1), × bow.
 */
export function legBend(p: SootSpriteParams, side: -1 | 1, facing: 1 | -1): number {
  const m = Math.max(0, Math.min(1, p.limbs.mirror));
  return p.limbs.bow * ((1 - m) * -facing + m * -side);
}

/**
 * `n` bouts très fins en éventail depuis (x, y) autour de `dir`, à peine
 * courbes (ils partent plus à plat, puis retombent : des griffes posées) ;
 * `flat` aplatit l'éventail (posé au sol, vu de face).
 */
function fan(path: Path2D, x: number, y: number, dir: number, len: number, n: number, spread: number, flat = 1): void {
  for (let i = 0; i < n; i++) {
    const a = dir + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len * flat;
    path.moveTo(x, y);
    path.quadraticCurveTo(x + Math.cos(a) * len * 0.55, y + Math.sin(a) * len * flat * 0.35 - len * 0.08, ex, ey);
  }
}

/** Membre fin et courbe passant par l'articulation. */
function limb(path: Path2D, from: Point, knee: Point, to: Point): void {
  const cx = 2 * knee.x - (from.x + to.x) / 2;
  const cy = 2 * knee.y - (from.y + to.y) / 2;
  path.moveTo(from.x, from.y);
  path.quadraticCurveTo((cx + knee.x) / 2, (cy + knee.y) / 2, to.x, to.y);
}

/** Traits, doigts, pieds et paumes d'une paire de membres. */
interface Strokes {
  lines: Path2D;
  fine: Path2D;
  blobs: Path2D;
  width: number;
  fineWidth: number;
}

function strokes(width: number, fineWidth: number): Strokes {
  return { lines: new Path2D(), fine: new Path2D(), blobs: new Path2D(), width, fineWidth };
}

/**
 * Encre les membres. Sur fond sombre (`rim`), un liseré clair les détache
 * d'abord, comme le halo du corps ; puis le trait noir par-dessus.
 */
function ink(ctx: CanvasRenderingContext2D, k: Strokes, rim: number, p: SootSpriteParams): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (rim > 0 && p.glow.limbs > 0) {
    const halo = 1.2;
    ctx.strokeStyle = withAlpha(p.palette.halo, p.glow.limbs * rim);
    ctx.lineWidth = k.width + halo * 2;
    ctx.stroke(k.lines);
    ctx.lineWidth = k.fineWidth + halo * 2;
    ctx.stroke(k.fine);
    ctx.lineWidth = halo * 2;
    ctx.stroke(k.blobs);
  }
  const color = sootColor(p.hair.ink, 0.1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = k.width;
  ctx.stroke(k.lines);
  ctx.lineWidth = k.fineWidth;
  ctx.stroke(k.fine);
  ctx.fill(k.blobs);
}

export function drawLegs(ctx: CanvasRenderingContext2D, s: Susuwatari, m: BodyMatrix, rim: number, p: SootSpriteParams): void {
  if (s.legs < 0.04) return;
  const R = s.scale / 2;
  const Rd = R * p.body.radius;
  const seg = p.limbs.legs * R;
  const L = seg * (0.45 + 0.55 * s.legs);
  const moving = s.state === 'walk' || s.state === 'flee' || Math.hypot(s.vx, s.vy) > 8;
  const air = s.z > 0;
  const width = Math.max(0.8, p.limbs.width * R);
  const toes = Math.round(p.limbs.toes);
  const k = strokes(width, Math.max(0.5, p.limbs.width * R * p.limbs.fine));
  const F = p.limbs.feet * R;
  const stance = p.limbs.stance * seg;
  for (const side of [-1, 1] as const) {
    const hip = apply(m, side * p.limbs.hip * Rd, 0.7 * Rd * p.body.ratio);
    const ground = s.y - s.z;
    let fx = hip.x + side * stance;
    let fy = ground;
    let toe = 0;
    if (air) {
      // Pattes pendantes, un peu écartées.
      fx = hip.x + side * (stance + 0.125 * seg) - s.facing * 0.15 * seg;
      fy = hip.y + L * 1.75;
      toe = 0.5;
    } else if (moving) {
      const u = (((s.step + (side > 0 ? 0.5 : 0)) % 1) + 1) % 1;
      const stride = 1.2 * seg * Math.min(1, 0.4 + Math.hypot(s.vx, s.vy) / 90);
      let along: number;
      let lift = 0;
      if (u < 0.5) along = stride * (0.5 - u * 2);
      else {
        const v = (u - 0.5) * 2;
        along = stride * (-0.5 + v * v * (3 - 2 * v));
        lift = Math.sin(Math.PI * v) * 0.55 * seg;
        toe = Math.sin(Math.PI * v) * 0.6;
      }
      fx = hip.x + s.facing * along + side * stance * 0.45;
      fy = ground - lift;
    }
    // Si la patte est rentrée, le pied remonte sous la fourrure.
    fy = hip.y + (fy - hip.y) * (0.35 + 0.65 * s.legs);
    const foot = { x: fx, y: fy };
    limb(k.lines, hip, joint(hip, foot, L, legBend(p, side, s.facing), p.limbs.knee), foot);
    if (toes > 0) {
      // Orteils : bouts très fins en éventail depuis le bout de la jambe, posés
      // au sol (un peu aplatis) et tournés vers l'extérieur (« ( ) »).
      const out = side * 0.45 * Math.max(0, Math.min(1, p.limbs.mirror));
      fan(k.fine, fx, fy, Math.PI / 2 - out - s.facing * toe * 0.8, F, toes, p.limbs.spread, air || toe > 0.2 ? 0.9 : 0.7);
      continue;
    }
    // Petit pied arrondi, pointé vers l'avant.
    const ex = fx + s.facing * 0.51 * F;
    const ey = fy - 0.2 * F;
    k.blobs.moveTo(ex + F, ey);
    k.blobs.ellipse(ex, ey, F, 0.51 * F, s.facing * toe * 0.6, 0, Math.PI * 2);
  }
  ink(ctx, k, rim, p);
}

/** But de la main, depuis l'épaule, en longueurs de segment de bras. */
function armGoal(s: Susuwatari, side: -1 | 1, time: number): Point {
  switch (s.armPose) {
    case 'up':
      return { x: -side * 0.25, y: -1.92 };
    case 'cheer':
      // Bras levés en « V » (comme dans le film).
      return { x: side * 1.05, y: -1.15 };
    case 'wave':
      if (side < 0) return { x: 0, y: 0 };
      return { x: 1 + 0.21 * Math.sin(time * 12), y: -1.5 + 0.125 * Math.cos(time * 12) };
    case 'flail': {
      const a = -Math.PI / 2 + side * (0.9 + 0.55 * Math.sin(time * 19 + side * 1.7));
      return { x: side * 0.17 + Math.cos(a) * 1.33, y: 0.04 + Math.sin(a) * 1.33 };
    }
    default:
      return { x: side * 0.17, y: 0.25 };
  }
}

export function drawArms(ctx: CanvasRenderingContext2D, s: Susuwatari, m: BodyMatrix, time: number, rim: number, p: SootSpriteParams): void {
  if (s.arms < 0.04) return;
  const R = s.scale / 2;
  const Rd = R * p.body.radius;
  const L = p.limbs.arms * R;
  const width = Math.max(0.7, p.limbs.width * 0.8 * R);
  const toes = Math.round(p.limbs.toes);
  const k = strokes(width, toes > 0 ? Math.max(0.5, p.limbs.width * R * p.limbs.fine) : Math.max(0.6, width * 0.58));
  const H = p.limbs.hands * R;
  for (const side of [-1, 1] as const) {
    const sh = { x: side * p.limbs.shoulder * Rd, y: -0.15 * Rd };
    const goal = armGoal(s, side, time);
    const local = { x: sh.x + goal.x * L * s.arms, y: sh.y + goal.y * L * s.arms };
    const from = apply(m, sh.x, sh.y);
    const hand = apply(m, local.x, local.y);
    const elbow = joint(from, hand, L, side);
    limb(k.lines, from, elbow, hand);
    const dir = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
    if (toes > 0) {
      // Doigts : bouts très fins dans le prolongement du bras.
      fan(k.fine, hand.x, hand.y, dir, H, toes, p.limbs.spread * 0.8);
      continue;
    }
    // Minuscule main : une paume et quatre doigts (si elle est assez grande pour les voir).
    k.blobs.moveTo(hand.x + Math.cos(dir) * H, hand.y + Math.sin(dir) * H);
    k.blobs.ellipse(hand.x, hand.y, H, H * 0.85, dir, 0, Math.PI * 2);
    if (H > 1.04) {
      for (const f of [-0.85, -0.28, 0.28, 0.85]) {
        const fx = hand.x + Math.cos(dir + f) * 0.75 * H;
        const fy = hand.y + Math.sin(dir + f) * 0.75 * H;
        k.fine.moveTo(fx, fy);
        k.fine.lineTo(fx + Math.cos(dir + f * 1.15) * H, fy + Math.sin(dir + f * 1.15) * H);
      }
    }
  }
  ink(ctx, k, rim, p);
}
