/**
 * Une Noiraude : son état et sa petite physique (aucun dessin ici).
 *
 * Coordonnées en px CSS du calque ; (x, y) est le point de contact au sol.
 * Commandes : placer, regarder, marcher vers, rebondir, trembler, s'enfuir,
 * dormir / se réveiller, se tenir debout, lever les bras (porter). Le calque
 * appelle `update` à chaque image ; le dessin lit les champs publics.
 */
import { VARIANTS } from './sprites';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type SusuwatariState = 'idle' | 'walk' | 'shiver' | 'flee' | 'sleep' | 'gone';
export type ArmPose = 'none' | 'up' | 'wave' | 'flail';
export type EyeMood = 'open' | 'happy' | 'closed' | 'wide';

export interface SusuwatariEnv {
  /** Horloge du calque (s). */
  time: number;
  reduced: boolean;
  /** Ce que tout le monde regarde (doigt, souris), sinon null. */
  gaze: Point | null;
  /** Zone visible du calque : au-delà, une Noiraude en fuite a disparu. */
  view: Rect;
}

export interface SusuwatariInit {
  x: number;
  y: number;
  /** Diamètre de la boule (px CSS, bout des poils). Défaut 44. */
  size?: number;
  seed?: number;
}

const GRAVITY = 2600;
let nextId = 1;

function hash(n: number): () => number {
  let a = (n * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt);

export class Susuwatari {
  readonly id = nextId++;
  readonly seed: number;
  readonly variant: number;
  readonly rand: () => number;
  x: number;
  y: number;
  size: number;
  /** Échelle de profondeur (posée par le calque). */
  k = 1;
  /** Hauteur au-dessus du sol (px, vers le haut) et vitesse verticale. */
  z = 0;
  vz = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  state: SusuwatariState = 'idle';
  /** Pattes et bras sortis (0–1), pose des bras. */
  legs = 0;
  arms = 0;
  armPose: ArmPose = 'none';
  /** Cycle de marche (tours) et inclinaison (rad). */
  step = 0;
  tilt = 0;
  /** Écrasement (+) / étirement (−) et sa vitesse (ressort). */
  squash = 0;
  squashV = 0;
  /** Tremblement : amplitude 0–1 et décalage courant (px). */
  shake = 0;
  jitterX = 0;
  jitterY = 0;
  /** Regard (vecteur −1…1) et paupières (0 ouvert, 1 fermé). */
  look: Point = { x: 0, y: -0.2 };
  blink = 0;
  eyes: EyeMood = 'open';
  /** Phase du frisottis (images de frange). */
  fur: number;
  /** Debout sans marcher (pattes sorties). */
  standing = false;
  /** Vit seule (promenades, sautillements) : voir behavior.ts. */
  autonomous = false;
  restUntil = 0;
  sleepUntil = 0;

  private lookGoal: Point = { x: 0, y: -0.2 };
  private lookPoint: Point | null = null;
  private nextSaccade = 0;
  private blinkAt: number;
  private blinkStart = -1;
  private blinkTwice = false;
  private goal: Point | null = null;
  private speed = 70;
  private onArrive: (() => void) | null = null;
  private hopAt = -1;
  private hopPower = 1;
  private landedAt = -1;
  private settleAt = 0;
  private shiverUntil = 0;
  private afterShiver: (() => void) | null = null;
  private onGone: (() => void) | null = null;
  private clock = 0;

  constructor(init: SusuwatariInit) {
    this.seed = init.seed ?? Math.floor(Math.random() * 1e9);
    this.rand = hash(this.seed);
    this.variant = this.seed % VARIANTS;
    this.x = init.x;
    this.y = init.y;
    this.size = init.size ?? 44;
    this.fur = this.rand() * 8;
    this.blinkAt = 1 + this.rand() * 4;
  }

  /** Diamètre affiché (profondeur comprise). */
  get scale(): number {
    return this.size * this.k;
  }

  /** Centre du corps (px CSS), là où il est dessiné. */
  body(): Point {
    const S = this.scale;
    const bob = this.state === 'walk' || this.state === 'flee' ? 0.035 * S * (0.5 - 0.5 * Math.cos(this.step * Math.PI * 4)) * this.legs : 0;
    return { x: this.x + this.jitterX, y: this.y - this.z - (0.42 + 0.22 * this.legs) * S - bob + this.jitterY };
  }

  place(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.goal = null;
    if (this.state === 'gone' || this.state === 'walk' || this.state === 'flee') this.state = 'idle';
    return this;
  }

  /** Regarde un point précis (null : regarde le doigt commun ou alentour). */
  lookAt(point: Point | null): this {
    this.lookPoint = point;
    return this;
  }

  walkTo(x: number, y: number, opts: { speed?: number; onArrive?: () => void } = {}): this {
    if (this.state === 'gone' || this.state === 'shiver') return this;
    this.wakeQuietly();
    this.goal = { x, y };
    this.speed = opts.speed ?? 70;
    this.onArrive = opts.onArrive ?? null;
    this.state = 'walk';
    return this;
  }

  /** Petit bond de joie (bras levés, yeux plissés). */
  bounce(power = 1): this {
    if (this.state === 'gone' || this.hopAt >= 0 || this.z > 0) return this;
    this.wakeQuietly();
    this.hopAt = this.clock + 0.09;
    this.hopPower = power;
    this.squashV += 2.2;
    this.armPose = 'up';
    return this;
  }

  /** Frémit (peur), puis `then` (ex. s'enfuir). */
  shiver(ms = 700, then?: () => void): this {
    if (this.state === 'gone') return this;
    this.wakeQuietly();
    this.state = 'shiver';
    this.goal = null;
    this.shiverUntil = this.clock + ms / 1000;
    this.afterShiver = then ?? null;
    this.eyes = 'wide';
    return this;
  }

  /** S'enfuit loin de `from` jusqu'au bord le plus proche, puis disparaît. */
  flee(from: Point, opts: { onGone?: () => void; view?: Rect } = {}): this {
    if (this.state === 'gone') return this;
    this.wakeQuietly();
    const dir = this.x === from.x ? (this.rand() < 0.5 ? -1 : 1) : Math.sign(this.x - from.x);
    const view = opts.view;
    const far = this.scale * 2;
    const x = view ? (dir < 0 ? view.left - far : view.right + far) : this.x + dir * 2000;
    this.goal = { x, y: this.y + (this.rand() - 0.5) * this.scale };
    this.speed = 260;
    this.state = 'flee';
    this.onGone = opts.onGone ?? null;
    this.armPose = 'flail';
    this.eyes = 'wide';
    this.lookPoint = null;
    return this;
  }

  sleep(seconds = Infinity): this {
    if (this.state === 'gone') return this;
    this.state = 'sleep';
    this.goal = null;
    this.eyes = 'closed';
    this.armPose = 'none';
    this.sleepUntil = this.clock + seconds;
    return this;
  }

  wake(): this {
    if (this.state !== 'sleep') return this;
    this.state = 'idle';
    this.eyes = 'open';
    this.squashV -= 1.5;
    return this;
  }

  stand(on = true): this {
    this.standing = on;
    return this;
  }

  /** Se dresse un instant sur ses pattes. */
  standFor(seconds: number): this {
    this.settleAt = Math.max(this.settleAt, this.clock + seconds);
    return this;
  }

  /** Bras : 'up' pour porter un kompeitō, 'wave' pour saluer. */
  setArms(pose: ArmPose): this {
    this.armPose = pose;
    return this;
  }

  /** Revient (après une fuite) : réapparaît en (x, y), au repos. */
  reappear(x: number, y: number): this {
    this.state = 'idle';
    this.eyes = 'open';
    this.armPose = 'none';
    this.shake = 0;
    return this.place(x, y);
  }

  private wakeQuietly(): void {
    if (this.state === 'sleep') {
      this.state = 'idle';
      this.eyes = 'open';
    }
  }

  update(dt: number, env: SusuwatariEnv): void {
    const t = env.time;
    this.clock = t;
    if (this.state === 'gone') return;
    const S = this.scale;
    const calm = env.reduced ? 0.55 : 1;

    // Bond : élan puis envol ; atterrissage → écrasement, pattes rentrées.
    if (this.hopAt >= 0 && t >= this.hopAt) {
      const h = S * (env.reduced ? 0.22 : 0.7) * this.hopPower;
      this.vz = Math.sqrt(2 * GRAVITY * h);
      this.hopAt = -1;
      this.squashV -= 3.5;
      if (!env.reduced) this.eyes = 'happy';
    }
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.squashV += Math.min(5, -this.vz / (S * 3.2));
        this.z = 0;
        this.vz = 0;
        this.landedAt = t;
      }
    }
    if (this.landedAt >= 0 && t - this.landedAt > 0.18) {
      this.landedAt = -1;
      if (this.eyes === 'happy') this.eyes = 'open';
      if (this.armPose === 'up' && this.state !== 'flee') this.armPose = 'none';
    }

    // Déplacement.
    let wantSpeed = 0;
    if ((this.state === 'walk' || this.state === 'flee') && this.goal) {
      const dx = this.goal.x - this.x;
      const dy = this.goal.y - this.y;
      const dist = Math.hypot(dx, dy);
      const speed = this.speed * (this.state === 'flee' ? (env.reduced ? 0.5 : 1) : calm);
      if (dist < 1.5) {
        this.vx = this.vy = 0;
        this.goal = null;
        if (this.state === 'walk') {
          this.state = 'idle';
          this.settleAt = t + 0.35 + this.rand() * 0.6;
          const done = this.onArrive;
          this.onArrive = null;
          done?.();
        }
      } else {
        wantSpeed = Math.min(speed, dist * 4 + 12);
        const ax = (dx / dist) * wantSpeed;
        const ay = (dy / dist) * wantSpeed;
        this.vx = approach(this.vx, ax, 9, dt);
        this.vy = approach(this.vy, ay, 9, dt);
      }
    } else {
      this.vx = approach(this.vx, 0, 12, dt);
      this.vy = approach(this.vy, 0, 12, dt);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const speedNow = Math.hypot(this.vx, this.vy);
    if (Math.abs(this.vx) > 6) this.facing = this.vx > 0 ? 1 : -1;

    if (this.state === 'flee') {
      const v = env.view;
      const out = this.x < v.left - S * 1.2 || this.x > v.right + S * 1.2 || !this.goal;
      if (out) {
        this.state = 'gone';
        this.goal = null;
        this.vx = this.vy = 0;
        const gone = this.onGone;
        this.onGone = null;
        gone?.();
        return;
      }
    }

    // Pattes : sorties pour marcher, sauter, se tenir debout ; rentrées au repos.
    const moving = this.state === 'walk' || this.state === 'flee' || speedNow > 8;
    const legsOut = moving || this.z > 0 || this.hopAt >= 0 || this.standing || t < this.settleAt;
    this.legs = approach(this.legs, legsOut ? 1 : 0, legsOut ? 10 : 5, dt);
    this.arms = approach(this.arms, this.armPose === 'none' ? 0 : 1, 9, dt);
    const stride = 0.22 * S;
    this.step += (dt * Math.max(speedNow, moving ? 20 : 0)) / (stride * 2);

    // Inclinaison vers l'avant en marchant, plus franche en fuite.
    const lean = Math.min(1, speedNow / 140) * (this.state === 'flee' ? 0.2 : 0.1) * calm;
    const sway = moving && !env.reduced ? Math.sin(this.step * Math.PI * 2) * 0.035 : 0;
    this.tilt = approach(this.tilt, this.facing * lean + sway, 8, dt);

    // Ressort d'écrasement (+ respiration).
    const breath = Math.sin(t * Math.PI * 2 * (this.state === 'sleep' ? 0.22 : 0.32) + this.fur) * (this.state === 'sleep' ? 0.03 : 0.012);
    const anticip = this.hopAt >= 0 ? 0.2 : 0;
    const acc = -420 * (this.squash - anticip - breath) - 18 * this.squashV;
    this.squashV += acc * dt;
    this.squash = Math.max(-0.3, Math.min(0.35, this.squash + this.squashV * dt));

    // Tremblement.
    if (this.state === 'shiver') {
      this.shake = approach(this.shake, 1, 14, dt);
      if (t >= this.shiverUntil) {
        this.state = 'idle';
        this.eyes = 'open';
        const then = this.afterShiver;
        this.afterShiver = null;
        then?.();
      }
    } else {
      this.shake = approach(this.shake, 0, 10, dt);
    }
    const amp = this.shake * S * (env.reduced ? 0.008 : 0.035);
    this.jitterX = amp * Math.sin(t * 83 + this.fur * 5);
    this.jitterY = amp * 0.5 * Math.sin(t * 71 + this.fur * 3);

    // Réveil programmé.
    if (this.state === 'sleep' && t >= this.sleepUntil) this.wake();

    // Frisottis : lent au repos, vif en marche, électrique quand elle a peur.
    const furRate = this.state === 'shiver' ? 9 : this.state === 'flee' ? 3 : moving ? 1.2 : 0.4;
    this.fur += dt * furRate * (env.reduced ? 0.5 : 1);

    this.updateEyes(dt, env);
  }

  private updateEyes(dt: number, env: SusuwatariEnv): void {
    const t = env.time;
    const target = this.lookPoint ?? (this.state === 'flee' ? null : env.gaze);
    if (this.state === 'flee') {
      this.lookGoal = { x: this.facing * 0.9, y: -0.1 };
    } else if (target) {
      const b = this.body();
      const dx = target.x - b.x;
      const dy = target.y - (b.y - 0.05 * this.scale);
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / (this.scale * 1.1));
      this.lookGoal = { x: (dx / d) * m, y: (dy / d) * m };
    } else if (t >= this.nextSaccade) {
      // Coups d'œil alentour, plutôt vers le haut (comme sur les peintures).
      this.lookGoal = { x: (this.rand() - 0.5) * 1.6, y: -0.15 - this.rand() * 0.6 + (this.rand() < 0.2 ? 0.7 : 0) };
      this.nextSaccade = t + 0.6 + this.rand() * 2.4;
    }
    this.look.x = approach(this.look.x, this.lookGoal.x, 16, dt);
    this.look.y = approach(this.look.y, this.lookGoal.y, 16, dt);

    // Clignements (parfois deux de suite).
    if (this.eyes === 'open' && this.blinkStart < 0 && t >= this.blinkAt) {
      this.blinkStart = t;
      this.blinkTwice = this.rand() < 0.22;
      this.blinkAt = t + 1.8 + this.rand() * 4.5;
    }
    if (this.blinkStart >= 0) {
      const u = (t - this.blinkStart) / 0.15;
      if (u >= 1) {
        if (this.blinkTwice) {
          this.blinkTwice = false;
          this.blinkStart = t + 0.06;
        } else this.blinkStart = -1;
        this.blink = 0;
      } else this.blink = u < 0 ? 0 : u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
    }
  }
}
