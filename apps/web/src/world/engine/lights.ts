/**
 * Lumières du jour : une orbe douce par tâche faite aujourd'hui, posée sur une
 * ancre stable (hachage de l'id → ancre + léger décalage), teintée selon qui.
 * `pulse` fait monter la lumière depuis un point de l'écran jusqu'à son ancre
 * (≈1,6 s, courbe, traînée). Une lumière retirée de l'état s'éteint en fondu.
 */
import type { ScenePoint, WorldLight, Who } from '../types';
import { GLOW, type BillboardWriter } from './batch';
import { hashString } from './noise';

export const WHO_COLORS: Record<Who, [number, number, number]> = {
  a: [0xc6 / 255, 0xd3 / 255, 0xe6 / 255],
  b: [0xeb / 255, 0xa1 / 255, 0x5a / 255],
  both: [0xe7 / 255, 0xc8 / 255, 0x7e / 255],
  unassigned: [0xb6 / 255, 0xc4 / 255, 0xbf / 255],
};

const FLIGHT = 1.6;
const FADE_IN = 1.4;
const FADE_OUT = 1.6;
/** Une lumière lancée par pulse mais absente de l'état s'éteint après ce délai. */
const ORPHAN = 5;

interface Light {
  id: string;
  who: Who;
  x: number;
  y: number;
  depth: number;
  phase: number;
  born: number;
  /** Instant de début d'extinction (null = allumée). */
  dying: number | null;
  inState: boolean;
  flight: { sx: number; sy: number; cx: number; cy: number; start: number } | null;
  landedFlash: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface LandEvent {
  x: number;
  y: number;
  depth: number;
}

export class DayLights {
  private lights = new Map<string, Light>();
  /** Atterrissages récents (souffle, éclat de rayon, kodama qui tourne la tête). */
  readonly landed: LandEvent[] = [];

  constructor(private readonly anchors: ScenePoint[]) {}

  anchorFor(id: string): { x: number; y: number; depth: number } {
    const fallback: ScenePoint = { x: 0.5, y: 0.75, depth: 0.7 };
    const list = this.anchors.length > 0 ? this.anchors : [fallback];
    const h = hashString(id);
    const a = list[h % list.length]!;
    const h2 = hashString(`${id}~`);
    const ang = ((h2 & 0xffff) / 0xffff) * Math.PI * 2;
    const rad = 0.012 + (((h2 >>> 16) & 0xff) / 255) * 0.026;
    return { x: a.x + Math.cos(ang) * rad * 0.9, y: a.y + Math.sin(ang) * rad * 0.6, depth: a.depth };
  }

  get size() {
    return this.lights.size;
  }

  /** Aligne les lumières sur l'état (nouvelles : fondu ; disparues : extinction). */
  sync(list: WorldLight[], now: number, animate: boolean) {
    const ids = new Set(list.map((l) => l.id));
    for (const l of list) {
      const cur = this.lights.get(l.id);
      if (cur) {
        cur.inState = true;
        cur.who = l.who;
        if (cur.dying !== null) cur.dying = null;
        continue;
      }
      const a = this.anchorFor(l.id);
      this.lights.set(l.id, {
        id: l.id, who: l.who, ...a, phase: (hashString(l.id) % 1000) / 159,
        born: animate ? now : now - FADE_IN, dying: null, inState: true, flight: null, landedFlash: -10,
      });
    }
    for (const cur of this.lights.values()) {
      if (!ids.has(cur.id) && cur.inState) {
        cur.inState = false;
        if (cur.dying === null) cur.dying = animate ? now : now - FADE_OUT;
      }
    }
  }

  pulse(id: string, who: Who, from: { x: number; y: number } | null, now: number) {
    const a = this.anchorFor(id);
    let l = this.lights.get(id);
    if (!l) {
      l = { id, who, ...a, phase: (hashString(id) % 1000) / 159, born: now, dying: null, inState: false, flight: null, landedFlash: -10 };
      this.lights.set(id, l);
    }
    l.who = who;
    l.dying = null;
    l.born = Math.min(l.born, now);
    const sx = from ? from.x : a.x + 0.06;
    const sy = from ? from.y : Math.min(1.05, a.y + 0.25);
    const side = (hashString(id) & 1 ? 1 : -1) * 0.08;
    l.flight = { sx, sy, cx: (sx + a.x) / 2 + side, cy: Math.min(sy, a.y) - 0.16, start: now };
  }

  /** Vrai si une animation est en cours (vol, fondu). */
  busy(now: number): boolean {
    for (const l of this.lights.values()) {
      if (l.flight || l.dying !== null || now - l.born < FADE_IN || now - l.landedFlash < 1.5) return true;
    }
    return false;
  }

  update(now: number) {
    for (const l of this.lights.values()) {
      if (l.flight && now - l.flight.start >= FLIGHT) {
        l.flight = null;
        l.landedFlash = now;
        this.landed.push({ x: l.x, y: l.y, depth: l.depth });
      }
      if (!l.inState && l.dying === null && !l.flight && now - l.landedFlash > ORPHAN) l.dying = now;
      if (l.dying !== null && now - l.dying > FADE_OUT) this.lights.delete(l.id);
    }
  }

  emit(out: BillboardWriter, now: number, t: number, night: number, intensity: number) {
    for (const l of this.lights.values()) {
      const [r, g, b] = WHO_COLORS[l.who];
      let alpha = Math.min(1, (now - l.born) / FADE_IN);
      if (l.dying !== null) alpha *= Math.max(0, 1 - (now - l.dying) / FADE_OUT);
      const flick = 0.85 + 0.1 * Math.sin(t * 1.7 + l.phase) + 0.05 * Math.sin(t * 4.3 + l.phase * 2);
      const glowK = (0.75 + 0.35 * night) * intensity;
      if (l.flight) {
        const k = Math.min(1, (now - l.flight.start) / FLIGHT);
        // Traînée : positions passées le long de la courbe.
        const f = l.flight;
        for (let i = 9; i >= 0; i--) {
          const kk = Math.max(0, k - i * 0.035);
          const e = easeInOut(kk);
          const u = 1 - e;
          const x = u * u * f.sx + 2 * u * e * f.cx + e * e * l.x;
          const y = u * u * f.sy + 2 * u * e * f.cy + e * e * l.y;
          const d = 1 + (l.depth - 1) * e;
          const fade = 1 - i / 10;
          const s = (i === 0 ? 0.075 : 0.05 * fade) * (1.25 - 0.35 * e);
          out.push(x, y, d, s, s, 0, r, g, b, (i === 0 ? 1 : 0.4 * fade * fade) * glowK, GLOW);
        }
        continue;
      }
      const hover = Math.sin(t * 0.6 + l.phase) * 0.004;
      const sway = Math.sin(t * 0.37 + l.phase * 1.3) * 0.003;
      const flash = Math.max(0, 1 - (now - l.landedFlash) / 1.2);
      const x = l.x + sway;
      const y = l.y + hover;
      const s = 0.05 * (0.85 + 0.3 * l.depth);
      // Halo large et doux + cœur.
      out.push(x, y, l.depth, s * 3.2, s * 3.2, 0, r, g, b, 0.38 * alpha * glowK * (1 + flash * 1.5), GLOW);
      out.push(x, y, l.depth, s, s, 0, r, g, b, alpha * flick * glowK * (1 + flash), GLOW);
      if (flash > 0) out.push(x, y, l.depth, s * 5 * (1.2 - flash * 0.4), s * 5 * (1.2 - flash * 0.4), 0, r, g, b, flash * 0.35 * glowK, GLOW);
    }
  }
}
