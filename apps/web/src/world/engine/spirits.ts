/**
 * Esprits de la forêt : kodama (selon l'humeur, luisants la nuit, petit
 * hochement de tête), créatures débloquées (discrètes) et gardien (≈10 s :
 * le vent tombe, la brume s'illumine, dévoilement lumineux, dissolution en
 * lucioles). Ce module ne fait que calculer ; le moteur dessine.
 */
import type { Texture } from 'ogl';
import type { ScenePoint } from '../types';
import { GLOW, type BillboardWriter, type Rect } from './batch';
import type { FxAtlasMap } from './atlas';
import { rng } from './noise';

export interface SpriteAsset {
  tex: Texture;
  rect: Rect;
  /** Largeur / hauteur (px) de la partie utile. */
  aspect: number;
}

export interface SpriteDraw {
  asset: SpriteAsset;
  x: number;
  y: number;
  depth: number;
  h: number;
  rot: number;
  alpha: number;
  reveal: number;
  /** Lueur additive (0 = aucune). */
  glow: number;
  glowColor: [number, number, number];
  fogMix: number;
}

interface KodamaState {
  vis: number;
  nodAt: number;
  nodDir: number;
  nextNod: number;
  /** Amplitude du hochement (plus marquée pour un pulse fort). */
  nodAmp: number;
  /** Un pulse fort fait sortir le kodama le plus proche, même caché (jusqu'à). */
  peekUntil: number;
}

/** Durée d'un hochement spontané / pour un pulse fort (s). */
const NOD = 1.4;
const NOD_STRONG = 2.2;

export const GUARDIAN_DURATION = 10.5;

export interface GuardianFrame {
  active: boolean;
  reveal: number;
  fogGlow: number;
  windScale: number;
  burst: number;
  breathe: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Spirits {
  kodama: SpriteAsset[] = [];
  creatures = new Map<string, SpriteAsset>();
  guardian: SpriteAsset | null = null;
  private k: KodamaState[];
  private creatureVis = new Map<string, number>();
  private guardianStart = -1;
  private guardianSkip = -1;
  private readonly rand = rng(4242);

  constructor(
    private readonly spots: ScenePoint[],
    private readonly creatureSpots: Record<string, ScenePoint>,
    private readonly guardianSpot: ScenePoint,
  ) {
    this.k = spots.map((_, i) => ({ vis: 0, nodAt: -10, nodDir: 1, nextNod: 4 + i * 3.3, nodAmp: 0.09, peekUntil: -10 }));
  }

  /** Visibilité du kodama i (0..1). */
  visibility(i: number): number {
    return this.k[i]?.vis ?? 0;
  }

  /**
   * Le kodama le plus proche d'une lumière qui se pose tourne la tête vers
   * elle. Pulse fort : le plus proche, même caché, sort un instant et se
   * tourne franchement.
   */
  lookAt(x: number, y: number, now: number, strong = false) {
    let best = -1;
    let bd = Infinity;
    this.spots.forEach((s, i) => {
      const d = Math.hypot(s.x - x, s.y - y);
      if ((strong || this.k[i]!.vis > 0.3) && d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) {
      const st = this.k[best]!;
      st.nodAt = now;
      st.nodDir = x > this.spots[best]!.x ? 1 : -1;
      st.nodAmp = strong ? 0.17 : 0.09;
      if (strong && this.kodama.length > 0) st.peekUntil = now + 5;
    }
  }

  startGuardian(now: number) {
    this.guardianStart = now;
    this.guardianSkip = -1;
  }

  skipGuardian(now: number) {
    if (this.guardianStart >= 0 && this.guardianSkip < 0) this.guardianSkip = now;
  }

  guardianActive(now: number): boolean {
    return this.guardianFrame(now).active;
  }

  guardianFrame(now: number): GuardianFrame {
    const off: GuardianFrame = { active: false, reveal: 0, fogGlow: 0, windScale: 1, burst: 0, breathe: 0 };
    if (this.guardianStart < 0) return off;
    let g = now - this.guardianStart;
    // Pas de sprite chargé à temps : on retarde le dévoilement (max 3 s).
    if (!this.guardian && g > 1.6 && g < 4.6) g = 1.6;
    if (g > GUARDIAN_DURATION) {
      this.guardianStart = -1;
      return off;
    }
    let reveal = smooth(1.6, 5.0, g) * (1 - smooth(7.2, 9.4, g));
    let fogGlow = smooth(0, 1.8, g) * (1 - smooth(8.6, 10.4, g));
    let windScale = 1 - smooth(0, 1.4, g) * (1 - smooth(9, 10.5, g));
    let burst = g > 7.0 ? Math.min(1, (g - 7.0) / 3.4) : 0;
    if (this.guardianSkip >= 0) {
      const s = Math.min(1, (now - this.guardianSkip) / 0.9);
      reveal *= 1 - s;
      fogGlow *= 1 - s;
      windScale = windScale + (1 - windScale) * s;
      burst = burst > 0 ? Math.min(1, burst + s) : 0;
      if (s >= 1) {
        this.guardianStart = -1;
        return off;
      }
    }
    return { active: true, reveal, fogGlow, windScale, burst, breathe: Math.sin(g * 1.4) };
  }

  update(now: number, dt: number, count: number, creatures: string[], animate: boolean) {
    const k = animate ? 1 - Math.exp(-dt / 0.8) : 1;
    this.k.forEach((st, i) => {
      const target = (i < count || now < st.peekUntil) && this.kodama.length > 0 ? 1 : 0;
      st.vis += (target - st.vis) * k;
      if (animate && now > st.nextNod) {
        st.nodAt = now;
        st.nodDir = this.rand() > 0.5 ? 1 : -1;
        st.nodAmp = 0.09;
        st.nextNod = now + 7 + this.rand() * 12;
      }
    });
    const want = new Set(creatures);
    for (const id of new Set([...want, ...this.creatureVis.keys()])) {
      const v = this.creatureVis.get(id) ?? 0;
      const target = want.has(id) && this.creatures.has(id) ? 1 : 0;
      const nv = v + (target - v) * k;
      if (nv < 0.002 && target === 0) this.creatureVis.delete(id);
      else this.creatureVis.set(id, nv);
    }
  }

  busy(now: number): boolean {
    // Les hochements spontanés suivent la cadence courante (lents : 15–30 fps
    // suffisent) ; seuls un regard vers un pulse fort, une sortie ou le gardien
    // demandent 60 fps.
    return this.k.some((s) => (s.nodAmp > 0.1 && now - s.nodAt < NOD_STRONG) || now < s.peekUntil + 2) || this.guardianActive(now);
  }

  draws(now: number, night: number, fog: number, guardian: GuardianFrame): SpriteDraw[] {
    const out: SpriteDraw[] = [];
    this.spots.forEach((s, i) => {
      const st = this.k[i]!;
      const asset = this.kodama[i % Math.max(1, this.kodama.length)];
      if (!asset || st.vis < 0.01) return;
      const na = now - st.nodAt;
      const dur = st.nodAmp > 0.1 ? NOD_STRONG : NOD;
      const nod = na < dur ? Math.sin((na / dur) * Math.PI) * st.nodAmp * st.nodDir : 0;
      out.push({
        asset, x: s.x, y: s.y, depth: s.depth, h: s.scale ?? 0.05, rot: nod,
        alpha: st.vis, reveal: 1, glow: night * 0.55 * st.vis, glowColor: [0.75, 0.95, 0.85],
        fogMix: fog * (1 - s.depth) * 0.35,
      });
    });
    for (const [id, vis] of this.creatureVis) {
      const asset = this.creatures.get(id);
      const spot = this.creatureSpots[id];
      if (!asset || !spot) continue;
      out.push({
        asset, x: spot.x, y: spot.y, depth: spot.depth, h: spot.scale ?? 0.06, rot: 0,
        alpha: vis * 0.88, reveal: 1, glow: night * 0.15 * vis, glowColor: [0.7, 0.85, 0.8],
        fogMix: fog * (1 - spot.depth) * 0.45,
      });
    }
    if (guardian.active && this.guardian && guardian.reveal > 0.001) {
      const g = this.guardianSpot;
      out.push({
        asset: this.guardian, x: g.x, y: g.y, depth: g.depth, h: (g.scale ?? 0.4) * (1 + guardian.breathe * 0.004), rot: 0,
        alpha: 1, reveal: guardian.reveal, glow: 0.1 + night * 0.2 + (1 - guardian.reveal) * 0.5, glowColor: [0.82, 1.0, 0.86],
        fogMix: 0.18,
      });
    }
    return out;
  }

  /** Halos derrière les kodama la nuit (peints ou procéduraux). */
  emitHalos(out: BillboardWriter, t: number, night: number, atlas: FxAtlasMap | null) {
    if (night < 0.02) return;
    this.spots.forEach((s, i) => {
      const st = this.k[i]!;
      if (st.vis < 0.02) return;
      const h = s.scale ?? 0.05;
      const piece = atlas?.halos[i % Math.max(1, atlas.halos.length)];
      const breath = 0.85 + 0.15 * Math.sin(t * 0.8 + i * 2.1);
      const size = h * 2.4 * breath;
      out.push(s.x, s.y - h * 0.55, s.depth, size * (piece?.aspect ?? 1), size, 0, 0.62, 0.9, 0.8, 0.5 * night * st.vis, piece?.rect ?? GLOW);
    });
  }

  guardianBox(): [number, number, number, number] {
    const g = this.guardianSpot;
    const h = g.scale ?? 0.4;
    const asp = this.guardian?.aspect ?? 0.66;
    return [g.x, g.y, h * asp, h];
  }
}
