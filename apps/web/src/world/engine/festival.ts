/**
 * Petit matsuri de l'anniversaire du couple (V4.3, `WorldState.festival`) :
 * une guirlande de lampions chōchin tendue d'un bord à l'autre de la forêt.
 * Lampions et corde sont dessinés par le code (festivalArt.ts) et posés
 * comme des sprites (étalonnés avec la peinture, avec leur lueur), plus un
 * halo doux dans le lot émissif. Les lampions s'allument un à un, se
 * balancent et vacillent doucement ; en image fixe (« Immobile »,
 * prefers-reduced-motion, bandeau), tous sont allumés et immobiles. Le
 * moteur ajoute des lucioles et quelques kodama (`festivalKodama`).
 *
 * Point d'accroche unique : frame.ts (`festivalOf(engine)`, rangé à côté du
 * moteur dans une WeakMap — aucun champ ajouté au moteur). Calcul seul.
 */
import { GLOW, type BillboardWriter } from './batch';
import { CHOCHIN, drawChochin, drawRope } from './festivalArt';
import { rng } from './noise';
import type { Resources } from './resources';
import type { SpriteAsset, SpriteDraw } from './spirits';

const LANTERNS = 7;
/** Délai entre deux lampions qui s'allument (s). */
const LIGHT_STEP = 0.24;
const LIGHT_DUR = 0.6;
const FADE_IN = 1.2;
const FADE_OUT = 1.5;
/** Corde (coordonnées de scène) : extrémités, creux au milieu, profondeur. */
const ROPE = { y0: 0.198, y1: 0.212, sag: 0.068, depth: 0.32 } as const;
/** Hauteur d'un lampion, ficelle et gland compris (hauteur d'image). */
const LANTERN_H = 0.058;
const ROPE_TOP = ROPE.y0 - 0.006;
const ROPE_SPAN = ROPE.y1 + ROPE.sag - ROPE.y0 + 0.014;
/** Définition de la toile de la corde (px par hauteur d'image). */
const ROPE_PX = 960;
/** Centre du papier, depuis le pied du sprite (fraction de sa hauteur). */
const PAPER_MID = 1 - (CHOCHIN.body.top + CHOCHIN.body.bottom) / 2 / CHOCHIN.h;
const NO_GLOW: [number, number, number] = [0, 0, 0];
const GLOW_RGB: [number, number, number] = [1, 0.78, 0.52];
const HALO: [number, number, number] = [1, 0.62, 0.32];

const smooth = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};

/** Hauteur de la corde au point u 0..1 (x = u). */
function ropeY(u: number): number {
  return ROPE.y0 + (ROPE.y1 - ROPE.y0) * u + ROPE.sag * 4 * u * (1 - u);
}

/** Kodama un peu plus nombreux les jours de fête (au moins trois, sans dépasser les places). */
export function festivalKodama(base: number, spots: number, level: number): number {
  if (level < 0.5) return base;
  return Math.min(spots, Math.max(base + 2, 3));
}

/** Un lampion placé pour l'image : pied du sprite, taille, rotation, centre du papier. */
interface Hung {
  x: number;
  y: number;
  h: number;
  rot: number;
  cx: number;
  cy: number;
  /** Allumage 0..1 et vacillement de la flamme. */
  lit: number;
  flicker: number;
}

export class Festival {
  private wanted = false;
  /** Présence 0..1 (fondu d'apparition / de disparition). */
  private on = 0;
  /** Début de l'allumage (horloge du moteur, s). */
  private since = -100;
  private readonly seeds: [number, number, number][];
  private art: { lantern: SpriteAsset; rope: SpriteAsset } | null = null;
  private artFailed = false;
  private hung: Hung[] = [];

  constructor(private readonly aspect: number) {
    const r = rng(1919);
    this.seeds = Array.from({ length: LANTERNS }, (): [number, number, number] => [r(), r(), r()]);
  }

  /**
   * Suit la fête voulue et renvoie son niveau 0..1 (lucioles, kodama).
   * Animé : fondu et lampions allumés un à un (le moteur tourne à 60 i/s
   * trois secondes après un changement d'état : le temps de tout allumer).
   * Image fixe : tout de suite. Place aussi les lampions pour cette image.
   */
  update(wanted: boolean, now: number, dt: number, t: number, animate: boolean): number {
    if (wanted !== this.wanted) {
      this.wanted = wanted;
      if (wanted) this.since = animate ? now : now - 100;
    }
    const goal = wanted ? 1 : 0;
    if (!animate) this.on = goal;
    else {
      this.on += (goal - this.on) * (1 - Math.exp(-dt / ((goal ? FADE_IN : FADE_OUT) / 3)));
      if (Math.abs(goal - this.on) < 0.002) this.on = goal;
    }
    this.hang(now, t, animate);
    return this.on;
  }

  private hang(now: number, t: number, animate: boolean) {
    this.hung = [];
    if (this.on < 0.002) return;
    const sway = animate ? 1 : 0;
    for (let i = 0; i < LANTERNS; i++) {
      const [s0, s1, s2] = this.seeds[i]!;
      const lit = (animate ? smooth((now - this.since - i * LIGHT_STEP) / LIGHT_DUR) : 1) * this.on;
      if (lit < 0.002) continue;
      const u = (i + 1) / (LANTERNS + 1) + (s2 - 0.5) * 0.02;
      const rot = sway * (Math.sin(t * (0.7 + 0.35 * s0) + s1 * 6.28) * 0.07 + Math.sin(t * 1.9 + s2 * 9) * 0.015);
      const s = Math.sin(rot);
      const c = Math.cos(rot);
      const h = LANTERN_H * (0.94 + 0.12 * Math.sin(Math.PI * u));
      // Le haut de la ficelle reste accroché à la corde ; le pied du sprite suit la rotation.
      const x = u - (s * h) / this.aspect;
      const y = ropeY(u) - 0.001 + c * h;
      const mid = h * PAPER_MID;
      const flicker = animate ? 0.9 + 0.06 * Math.sin(t * (6.1 + s0 * 3) + s1 * 20) + 0.04 * Math.sin(t * 13.7 + s2 * 11) : 1;
      this.hung.push({ x, y, h, rot, cx: x + (s * mid) / this.aspect, cy: y - c * mid, lit, flicker });
    }
  }

  private ensureArt(res: Resources): boolean {
    if (this.art || this.artFailed) return this.art !== null;
    try {
      const lantern = res.texture(drawChochin(), { mips: true, premult: true });
      const rope = res.texture(drawRope(ropeY, ROPE_TOP, ROPE_SPAN, this.aspect, ROPE_PX), { mips: true, premult: true });
      this.art = {
        lantern: { tex: lantern, rect: [0, 0, 1, 1], aspect: CHOCHIN.w / CHOCHIN.h, px: CHOCHIN.h },
        rope: { tex: rope, rect: [0, 0, 1, 1], aspect: this.aspect / ROPE_SPAN, px: ROPE_SPAN * ROPE_PX },
      };
    } catch {
      this.artFailed = true;
    }
    return this.art !== null;
  }

  /** Corde puis lampions (passe sprites : étalonnés avec la peinture, puis leur lueur). */
  draws(res: Resources, night: number): SpriteDraw[] {
    if (this.on < 0.002 || !this.ensureArt(res)) return [];
    const { lantern, rope } = this.art!;
    const base = { reveal: 1, depth: ROPE.depth, fogMix: 0.04 };
    const out: SpriteDraw[] = [
      { ...base, asset: rope, x: 0.5, y: ROPE_TOP + ROPE_SPAN, h: ROPE_SPAN, rot: 0, alpha: this.on, glow: 0, glowColor: NO_GLOW },
    ];
    const glowK = 0.25 + 0.35 * night;
    for (const l of this.hung) {
      out.push({ ...base, asset: lantern, x: l.x, y: l.y, h: l.h, rot: l.rot, alpha: Math.min(1, this.on * 1.5), glow: glowK * l.lit * l.flicker, glowColor: GLOW_RGB });
    }
    return out;
  }

  /** Halos doux autour du papier (lot émissif). */
  emit(out: BillboardWriter, night: number) {
    const glowK = 0.75 + 0.45 * night;
    for (const l of this.hung) {
      const halo = l.h * 2.6;
      out.push(l.cx, l.cy, ROPE.depth, halo, halo, 0, HALO[0], HALO[1], HALO[2], 0.16 * l.lit * l.flicker * glowK, GLOW);
      out.push(l.cx, l.cy, ROPE.depth, l.h * 0.7, l.h * 0.7, 0, 1, 0.86, 0.6, 0.2 * l.lit * l.flicker, GLOW);
    }
  }
}

const festivals = new WeakMap<object, Festival>();

/** Le matsuri d'un moteur (créé au premier appel). */
export function festivalOf(engine: object, aspect: number): Festival {
  let f = festivals.get(engine);
  if (!f) {
    f = new Festival(aspect);
    festivals.set(engine, f);
  }
  return f;
}
