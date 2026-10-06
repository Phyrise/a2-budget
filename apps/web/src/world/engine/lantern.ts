/**
 * Lumière de la lanterne (minuteur de concentration) : la lanterne de pierre
 * (stoneLantern.ts) posée au pied du cèdre s'allume dans son foyer. La lueur
 * et le halo grandissent avec la progression, quelques lucioles s'en
 * approchent ; à 1, floraison de lumière (≈2 s) ; null l'éteint en fondu.
 * Éclaire aussi la peinture alentour (uniforme uLantern de la passe
 * principale). Calcul seul : le moteur dessine (lot émissif). Sans peinture
 * de lanterne (chargement, échec), une lanterne de papier procédurale sert de
 * repli.
 */
import type { Who } from '../types';
import { GLOW, LANTERN, type BillboardWriter } from './batch';
import { WHO_COLORS } from './lights';
import { rng } from './noise';
import { FALLBACK_SHAPE, lanternGeometry, type LanternGeometry } from './toro';

const BLOOM = 2.2;
const FADE_OUT = 1.6;
const FIREFLIES = 10;
const SPARKS = 18;
const WARM: [number, number, number] = [1.0, 0.76, 0.42];

const smooth = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};

export interface LanternLight {
  /** x, y (scène), rayon (hauteur d'image), intensité. */
  light: [number, number, number, number];
  color: [number, number, number];
}

export class Lantern {
  /** Progression demandée (null = éteinte). */
  private target: number | null = null;
  /** Progression affichée (lissée). */
  private p = 0;
  /** Présence 0..1 (fondu d'apparition / d'extinction). */
  private on = 0;
  private who: Who = 'both';
  private bloomAt = -10;
  private color: [number, number, number] = WARM;
  private readonly seeds: [number, number, number, number][];
  /** Floraison qui vient de commencer (lue une fois par le moteur : souffle, rayon). */
  bloomEvent = false;
  /** Lanterne de pierre posée (foyer, taille) : réglée par le moteur. */
  geo: LanternGeometry;
  /** Peinture de la lanterne affichée (sinon repli : lanterne de papier procédurale). */
  painted = false;

  constructor(private readonly aspect: number) {
    const r = rng(2024);
    this.seeds = Array.from({ length: Math.max(FIREFLIES, SPARKS) }, (): [number, number, number, number] => [r(), r(), r(), r()]);
    this.geo = lanternGeometry(FALLBACK_SHAPE, aspect);
  }

  /**
   * Allumage de la peinture (fondu éteinte → allumée), 0..1 : franc dès que
   * le minuteur tourne, plein vers la fin, éclat à la floraison.
   */
  litLevel(now: number): number {
    const bk = this.bloom(now);
    const bloom = bk >= 0 ? Math.sin(Math.PI * Math.min(1, bk * 1.6)) * 0.3 : 0;
    return Math.min(1, this.on * (0.62 + 0.38 * this.p + bloom));
  }

  /** Floraison en cours (aucun kodama ne vient s'asseoir pendant ce temps). */
  blooming(now: number): boolean {
    return this.bloom(now) >= 0;
  }

  set(progress: number | null, who: Who | undefined, now: number) {
    if (progress === null) {
      this.target = null;
      return;
    }
    const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    if (p >= 1 && (this.target === null || this.target < 1)) {
      this.bloomAt = now;
      this.bloomEvent = true;
    }
    // Rallumée après extinction : la lumière repart de zéro.
    if (this.target === null && this.on < 0.02) this.p = 0;
    this.target = p;
    if (who) this.who = who;
    const w = WHO_COLORS[this.who];
    this.color = [WARM[0] * 0.7 + w[0] * 0.3, WARM[1] * 0.7 + w[1] * 0.3, WARM[2] * 0.7 + w[2] * 0.3];
  }

  /** Allumée ou en train de s'éteindre : le rendu doit continuer. */
  get active(): boolean {
    return this.target !== null || this.on > 0.002;
  }

  /** Transition visible en cours (floraison, fondu, progression qui rattrape). */
  busy(now: number): boolean {
    if (now - this.bloomAt < BLOOM) return true;
    const goal = this.target === null ? 0 : 1;
    return Math.abs(goal - this.on) > 0.004 || (this.target !== null && Math.abs(this.target - this.p) > 0.004);
  }

  /** `smooth` : transitions douces (sinon valeurs immédiates, image unique). */
  update(dt: number, now: number, smoothMode: boolean, quick: boolean) {
    const goal = this.target === null ? 0 : 1;
    if (!smoothMode) {
      this.on = goal;
      if (this.target !== null) this.p = this.target;
      return;
    }
    const tauOn = quick ? 0.15 : goal ? 0.6 : FADE_OUT / 3;
    this.on += (goal - this.on) * (1 - Math.exp(-dt / tauOn));
    if (Math.abs(goal - this.on) < 0.003) this.on = goal;
    if (this.target !== null) {
      this.p += (this.target - this.p) * (1 - Math.exp(-dt / (quick ? 0.15 : 0.8)));
      if (Math.abs(this.target - this.p) < 0.003) this.p = this.target;
    }
    void now;
  }

  private bloom(now: number): number {
    const k = (now - this.bloomAt) / BLOOM;
    return k >= 0 && k < 1 ? k : -1;
  }

  /** Lumière portée sur la peinture (rayon et intensité selon la progression). */
  sceneLight(now: number, t: number, flicker: boolean): LanternLight {
    const s = this.geo.fire;
    const bk = this.bloom(now);
    const bloom = bk >= 0 ? Math.sin(Math.PI * Math.min(1, bk * 1.6)) * (1 - bk * 0.4) : 0;
    const fl = flicker ? 0.92 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1 + 1) : 1;
    const intensity = this.on * (0.3 + 0.7 * this.p) * fl + bloom * 0.9 * this.on;
    const radius = 0.045 + 0.06 * this.p + bloom * 0.07;
    return { light: [s.x, s.y, radius, intensity], color: this.color };
  }

  emit(out: BillboardWriter, now: number, t: number, night: number, animate: boolean) {
    if (this.on < 0.002) return;
    const { fire, ground, h: tall } = this.geo;
    const { x } = fire;
    const y = ground.y;
    const depth = ground.depth;
    const [r, g, b] = this.color;
    const on = this.on;
    const p = this.p;
    const glowK = 0.85 + 0.3 * night;
    const fl = animate ? 0.9 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + 1) : 1;
    const bk = this.bloom(now);
    // Échelle des effets : celle de l'ancienne lanterne de papier (0,05), d'après la pierre posée.
    const h = Math.max(0.035, tall * 0.42);
    const cy = this.painted ? fire.y : y - h * 0.5;
    const inten = (0.38 + 0.62 * p) * on;
    // Flaque de lumière sur la mousse, halo, foyer, cœur.
    // (Le jour, l'addition sature vite : halo large mais doux, la pierre reste lisible.)
    out.push(x, y - 0.002, depth, h * (3.2 + 2.6 * p), h * (0.9 + 0.5 * p), 0, r, g * 0.9, b * 0.75, 0.26 * inten * glowK, GLOW);
    const halo = h * (2.6 + 4 * p);
    out.push(x, cy, depth, halo, halo, 0, r, g * 0.92, b * 0.8, (0.12 + 0.2 * p) * on * fl * glowK, GLOW);
    if (!this.painted) out.push(x, cy, depth, h * 0.72, h, 0, r, g, b, (0.6 + 0.3 * p) * on * fl, LANTERN);
    // Foyer : une flamme vivante dans la chambre à feu de la pierre (le cœur du papier en repli).
    const core = this.painted ? h * (0.34 + 0.12 * p) : h * 0.4;
    out.push(x, cy + (this.painted ? 0 : h * 0.1), depth, core, core, 0, 1, 0.88, 0.66, (this.painted ? 0.35 + 0.35 * p : 0.2 + 0.3 * p) * on * fl, GLOW);

    // Lucioles qui s'approchent à mesure que la lumière grandit.
    const n = animate ? Math.round(2 + 8 * p) : 0;
    const iso = 1 / this.aspect;
    for (let i = 0; i < n && i < FIREFLIES; i++) {
      const [s0, s1, s2, s3] = this.seeds[i]!;
      const ang = t * (0.35 + s0 * 0.5) * (s1 > 0.5 ? 1 : -1) + s2 * 6.283;
      let rad = (0.1 - 0.055 * p) * (0.7 + 0.6 * s3) + 0.01 * Math.sin(t * 0.9 + s0 * 9);
      let lift = 0.03 + 0.05 * s1 + 0.012 * Math.sin(t * 1.3 + s2 * 7);
      let a = Math.min(1, 2 + 8 * p - i) * on;
      if (bk >= 0) {
        // Floraison : les lucioles s'envolent en spirale.
        rad *= 1 + bk * 1.8;
        lift += bk * bk * 0.22;
        a *= 1 - smooth((bk - 0.5) / 0.5) * 0.7;
      }
      const blink = 0.55 + 0.45 * Math.sin(t * (1.6 + s3 * 1.8) + s0 * 20);
      const fx = x + Math.cos(ang) * rad * iso;
      const fy = cy - lift + Math.sin(ang) * rad * 0.35;
      out.push(fx, fy, depth + 0.02, 0.016, 0.016, 0, 0.86, 1, 0.55, a * blink * 0.9, GLOW);
    }

    // Floraison : onde de lumière et pluie d'étincelles qui montent.
    if (bk >= 0) {
      const wave = animate ? h * (3 + 14 * smooth(bk)) : h * 8;
      out.push(x, cy, depth, wave, wave, 0, r, g, b, 0.5 * (1 - bk) * on, GLOW);
      if (animate) {
        for (let i = 0; i < SPARKS; i++) {
          const [s0, s1, s2, s3] = this.seeds[i]!;
          const k = Math.min(1, Math.max(0, (bk - s3 * 0.25) / 0.75));
          if (k <= 0) continue;
          const e = 1 - (1 - k) * (1 - k);
          const ang = s0 * 6.283 + k * 2.2;
          const sx = x + Math.cos(ang) * (0.02 + 0.08 * e * s1) * iso;
          const sy = cy - e * (0.08 + 0.16 * s2) + Math.sin(ang) * 0.01;
          out.push(sx, sy, depth, 0.012, 0.012, 0, 1, 0.88, 0.6, Math.sin(Math.PI * k) * on, GLOW);
        }
      }
    }
  }
}
