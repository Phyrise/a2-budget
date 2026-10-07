/**
 * Dessin d'une Noiraude à chaque image, sur la toile du calque :
 * ombre → pattes et bras (derrière le corps, limbs.ts) → halo → corps (une
 * ou deux images de frisottis) → yeux. Seulement des drawImage et quelques
 * traits fins ; tout ce qui est flou ou dense a été pré-rendu (sprites.ts).
 * Toutes les proportions viennent de `SootSpriteParams` (params.ts).
 *
 * Le corps est dessiné dans son propre repère (centre du corps, inclinaison,
 * écrasement pivoté sous le corps) ; pattes et bras dans celui de la toile.
 */
import type { Susuwatari } from './creature';
import { drawArms, drawLegs, type BodyMatrix } from './limbs';
import type { SootSpriteParams } from './params';
import { FRAMES, shadow, type BodySprites } from './sprites';

export interface DrawOptions {
  dpr: number;
  night: boolean;
  time: number;
  /** Opacité de l'ombre au sol (0 : aucune). */
  shadow: number;
  /** Liseré clair des membres sur fond sombre (0–1). */
  rim: number;
  params: SootSpriteParams;
}

function bodyMatrix(s: Susuwatari): BodyMatrix {
  const S = s.scale;
  const q = s.squash;
  const sx = 1 + q * 0.8;
  const sy = 1 - q;
  const cos = Math.cos(s.tilt);
  const sin = Math.sin(s.tilt);
  const center = s.body();
  const pivot = s.rig.rest * S;
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

function drawEyes(ctx: CanvasRenderingContext2D, s: Susuwatari, sp: BodySprites, R: number, o: DrawOptions): void {
  const { eyes, palette } = o.params;
  const rx = eyes.size * R;
  const ry = rx * eyes.aspect;
  const turnX = s.look.x * eyes.turn * R;
  const turnY = s.look.y * eyes.turn * 0.6 * R;
  const wide = s.eyes === 'wide' ? 1.08 : 1;
  for (const side of [-1, 1] as const) {
    // Celui du côté où elle regarde s'éloigne (raccourci), l'autre grandit.
    const persp = 1 - side * s.look.x * 0.09;
    const ex = side * eyes.gap * R * (1 - side * s.look.x * 0.06) + turnX;
    const ey = -eyes.lift * R + turnY;
    const w = rx * persp * wide;
    const h = ry * persp * wide;
    if (s.eyes === 'happy' || s.eyes === 'closed') {
      // Yeux plissés « ^ » (joie) ou paupières closes « ‿ » (sommeil).
      ctx.beginPath();
      if (s.eyes === 'happy') ctx.ellipse(ex, ey + h * 0.35, w * 0.85, h * 0.55, 0, Math.PI * 1.1, Math.PI * 1.9);
      else ctx.ellipse(ex, ey - h * 0.1, w * 0.8, h * 0.4, 0, Math.PI * 0.12, Math.PI * 0.88);
      ctx.lineWidth = Math.max(0.8, R * (s.eyes === 'happy' ? 0.07 : 0.04));
      ctx.lineCap = 'round';
      ctx.strokeStyle = s.eyes === 'happy' ? palette.eye[1] : 'rgba(150, 132, 112, 0.55)';
      ctx.stroke();
      continue;
    }
    if (o.night) ctx.drawImage(sp.glow, ex - sp.glow.width / 2, ey - sp.glow.height / 2);
    const open = 1 - s.blink * 0.94;
    const hh = h * open;
    ctx.drawImage(sp.eye, ex - w - 1, ey - hh - 1, w * 2 + 2, hh * 2 + 2);
    if (open < 0.35) continue;
    // Pupille : petite, contre le bord, vers ce qu'elle regarde.
    const pr = eyes.pupil * R * (s.eyes === 'wide' ? 0.78 : 1) * persp;
    const lx = Math.max(-1, Math.min(1, s.look.x));
    const ly = Math.max(-1, Math.min(1, s.look.y));
    const reachX = Math.max(0, w - pr * 1.25);
    const reachY = Math.max(0, hh - pr * 1.25);
    const px = ex + lx * reachX * 0.92;
    const py = ey + ly * reachY * 0.92;
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 0.92, Math.min(pr * 1.06, hh * 0.9), 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.pupil;
    ctx.fill();
  }
}

/** Dessine une Noiraude (toile en px appareil, `dpr` = densité). */
export function drawSusuwatari(ctx: CanvasRenderingContext2D, s: Susuwatari, sp: BodySprites, o: DrawOptions): void {
  if (s.state === 'gone') return;
  const { dpr, params: p } = o;
  const S = s.scale;
  const m = bodyMatrix(s);
  // Taille du sprite en px CSS : son rayon nominal vaut S / 2.
  const unit = S / 2 / sp.radius;
  const half = (sp.side * unit) / 2;

  if (!o.night) {
    // Ombre au sol : plus petite et plus pâle en l'air.
    const lift = Math.min(1, s.z / (S * 1.2));
    const sw = (S / 2) * p.shadow.width * (1 - lift * 0.35);
    const sh = sw * p.shadow.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (o.shadow > 0 && p.shadow.opacity > 0) {
      ctx.globalAlpha = Math.min(1, p.shadow.opacity * o.shadow * (1 - lift * 0.6));
      ctx.drawImage(shadow(), s.x + s.jitterX - sw / 2, s.y - sh / 2, sw, sh);
      ctx.globalAlpha = 1;
    }
    drawLegs(ctx, s, m, o.rim, p);
    drawArms(ctx, s, m, o.time, o.rim, p);
  }

  ctx.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * m.e, dpr * m.f);
  if (!o.night) {
    if (sp.halo) ctx.drawImage(sp.halo, -half, -half, half * 2, half * 2);
    // Corps : deux images voisines de frisottis (le corps « vit »). La
    // fourrure se pose un moment (hold) puis ondule vers l'image suivante,
    // fondue par union (la suivante apparaît, puis la première s'efface :
    // jamais de creux d'opacité). Pendant la pause, une seule image.
    const hold = Math.max(0, Math.min(0.95, p.anim.hold));
    const phase = ((s.fur % FRAMES) + FRAMES) % FRAMES;
    const i = Math.floor(phase);
    const f = phase - i;
    const k = f < hold ? 0 : (f - hold) / (1 - hold);
    const a = sp.frames[i]!;
    const b = sp.frames[(i + 1) % FRAMES]!;
    ctx.drawImage(k < 0.5 ? a : b, -half, -half, half * 2, half * 2);
    const fade = k < 0.5 ? k * 2 : (1 - k) * 2;
    if (fade > 0.02) {
      ctx.globalAlpha = fade;
      ctx.drawImage(k < 0.5 ? b : a, -half, -half, half * 2, half * 2);
      ctx.globalAlpha = 1;
    }
  }
  // Yeux : repère du corps, à l'échelle du sprite (px sprite → px CSS).
  ctx.transform(unit, 0, 0, unit, 0, 0);
  drawEyes(ctx, s, sp, sp.radius, o);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
