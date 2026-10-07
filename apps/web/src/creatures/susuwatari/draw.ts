/**
 * Dessin d'une Noiraude à chaque image, sur la toile du calque :
 * ombre → pattes et bras (derrière le corps) → halo → frange (deux images
 * fondues) → cœur → yeux. Seulement des drawImage et quelques traits fins ;
 * tout ce qui est flou ou dense a été pré-rendu (sprites.ts).
 *
 * Le corps est dessiné dans son propre repère (centre du corps, inclinaison,
 * écrasement pivoté sous le corps) ; pattes et bras dans celui de la toile.
 */
import type { Point, Susuwatari } from './creature';
import { EYE, FRAMES, SOOT, shadow, type BodySprites } from './sprites';

export interface DrawOptions {
  dpr: number;
  night: boolean;
  time: number;
  /** Opacité de l'ombre au sol (0 : aucune). */
  shadow: number;
}

/** Repère du corps : centre, inclinaison, écrasement (pivot sous le corps). */
interface Frame {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function bodyFrame(s: Susuwatari): Frame {
  const S = s.scale;
  const q = s.squash;
  const sx = 1 + q * 0.8;
  const sy = 1 - q;
  const cos = Math.cos(s.tilt);
  const sin = Math.sin(s.tilt);
  const center = s.body();
  const pivot = 0.42 * S;
  // monde = (centre + (0, pivot)) + R · Éc · (local − (0, pivot))
  return {
    a: cos * sx,
    b: sin * sx,
    c: -sin * sy,
    d: cos * sy,
    e: center.x + sin * sy * pivot,
    f: center.y + pivot - cos * sy * pivot,
  };
}

function apply(m: Frame, x: number, y: number): Point {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** Genou (ou coude) : deux segments de longueur `len`, plié du côté `bend`. */
function joint(from: Point, to: Point, len: number, bend: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.min(Math.hypot(dx, dy), len * 2 - 0.01) || 0.01;
  const ux = dx / (Math.hypot(dx, dy) || 1);
  const uy = dy / (Math.hypot(dx, dy) || 1);
  const h = Math.sqrt(Math.max(0, len * len - (d * d) / 4));
  const mx = from.x + ux * (d / 2);
  const my = from.y + uy * (d / 2);
  return { x: mx - uy * h * bend, y: my + ux * h * bend };
}

/** Membre fin et courbe passant par l'articulation. */
function limb(ctx: CanvasRenderingContext2D, from: Point, knee: Point, to: Point): void {
  const cx = 2 * knee.x - (from.x + to.x) / 2;
  const cy = 2 * knee.y - (from.y + to.y) / 2;
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((cx + knee.x) / 2, (cy + knee.y) / 2, to.x, to.y);
}

function drawLegs(ctx: CanvasRenderingContext2D, s: Susuwatari, m: Frame): void {
  if (s.legs < 0.04) return;
  const S = s.scale;
  const L = 0.2 * S * (0.45 + 0.55 * s.legs);
  const moving = s.state === 'walk' || s.state === 'flee' || Math.hypot(s.vx, s.vy) > 8;
  const air = s.z > 0;
  ctx.lineWidth = Math.max(0.8, 0.05 * S);
  ctx.lineCap = 'round';
  ctx.strokeStyle = SOOT.limb;
  ctx.fillStyle = SOOT.limb;
  for (const side of [-1, 1] as const) {
    const hip = apply(m, side * 0.15 * S, 0.3 * S);
    const ground = s.y - s.z;
    let fx = hip.x + side * 0.045 * S;
    let fy = ground;
    let toe = 0;
    if (air) {
      // Pattes pendantes, un peu écartées.
      fx = hip.x + side * 0.07 * S - s.facing * 0.03 * S;
      fy = hip.y + L * 1.75;
      toe = 0.5;
    } else if (moving) {
      const u = (((s.step + (side > 0 ? 0.5 : 0)) % 1) + 1) % 1;
      const stride = 0.24 * S * Math.min(1, 0.4 + Math.hypot(s.vx, s.vy) / 90);
      let along: number;
      let lift = 0;
      if (u < 0.5) along = stride * (0.5 - u * 2);
      else {
        const v = (u - 0.5) * 2;
        along = stride * (-0.5 + v * v * (3 - 2 * v));
        lift = Math.sin(Math.PI * v) * 0.11 * S;
        toe = Math.sin(Math.PI * v) * 0.6;
      }
      fx = hip.x + s.facing * along + side * 0.02 * S;
      fy = ground - lift;
    }
    // Si la patte est rentrée, le pied remonte sous la fourrure.
    fy = hip.y + (fy - hip.y) * (0.35 + 0.65 * s.legs);
    const foot = { x: fx, y: fy };
    const knee = joint(hip, foot, L, -s.facing);
    ctx.beginPath();
    limb(ctx, hip, knee, foot);
    ctx.stroke();
    // Petit pied arrondi, pointé vers l'avant.
    ctx.beginPath();
    ctx.ellipse(fx + s.facing * 0.04 * S, fy - 0.016 * S, 0.078 * S, 0.04 * S, s.facing * toe * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function armTarget(s: Susuwatari, side: -1 | 1, time: number): { x: number; y: number } {
  const S = s.scale;
  switch (s.armPose) {
    case 'up':
      return { x: side * 0.3 * S, y: -0.52 * S };
    case 'wave':
      if (side < 0) return { x: -0.36 * S, y: -0.06 * S };
      return { x: (0.6 + 0.05 * Math.sin(time * 12)) * S, y: (-0.42 + 0.03 * Math.cos(time * 12)) * S };
    case 'flail': {
      const a = -Math.PI / 2 + side * (0.9 + 0.55 * Math.sin(time * 19 + side * 1.7));
      return { x: side * 0.4 * S + Math.cos(a) * 0.32 * S, y: -0.05 * S + Math.sin(a) * 0.32 * S };
    }
    default:
      return { x: side * 0.4 * S, y: 0 };
  }
}

function drawArms(ctx: CanvasRenderingContext2D, s: Susuwatari, m: Frame, time: number): void {
  if (s.arms < 0.04) return;
  const S = s.scale;
  const L = 0.24 * S;
  ctx.lineWidth = Math.max(0.7, 0.038 * S);
  ctx.lineCap = 'round';
  ctx.strokeStyle = SOOT.limb;
  ctx.fillStyle = SOOT.limb;
  for (const side of [-1, 1] as const) {
    const sh = { x: side * 0.36 * S, y: -0.06 * S };
    const goal = armTarget(s, side, time);
    const local = { x: sh.x + (goal.x - sh.x) * s.arms, y: sh.y + (goal.y - sh.y) * s.arms };
    const from = apply(m, sh.x, sh.y);
    const hand = apply(m, local.x, local.y);
    const elbow = joint(from, hand, L, side);
    ctx.beginPath();
    limb(ctx, from, elbow, hand);
    ctx.stroke();
    // Petite main : une paume et trois doigts.
    const dir = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
    ctx.beginPath();
    ctx.ellipse(hand.x, hand.y, 0.04 * S, 0.034 * S, dir, 0, Math.PI * 2);
    ctx.fill();
    if (S > 26) {
      ctx.lineWidth = Math.max(0.6, 0.022 * S);
      ctx.beginPath();
      for (const f of [-0.85, -0.28, 0.28, 0.85]) {
        const fx = hand.x + Math.cos(dir + f) * 0.03 * S;
        const fy = hand.y + Math.sin(dir + f) * 0.03 * S;
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(dir + f * 1.15) * 0.04 * S, fy + Math.sin(dir + f * 1.15) * 0.04 * S);
      }
      ctx.stroke();
      ctx.lineWidth = Math.max(0.7, 0.038 * S);
    }
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, s: Susuwatari, sp: BodySprites, R: number, night: boolean): void {
  const rx = EYE.rx * R;
  const ry = EYE.ry * R;
  const turnX = s.look.x * 0.1 * R;
  const turnY = s.look.y * 0.06 * R;
  const wide = s.eyes === 'wide' ? 1.08 : 1;
  for (const side of [-1, 1] as const) {
    // Celui du côté où elle regarde s'éloigne (raccourci), l'autre grandit.
    const persp = 1 - side * s.look.x * 0.09;
    const ex = side * EYE.gap * R * (1 - side * s.look.x * 0.06) + turnX;
    const ey = EYE.y * R + turnY;
    const w = rx * persp * wide;
    const h = ry * persp * wide;
    if (s.eyes === 'happy' || s.eyes === 'closed') {
      // Yeux plissés « ^ » (joie) ou paupières closes « ‿ » (sommeil).
      ctx.beginPath();
      if (s.eyes === 'happy') ctx.ellipse(ex, ey + h * 0.35, w * 0.85, h * 0.55, 0, Math.PI * 1.1, Math.PI * 1.9);
      else ctx.ellipse(ex, ey - h * 0.1, w * 0.8, h * 0.4, 0, Math.PI * 0.12, Math.PI * 0.88);
      ctx.lineWidth = Math.max(0.8, R * (s.eyes === 'happy' ? 0.07 : 0.04));
      ctx.lineCap = 'round';
      ctx.strokeStyle = s.eyes === 'happy' ? SOOT.eye[1] : 'rgba(150, 132, 112, 0.55)';
      ctx.stroke();
      continue;
    }
    if (night) ctx.drawImage(sp.glow, ex - sp.glow.width / 2, ey - sp.glow.height / 2);
    const open = 1 - s.blink * 0.94;
    const hh = h * open;
    ctx.drawImage(sp.eye, ex - w - 1, ey - hh - 1, w * 2 + 2, hh * 2 + 2);
    if (open < 0.35) continue;
    // Pupille : petite, contre le bord, vers ce qu'elle regarde.
    const pr = EYE.pupil * R * (s.eyes === 'wide' ? 0.78 : 1) * persp;
    const lx = Math.max(-1, Math.min(1, s.look.x));
    const ly = Math.max(-1, Math.min(1, s.look.y));
    const reachX = Math.max(0, w - pr * 1.25);
    const reachY = Math.max(0, hh - pr * 1.25);
    const px = ex + lx * reachX * 0.92;
    const py = ey + ly * reachY * 0.92;
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 0.92, Math.min(pr * 1.06, hh * 0.9), 0, 0, Math.PI * 2);
    ctx.fillStyle = SOOT.pupil;
    ctx.fill();
  }
}

/** Dessine une Noiraude (toile en px appareil, `dpr` = densité). */
export function drawSusuwatari(ctx: CanvasRenderingContext2D, s: Susuwatari, sp: BodySprites, o: DrawOptions): void {
  if (s.state === 'gone') return;
  const { dpr } = o;
  const S = s.scale;
  const m = bodyFrame(s);
  // Taille du sprite en px CSS : son rayon nominal vaut S / 2.
  const unit = S / 2 / sp.radius;
  const half = (sp.side * unit) / 2;
  const R = sp.radius;

  if (!o.night) {
    // Ombre au sol : plus petite et plus pâle en l'air.
    const lift = Math.min(1, s.z / (S * 1.2));
    const sw = S * 0.95 * (1 - lift * 0.35);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (o.shadow > 0) {
      ctx.globalAlpha = 0.85 * o.shadow * (1 - lift * 0.6);
      ctx.drawImage(shadow(), s.x + s.jitterX - sw / 2, s.y - sw * 0.11, sw, sw * 0.22);
      ctx.globalAlpha = 1;
    }
    drawLegs(ctx, s, m);
    drawArms(ctx, s, m, o.time);
  }

  ctx.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * m.e, dpr * m.f);
  if (!o.night) {
    if (sp.halo) ctx.drawImage(sp.halo, -half, -half, half * 2, half * 2);
    // Frange : deux images voisines (le corps « vit »). Fondu par union :
    // la suivante apparaît sur la première, puis la première s'efface —
    // jamais de creux d'opacité au milieu du fondu.
    const phase = ((s.fur % FRAMES) + FRAMES) % FRAMES;
    const i = Math.floor(phase);
    const k = phase - i;
    const a = sp.fringe[i]!;
    const b = sp.fringe[(i + 1) % FRAMES]!;
    ctx.drawImage(k < 0.5 ? a : b, -half, -half, half * 2, half * 2);
    ctx.globalAlpha = k < 0.5 ? k * 2 : (1 - k) * 2;
    ctx.drawImage(k < 0.5 ? b : a, -half, -half, half * 2, half * 2);
    ctx.globalAlpha = 1;
    ctx.drawImage(sp.core, -half, -half, half * 2, half * 2);
  }
  // Yeux : repère du corps, à l'échelle du sprite (px sprite → px CSS).
  ctx.transform(unit, 0, 0, unit, 0, 0);
  drawEyes(ctx, s, sp, R, o.night);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
