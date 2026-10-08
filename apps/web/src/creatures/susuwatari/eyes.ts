/**
 * Regard et clignements d'une Noiraude : les pupilles suivent un point
 * précis (`lookAt`), sinon le doigt commun du calque, sinon de petits coups
 * d'œil alentour (plutôt vers le haut) ; clignements de temps en temps,
 * parfois deux de suite. Appelé par `Susuwatari.update` à chaque image.
 */
import type { Susuwatari } from './creature';
import type { Point, SusuwatariEnv } from './types';

/** Suivi interne du regard (champs de travail, pas une commande). */
export interface EyeTrack {
  goal: Point;
  /** Point regardé (`lookAt`), sinon null. */
  point: Point | null;
  nextSaccade: number;
  blinkAt: number;
  blinkStart: number;
  blinkTwice: boolean;
}

export function eyeTrack(firstBlink: number): EyeTrack {
  return { goal: { x: 0, y: -0.2 }, point: null, nextSaccade: 0, blinkAt: firstBlink, blinkStart: -1, blinkTwice: false };
}

const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt);

export function updateEyes(s: Susuwatari, dt: number, env: SusuwatariEnv): void {
  const t = env.time;
  const e = s.eyeTrack;
  const target = e.point ?? (s.state === 'flee' ? null : env.gaze);
  if (s.state === 'flee') {
    e.goal = { x: s.facing * 0.9, y: -0.1 };
  } else if (target) {
    const b = s.body();
    const dx = target.x - b.x;
    const dy = target.y - (b.y - 0.05 * s.scale);
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(1, d / (s.scale * 1.1));
    e.goal = { x: (dx / d) * m, y: (dy / d) * m };
  } else if (t >= e.nextSaccade) {
    // Coups d'œil alentour, plutôt vers le haut (comme sur les peintures).
    e.goal = { x: (s.rand() - 0.5) * 1.6, y: -0.15 - s.rand() * 0.6 + (s.rand() < 0.2 ? 0.7 : 0) };
    e.nextSaccade = t + 0.6 + s.rand() * 2.4;
  }
  s.look.x = approach(s.look.x, e.goal.x, 16, dt);
  s.look.y = approach(s.look.y, e.goal.y, 16, dt);

  // Clignements (parfois deux de suite).
  if (s.eyes === 'open' && e.blinkStart < 0 && t >= e.blinkAt && s.rig.blink > 0) {
    e.blinkStart = t;
    e.blinkTwice = s.rand() < 0.22;
    e.blinkAt = t + (1.8 + s.rand() * 4.5) / s.rig.blink;
  }
  if (e.blinkStart >= 0) {
    const u = (t - e.blinkStart) / 0.15;
    if (u >= 1) {
      if (e.blinkTwice) {
        e.blinkTwice = false;
        e.blinkStart = t + 0.06;
      } else e.blinkStart = -1;
      s.blink = 0;
    } else s.blink = u < 0 ? 0 : u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
  }
}
