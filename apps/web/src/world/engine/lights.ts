/**
 * Lumières du jour : une orbe douce par tâche faite aujourd'hui, posée sur une
 * ancre stable (hachage de l'id → ancre + léger décalage), teintée selon qui.
 * `pulse` fait monter la lumière depuis un point de l'écran jusqu'à son ancre
 * (≈1,7 s, envol franc puis arc au-dessus de l'ancre, traînée et étincelles :
 * flight.ts). Une lumière retirée de l'état s'éteint en fondu.
 * Pulse fort (corvée) : lumière plus grande et plus chaude, vol et traînée plus
 * longs, petite pluie de lumière autour de l'ancre à l'atterrissage.
 */
import type { ScenePoint, WorldLight, Who } from '../types';
import { GLOW, type BillboardWriter } from './batch';
import { flightAt, bezierAt, flightEase, makeFlight, type FlightPath } from './flight';
import { hashString } from './noise';

export const WHO_COLORS: Record<Who, [number, number, number]> = {
  a: [0xc6 / 255, 0xd3 / 255, 0xe6 / 255],
  b: [0xeb / 255, 0xa1 / 255, 0x5a / 255],
  both: [0xe7 / 255, 0xc8 / 255, 0x7e / 255],
  unassigned: [0xb6 / 255, 0xc4 / 255, 0xbf / 255],
};

/** Pluie de lumière après l'atterrissage d'un pulse fort. */
const SHOWER = 2.4;
const SHOWER_SPARKS = 18;
const WARM: [number, number, number] = [1.0, 0.8, 0.5];
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
  flight: FlightPath | null;
  landedFlash: number;
  strong: boolean;
}

/** Étincelles semées le long du vol (elles s'attardent puis s'éteignent). */
const SPARKS = 7;
const SPARK_LIFE = 0.75;

export interface LandEvent {
  x: number;
  y: number;
  depth: number;
  strong: boolean;
}

export class DayLights {
  private lights = new Map<string, Light>();
  /**
   * Lumières attendues en vol (cochées depuis une feuille : le vol part à sa
   * fermeture) : `sync` ne les pose pas à leur ancre avant `pulse`, sinon on
   * les verrait s'allumer à leur place puis repartir d'en bas. Valeur :
   * échéance (secondes, horloge du moteur).
   */
  private reserved = new Map<string, number>();

  /** Réserve le vol de `id` jusqu'à `until` (voir `reserved`). */
  reserve(id: string, until: number) {
    if (!this.lights.has(id)) this.reserved.set(id, until);
  }

  /** Libère une réservation ; vrai si elle existait encore. */
  unreserve(id: string): boolean {
    return this.reserved.delete(id);
  }

  /** Vrai si `id` attend son vol (QA, tests). */
  isReserved(id: string, now: number): boolean {
    const until = this.reserved.get(id);
    return until !== undefined && until > now;
  }
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
      if (this.isReserved(l.id, now)) continue;
      this.reserved.delete(l.id);
      const a = this.anchorFor(l.id);
      this.lights.set(l.id, {
        id: l.id, who: l.who, ...a, phase: (hashString(l.id) % 1000) / 159,
        born: animate ? now : now - FADE_IN, dying: null, inState: true, flight: null, landedFlash: -10, strong: false,
      });
    }
    for (const cur of this.lights.values()) {
      if (!ids.has(cur.id) && cur.inState) {
        cur.inState = false;
        if (cur.dying === null) cur.dying = animate ? now : now - FADE_OUT;
      }
    }
  }

  pulse(id: string, who: Who, from: { x: number; y: number } | null, now: number, strong = false) {
    this.reserved.delete(id);
    const a = this.anchorFor(id);
    let l = this.lights.get(id);
    if (!l) {
      l = { id, who, ...a, phase: (hashString(id) % 1000) / 159, born: now, dying: null, inState: false, flight: null, landedFlash: -10, strong };
      this.lights.set(id, l);
    }
    l.who = who;
    l.strong = strong;
    l.dying = null;
    l.born = Math.min(l.born, now);
    const start = from ?? { x: a.x + 0.06, y: Math.min(1.05, a.y + 0.25) };
    const side = hashString(id) & 1 ? 1 : -1;
    l.flight = makeFlight(start, a, side, now, strong);
  }

  /** Position de la tête des lumières en vol (QA, regards des kodama). */
  flying(now: number): { id: string; x: number; y: number; k: number }[] {
    const out: { id: string; x: number; y: number; k: number }[] = [];
    for (const l of this.lights.values()) {
      if (!l.flight) continue;
      const p = flightAt(l.flight, now);
      out.push({ id: l.id, x: p.x, y: p.y, k: p.k });
    }
    return out;
  }

  /** Un vol est en cours (le moteur garde la scène animée jusqu'à l'atterrissage). */
  get inFlight(): boolean {
    for (const l of this.lights.values()) if (l.flight) return true;
    return false;
  }

  /** Vrai si une animation est en cours (vol, fondu). */
  busy(now: number): boolean {
    for (const l of this.lights.values()) {
      if (l.flight || l.dying !== null || now - l.born < FADE_IN || now - l.landedFlash < (l.strong ? SHOWER : 1.5)) return true;
    }
    return false;
  }

  update(now: number) {
    for (const l of this.lights.values()) {
      if (l.flight && now - l.flight.start >= l.flight.dur) {
        l.flight = null;
        l.landedFlash = now;
        this.landed.push({ x: l.x, y: l.y, depth: l.depth, strong: l.strong });
      }
      if (!l.inState && l.dying === null && !l.flight && now - l.landedFlash > ORPHAN) l.dying = now;
      if (l.dying !== null && now - l.dying > FADE_OUT) this.lights.delete(l.id);
    }
  }

  emit(out: BillboardWriter, now: number, t: number, night: number, intensity: number, aspect: number) {
    for (const l of this.lights.values()) {
      const base = WHO_COLORS[l.who];
      // Corvée : la teinte de la personne, réchauffée.
      const warm = l.strong ? 0.4 : 0;
      const r = base[0] + (WARM[0] - base[0]) * warm;
      const g = base[1] + (WARM[1] - base[1]) * warm;
      const b = base[2] + (WARM[2] - base[2]) * warm;
      const big = l.strong ? 1.45 : 1;
      let alpha = Math.min(1, (now - l.born) / FADE_IN);
      if (l.dying !== null) alpha *= Math.max(0, 1 - (now - l.dying) / FADE_OUT);
      const flick = 0.85 + 0.1 * Math.sin(t * 1.7 + l.phase) + 0.05 * Math.sin(t * 4.3 + l.phase * 2);
      const glowK = (0.75 + 0.35 * night) * intensity;
      if (l.flight) {
        this.emitFlight(out, l, l.flight, now, r, g, b, glowK, big);
        continue;
      }
      const hover = Math.sin(t * 0.6 + l.phase) * 0.004;
      const sway = Math.sin(t * 0.37 + l.phase * 1.3) * 0.003;
      const flash = Math.max(0, 1 - (now - l.landedFlash) / (l.strong ? 1.8 : 1.2));
      const x = l.x + sway;
      const y = l.y + hover;
      const s = 0.05 * (0.85 + 0.3 * l.depth) * (l.strong ? 1.15 : 1);
      // Halo large et doux + cœur.
      out.push(x, y, l.depth, s * 3.2, s * 3.2, 0, r, g, b, 0.38 * alpha * glowK * (1 + flash * 1.5), GLOW);
      out.push(x, y, l.depth, s, s, 0, r, g, b, alpha * flick * glowK * (1 + flash), GLOW);
      if (flash > 0) {
        const fs = s * 5 * (1.2 - flash * 0.4) * big;
        out.push(x, y, l.depth, fs, fs, 0, r, g, b, flash * 0.35 * glowK, GLOW);
      }
      if (l.strong) this.shower(out, l, now, r, g, b, glowK, aspect);
    }
  }

  /** Vol : tête lumineuse, traînée le long de la courbe, étincelles semées qui s'attardent. */
  private emitFlight(out: BillboardWriter, l: Light, f: FlightPath, now: number, r: number, g: number, b: number, glowK: number, big: number) {
    const k = Math.min(1, (now - f.start) / f.dur);
    // Traînée : positions passées le long de la courbe (plus longue si forte).
    const segs = l.strong ? 18 : 13;
    const step = l.strong ? 0.026 : 0.03;
    for (let i = segs - 1; i >= 0; i--) {
      const kk = Math.max(0, k - i * step);
      const e = flightEase(kk);
      const p = bezierAt(f, e);
      const d = 1 + (l.depth - 1) * e;
      const fade = 1 - i / segs;
      const s = (i === 0 ? 0.082 : 0.052 * fade) * (1.2 - 0.3 * e) * big;
      out.push(p.x, p.y, d, s, s, 0, r, g, b, (i === 0 ? 1.15 : 0.5 * fade * fade) * glowK, GLOW);
      // Cœur blanc de la tête : lisible même sur une peinture claire.
      if (i === 0) out.push(p.x, p.y, d, s * 0.38, s * 0.38, 0, 1, 0.98, 0.92, 0.9 * glowK, GLOW);
    }
    // Étincelles : posées au passage, elles tombent un peu en s'éteignant.
    const h = hashString(l.id);
    for (let j = 0; j < SPARKS; j++) {
      const at = (j + 0.5) / (SPARKS + 1);
      const age = (k - at) * f.dur;
      if (age <= 0 || age > SPARK_LIFE) continue;
      const p = bezierAt(f, flightEase(at));
      const u = ((h >>> (j * 3)) & 0xff) / 255;
      const a = (1 - age / SPARK_LIFE) * (0.55 + 0.35 * u);
      const sz = (0.014 + 0.008 * u) * big;
      out.push(p.x + (u - 0.5) * 0.02, p.y + age * 0.035, 1 + (l.depth - 1) * at, sz, sz, 0, r * 0.5 + 0.5, g * 0.5 + 0.48, b * 0.5 + 0.4, a * glowK, GLOW);
    }
  }

  /** Pluie de lumière : de petites étincelles descendent doucement autour de l'ancre. */
  private shower(out: BillboardWriter, l: Light, now: number, r: number, g: number, b: number, glowK: number, aspect: number) {
    const age = now - l.landedFlash;
    if (age < 0 || age > SHOWER) return;
    const h = hashString(l.id);
    for (let i = 0; i < SHOWER_SPARKS; i++) {
      const u1 = ((h >>> (i % 24)) & 0xff) / 255;
      const u2 = (((h * (i + 7)) >>> 8) & 0xff) / 255;
      const delay = (i / SHOWER_SPARKS) * 0.9;
      const k = (age - delay) / 1.5;
      if (k <= 0 || k >= 1) continue;
      const dx = ((u1 - 0.5) * 0.11 + Math.sin(k * 5 + i) * 0.006) / aspect;
      const y0 = l.y - 0.07 - u2 * 0.07;
      const y = y0 + k * (l.y - y0 + 0.01);
      const a = Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(age * 9 + i * 2.3));
      const sz = 0.016 + u2 * 0.008;
      out.push(l.x + dx, y, l.depth, sz, sz, 0, r * 0.5 + 0.5, g * 0.5 + 0.45, b * 0.5 + 0.3, a * glowK, GLOW);
    }
  }
}
