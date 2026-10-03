/**
 * Effets peints animés (quads additifs) : nappes de brume qui dérivent,
 * rayons obliques qui pulsent, aiguilles de cèdre qui tombent en tournoyant au
 * souffle d'un pulse, gouttes qui perlent (quiet). Replis procéduraux quand
 * l'atlas est absent (gouttes en traits ; brume et rayons restent dans la
 * passe principale).
 */
import { STREAK, type BillboardWriter } from './batch';
import type { FxAtlasMap } from './atlas';
import type { MoodParams } from './moods';
import { rng } from './noise';

interface Needle {
  x: number;
  y: number;
  depth: number;
  vx: number;
  spin: number;
  rot: number;
  born: number;
  life: number;
  piece: number;
  size: number;
}

interface Drip {
  x: number;
  y: number;
  depth: number;
  born: number;
  hang: number;
  piece: number;
  size: number;
}

export class FxSystem {
  atlas: FxAtlasMap | null = null;
  private needles: Needle[] = [];
  private drips: Drip[] = [];
  private nextDrip = 0;
  private nextNeedle = 8;
  private readonly rand = rng(777);

  constructor(
    private readonly aspect: number,
    private readonly light: { x: number; y: number },
  ) {}

  get hasFog() {
    return (this.atlas?.fog.length ?? 0) > 0;
  }

  get hasRays() {
    return (this.atlas?.rays.length ?? 0) > 0;
  }

  /** Souffle : quelques aiguilles se détachent de la canopée. */
  gust(now: number, strength = 1) {
    if (!this.atlas || this.atlas.needles.length === 0) return;
    const n = Math.round(2 + this.rand() * 3 * strength);
    for (let i = 0; i < n; i++) this.spawnNeedle(now + this.rand() * 0.8);
  }

  private spawnNeedle(at: number) {
    if (this.needles.length > 14 || !this.atlas) return;
    this.needles.push({
      x: 0.36 + this.rand() * 0.32,
      y: 0.06 + this.rand() * 0.22,
      depth: 0.45 + this.rand() * 0.4,
      vx: (this.rand() - 0.3) * 0.02,
      spin: (this.rand() - 0.5) * 2.4,
      rot: this.rand() * Math.PI * 2,
      born: at,
      life: 6 + this.rand() * 3,
      piece: Math.floor(this.rand() * this.atlas.needles.length),
      size: 0.028 + this.rand() * 0.02,
    });
  }

  busy(): boolean {
    return this.needles.length > 0 || this.drips.length > 0;
  }

  update(now: number, mood: MoodParams, animate: boolean) {
    if (!animate) {
      this.needles = [];
      this.drips = [];
      return;
    }
    this.needles = this.needles.filter((n) => now - n.born < n.life);
    this.drips = this.drips.filter((d) => now - d.born < d.hang + 2.2);
    if (mood.drips > 0.05 && now > this.nextDrip && this.drips.length < 6) {
      const pieces = this.atlas?.drips.length ?? 0;
      this.drips.push({
        x: 0.08 + this.rand() * 0.84,
        y: 0.1 + this.rand() * 0.42,
        depth: 0.5 + this.rand() * 0.45,
        born: now,
        hang: 0.8 + this.rand() * 1.6,
        piece: pieces > 0 ? Math.floor(this.rand() * pieces) : -1,
        size: 0.018 + this.rand() * 0.014,
      });
      this.nextDrip = now + (1.2 + this.rand() * 2.2) / Math.max(0.1, mood.drips);
    }
    if (mood.rays > 0.5 && now > this.nextNeedle) {
      this.spawnNeedle(now);
      this.nextNeedle = now + 14 + this.rand() * 16;
    }
  }

  /**
   * Effets « dans la scène » (étalonnés avec la peinture) : brume, rayons
   * peints, aiguilles, gouttes.
   */
  emit(out: BillboardWriter, now: number, t: number, mood: MoodParams, night: number, rayAngles: number[], rayBoost: number, fogGlow: number) {
    const a = this.atlas;
    const aspect = this.aspect;
    if (a && a.fog.length > 0) {
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const piece = a.fog[i % a.fog.length]!;
        const speed = (0.004 + i * 0.0015) * (i % 2 ? -1 : 1);
        const span = 1.8;
        const x = ((((i * 0.37 + t * speed) % span) + span) % span) - 0.4;
        const y = 0.42 + i * 0.075 - mood.fogLift * 0.12 + Math.sin(t * 0.05 + i) * 0.01;
        const h = 0.16 + (i % 3) * 0.04;
        const w = h * piece.aspect * 1.6;
        const alpha = (0.05 + 0.15 * mood.fog) * (1 - night * 0.35) * (1 + fogGlow * 1.6) * (1 - 0.3 * mood.fogLift * (i < 2 ? 1 : 0));
        out.push(x, y, 0.22 + i * 0.09, w, h, 0, 0.85, 0.9, 0.9, alpha, piece.rect);
      }
    }
    if (a && a.rays.length > 0) {
      const mirror = this.light.x > 0.5 ? -1 : 1;
      const weights = [mood.ray0, mood.ray1, mood.ray2, mood.ray3];
      for (let i = 0; i < 4; i++) {
        const wgt = weights[i]! * (mood.rays + rayBoost) * (1 - night);
        if (wgt < 0.01) continue;
        const piece = a.rays[i % a.rays.length]!;
        const pulse = 0.78 + 0.22 * Math.sin(t * 0.42 + i * 1.9) * Math.sin(t * 0.13 + i);
        const h = 0.55 + i * 0.06;
        const w = h * piece.aspect;
        const rot = (rayAngles[i] ?? 0) * 0.8 * -mirror;
        // L'origine lumineuse de la pièce est vers son coin haut (gauche).
        const ox = (0.5 - 0.12) * w * mirror;
        const oy = (0.5 - 0.06) * h;
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const cx = this.light.x + (c * ox - s * oy) / aspect;
        const cy = this.light.y + (s * ox + c * oy);
        out.push(cx, cy, 0.3, w * mirror, h, rot, 1, 0.94, 0.8, 0.13 * wgt * pulse, piece.rect);
      }
    }
    if (a) {
      for (const n of this.needles) {
        const age = now - n.born;
        if (age < 0) continue;
        const piece = a.needles[n.piece % a.needles.length]!;
        const fall = age * 0.045;
        const x = n.x + n.vx * age + Math.sin(age * 1.3 + n.rot) * 0.018;
        const y = n.y + fall + Math.sin(age * 2.1) * 0.004;
        const alpha = Math.min(1, age * 2) * Math.min(1, (n.life - age) / 1.5) * (1 - night * 0.6);
        const h = n.size;
        out.push(x, y, n.depth, h * piece.aspect, h, n.rot + age * n.spin + Math.sin(age * 1.7) * 0.6, 1, 1, 1, 0.85 * alpha, piece.rect);
      }
    }
    for (const d of this.drips) {
      const age = now - d.born;
      const form = Math.min(1, age / 0.9);
      const fallT = Math.max(0, age - d.hang);
      const y = d.y + 0.5 * 0.55 * fallT * fallT;
      const alpha = form * Math.max(0, 1 - fallT / 0.9) * (0.65 + 0.35 * mood.sparkle);
      const glint = 0.75 + 0.25 * Math.sin(t * 5 + d.x * 40);
      const piece = a && d.piece >= 0 ? a.drips[d.piece % a.drips.length] : undefined;
      if (piece) {
        const h = d.size * (0.6 + 0.4 * form) * 2.2;
        out.push(d.x, y + h * 0.5, d.depth, h * piece.aspect, h, 0, 0.9, 0.95, 1, alpha * glint, piece.rect);
      } else {
        const h = d.size * (0.5 + 0.5 * form) * (1 + fallT * 2);
        out.push(d.x, y, d.depth, h * 0.22, h, 0, 0.8, 0.88, 0.92, alpha * glint * 0.55, STREAK);
      }
    }
  }
}
