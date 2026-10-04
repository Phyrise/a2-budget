/**
 * Moteur du monde : cycle de vie, état, politique de rendu, entrées.
 *
 * Politique : 60 fps pendant 3 s après une interaction → 30 → 15 → gel à 45 s
 * (reprise au toucher / changement d'état) ; arrêt hors écran ou onglet caché ;
 * paliers de qualité automatiques ; « still » / bandeau = images uniques.
 * Lanterne allumée : jamais de gel (≥ 30 fps, 20 sur appareil lent).
 */
import { Renderer, type OGLRenderingContext } from 'ogl';
import type { GrowthStage, LutName, WorldManifest, WorldMotion, WorldState, WorldVariant, Who } from '../types';
import { FxSystem } from './fx';
import { computeFraming, framingFor, viewToScene, type Framing } from './framing';
import { bindEngineEvents } from './input';
import { Lantern } from './lantern';
import { DayLights } from './lights';
import { MOODS, cloneParams, type MoodParams } from './moods';
import { Pipeline } from './pipeline';
import { Resources, type StageTextures } from './resources';
import { SeasonFx } from './seasons';
import { Spirits } from './spirits';
import { renderWorld } from './frame';
import { loadSecondary } from './secondary';

export type QualitySetting = 'auto' | 0 | 1 | 2;

export interface EngineConfig {
  manifest: WorldManifest;
  variant: WorldVariant;
  motion: WorldMotion;
  live: boolean;
  quality?: QualitySetting;
  onFirstFrame?: () => void;
  onContextLost?: () => void;
}

export interface EngineStats {
  fps: number;
  frameMs: number;
  tier: number;
  targetFps: number;
  memoryMB: number;
  dpr: number;
  /** Images rendues depuis la création (mesure du débit réel). */
  frames: number;
}

export const DPR_CAPS = [1.5, 1.25, 1] as const;
const GROW_SECONDS = 3.6;
const LUT_SECONDS = 3;

export class WorldEngine {
  readonly gl: OGLRenderingContext;
  readonly renderer: Renderer;
  readonly res: Resources;
  readonly pipe: Pipeline;
  readonly spirits: Spirits;
  readonly lights: DayLights;
  readonly fx: FxSystem;
  readonly seasons = new SeasonFx();
  readonly lantern: Lantern;
  cfg: Required<Omit<EngineConfig, 'onFirstFrame' | 'onContextLost'>> & Pick<EngineConfig, 'onFirstFrame' | 'onContextLost'>;

  framing: Framing;
  cssW = 1;
  cssH = 1;
  dpr = 1;
  state: WorldState | null = null;
  stage: StageTextures | null = null;
  prev: StageTextures | null = null;
  growStart = -1;
  /** Durée de la dissolution en cours (courte en mode immobile). */
  growDur = GROW_SECONDS;
  mood: MoodParams = cloneParams(MOODS.peaceful);
  target: MoodParams = cloneParams(MOODS.peaceful);
  night = 0;
  lutA: LutName = 'peaceful';
  lutB: LutName = 'peaceful';
  lutStart = -10;
  /** Parallaxe (fraction de largeur de vue). */
  pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  t = 12;
  lastNow = 0;
  lastActivity = 0;
  gust = 0;
  rayBoost = 0;
  tier = 0;
  private ema = 16;
  private frames = 0;
  private slowFor = 0;
  private emaFrame = 0;
  private emaInterval = 16;
  private lastFrameAt = 0;
  private startAt = 0;
  private raf = 0;
  private visible = true;
  private destroyed = false;
  private lost = false;
  private firstFrame = false;
  private ready = false;
  private loadingStage: GrowthStage | null = null;
  readonly cleanups: (() => void)[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    cfg: EngineConfig,
  ) {
    this.cfg = { quality: 'auto', ...cfg };
    this.tier = typeof this.cfg.quality === 'number' ? this.cfg.quality : 0;
    this.renderer = new Renderer({
      canvas, alpha: false, depth: false, stencil: false, antialias: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'default', autoClear: false, dpr: 1,
    });
    this.gl = this.renderer.gl;
    if (!this.gl) throw new Error('WebGL indisponible');
    const m = cfg.manifest;
    this.res = new Resources(this.gl, m);
    const blank = this.res.texture(new Uint8Array([0, 0, 0, 0]), { w: 1, h: 1 });
    this.pipe = new Pipeline(this.gl, this.res.noise, blank, m.size.w / m.size.h, 1 / m.size.w);
    this.spirits = new Spirits(m.kodamaSpots, m.creatureSpots, m.guardianSpot);
    this.lights = new DayLights(m.anchors);
    this.fx = new FxSystem(m.size.w / m.size.h, m.lightSource);
    this.lantern = new Lantern(m.size.w / m.size.h);
    this.framing = computeFraming(1, 1, m.size.w, m.size.h);
    bindEngineEvents(this);
  }

  // ------------------------------------------------------------------ cycle de vie

  async init(state: WorldState): Promise<void> {
    this.state = state;
    const stage = clampStage(state.stage);
    this.applyMoodTarget(true);
    await this.res.loadMasks();
    if (this.destroyed) throw new Error('destroyed');
    const [st] = await Promise.all([
      this.res.loadStage(stage),
      this.res.loadForeground(),
      this.res.loadLut(this.lutB),
      state.paused ? this.res.loadLut('night') : Promise.resolve(null),
    ]);
    if (this.destroyed) throw new Error('destroyed');
    this.stage = st;
    this.lights.sync(state.lights, now(), false);
    this.ready = true;
    this.requestFrame(true);
    // Non bloquant : sprites, effets peints, LUT restantes.
    void loadSecondary(this).catch(() => {
      /* moteur détruit pendant le chargement */
    });
  }

  get isDestroyed() {
    return this.destroyed;
  }

  async syncCreatures() {
    const m = this.cfg.manifest;
    for (const id of this.state?.creatures ?? []) {
      if (this.spirits.creatures.has(id) || !m.creatureSpots[id] || !m.sprites.creatures[id]) continue;
      const a = await this.res.sprite(m.sprites.creatures[id]!);
      if (a && !this.destroyed) this.spirits.creatures.set(id, a);
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((f) => f());
    if (!this.lost) this.res.dispose();
  }

  get isLost() {
    return this.lost;
  }

  /** Perte du contexte WebGL : arrêt net, la vue recrée un moteur. */
  markLost() {
    this.lost = true;
    this.stop();
    this.cfg.onContextLost?.();
  }

  /** Onglet caché : plus aucune image. */
  halt() {
    this.stop();
  }

  // ------------------------------------------------------------------ état

  setState(s: WorldState) {
    const old = this.state;
    this.state = s;
    if (!this.ready) return;
    const animate = this.animated;
    if (!old || old.mood !== s.mood || old.paused !== s.paused) this.applyMoodTarget(false);
    this.lights.sync(s.lights, now(), animate || this.cfg.motion === 'still');
    if (clampStage(s.stage) !== this.stage?.stage) void this.changeStage(clampStage(s.stage));
    if (old?.creatures.join() !== s.creatures.join()) void this.syncCreatures().then(() => this.requestFrame(true));
    if (old && old.season !== s.season) this.requestFrame(true);
    this.requestFrame(true);
  }

  private applyMoodTarget(initial: boolean) {
    const s = this.state;
    if (!s) return;
    this.target = cloneParams(MOODS[s.mood]);
    const name: LutName = s.paused ? 'night' : s.mood;
    if (initial) {
      this.mood = cloneParams(this.target);
      this.night = s.paused ? 1 : 0;
      this.lutA = this.lutB = name;
      this.lutStart = -10;
      return;
    }
    if (name !== this.lutB) {
      const k = this.lutMix(now());
      if (k > 0.5) this.lutA = this.lutB;
      this.lutB = name;
      this.lutStart = now();
      void this.res.loadLut(name).then(() => this.requestFrame(true));
    }
  }

  lutMix(n: number): number {
    const dur = this.animated ? LUT_SECONDS : this.cfg.motion === 'still' && this.cfg.live ? 0.6 : 0;
    if (dur === 0) return 1;
    const k = Math.min(1, Math.max(0, (n - this.lutStart) / dur));
    return k * k * (3 - 2 * k);
  }

  private async changeStage(stage: GrowthStage) {
    if (this.loadingStage === stage) return;
    this.loadingStage = stage;
    try {
      const st = await this.res.loadStage(stage);
      if (this.destroyed || this.loadingStage !== stage) {
        this.res.free(st.color);
        this.res.free(st.depth);
        return;
      }
      this.disposePrev();
      const smooth = this.animated || (this.cfg.motion === 'still' && this.cfg.live);
      if (smooth && this.stage) {
        this.prev = this.stage;
        this.growStart = now();
        this.growDur = this.animated ? GROW_SECONDS : 0.7;
      } else if (this.stage) {
        this.res.free(this.stage.color);
        this.res.free(this.stage.depth);
      }
      this.stage = st;
      this.requestFrame(true);
    } catch {
      /* échec de chargement : on garde le stade affiché */
    } finally {
      if (this.loadingStage === stage) this.loadingStage = null;
    }
  }

  disposePrev() {
    if (!this.prev) return;
    this.res.free(this.prev.color);
    this.res.free(this.prev.depth);
    this.prev = null;
    this.growStart = -1;
  }

  // ------------------------------------------------------------------ commandes

  pulse(opts: { id: string; who: Who; fromClientX?: number; fromClientY?: number; strong?: boolean }) {
    let from: { x: number; y: number } | null = null;
    if (opts.fromClientX !== undefined && opts.fromClientY !== undefined) {
      const r = this.canvas.getBoundingClientRect();
      from = viewToScene(this.framing, opts.fromClientX - r.left, opts.fromClientY - r.top);
      // Hors du cadre (la case est sous la scène) : on part juste sous le bord bas.
      from.y = Math.min(from.y, this.framing.cy + this.framing.vh * 0.62);
    }
    const n = now();
    if (this.animated) this.lights.pulse(opts.id, opts.who, from, n, opts.strong === true);
    else this.lights.sync([...(this.state?.lights ?? []).filter((l) => l.id !== opts.id), { id: opts.id, who: opts.who }], n, this.cfg.motion === 'still');
    this.requestFrame(true);
  }

  /** Lanterne : progression 0..1 (null = extinction en fondu). Réveille le rendu. */
  focus(progress: number | null, who?: Who) {
    this.lantern.set(progress, who, now());
    this.requestFrame(true);
  }

  playGuardian() {
    if (!this.ready) return;
    const n = now();
    this.spirits.startGuardian(n);
    const url = this.cfg.manifest.sprites.guardian;
    if (url && !this.spirits.guardian) {
      void this.res.sprite(url).then((a) => {
        if (a && !this.destroyed) this.spirits.guardian = a;
      });
    }
    this.requestFrame(true);
  }

  /** Libère le sprite du gardien une fois la séquence terminée. */
  releaseGuardian() {
    if (this.spirits.guardian) {
      this.res.free(this.spirits.guardian.tex);
      this.spirits.guardian = null;
    }
  }

  configure(p: Partial<Pick<EngineConfig, 'variant' | 'motion' | 'live' | 'quality'>>) {
    const prevQ = this.cfg.quality;
    const prevV = this.cfg.variant;
    Object.assign(this.cfg, p);
    if (p.quality !== undefined && p.quality !== prevQ) this.tier = typeof p.quality === 'number' ? p.quality : 0;
    if (this.cfg.quality !== prevQ || this.cfg.variant !== prevV) this.applySize();
    this.requestFrame(true);
  }

  resize(w: number, h: number) {
    this.cssW = Math.max(1, Math.round(w));
    this.cssH = Math.max(1, Math.round(h));
    this.applySize();
    this.requestFrame(true);
  }

  private applySize() {
    const m = this.cfg.manifest;
    const dev = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    this.dpr = Math.min(dev, DPR_CAPS[this.tier] ?? 1);
    this.renderer.dpr = this.dpr;
    this.renderer.setSize(this.cssW, this.cssH);
    this.framing = framingFor(this.cfg.variant, this.cssW, this.cssH, m.size);
    this.pipe.resizeTarget(Math.round(this.cssW * this.dpr), Math.round(this.cssH * this.dpr));
  }

  setVisible(v: boolean) {
    this.visible = v;
    if (v) this.requestFrame(true);
    else this.stop();
  }

  // ------------------------------------------------------------------ boucle

  /** Animation continue autorisée (hero / backdrop vivants, mouvement non immobile). */
  get animated(): boolean {
    return this.cfg.live && this.cfg.variant !== 'banner' && this.cfg.motion !== 'still';
  }

  get canRun(): boolean {
    return this.ready && !this.destroyed && !this.lost && this.visible && !document.hidden;
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Demande une image ; `activity` relance la politique 60 fps. */
  requestFrame(activity: boolean) {
    const n = now();
    if (activity) this.lastActivity = n;
    if (!this.canRun || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  targetFps(n: number, busy: boolean): number {
    if (!this.animated) return busy ? 60 : 0;
    const idle = n - this.lastActivity;
    if (busy || idle < 3) return 60;
    // Lanterne allumée : la scène ne se fige jamais, coût plafonné.
    const floor = this.lantern.active ? (this.tier > 0 ? 20 : 30) : 0;
    if (idle < 15) return 30;
    if (idle < 45) return Math.max(15, floor);
    return floor;
  }

  private tick = (ts: number) => {
    this.raf = 0;
    if (!this.canRun) return;
    const n = ts / 1000;
    const busy = this.isBusy(n);
    const fps = this.targetFps(n, busy);
    const due = !this.lastFrameAt || n - this.lastFrameAt >= 1 / Math.max(1, fps) - 0.004;
    if (due || !this.firstFrame || fps === 0) {
      this.renderOnce(n, fps);
      if (fps === 60 && this.lastFrameAt) this.trackQuality(n - this.lastFrameAt);
      this.lastFrameAt = n;
    }
    // Images uniques : on continue seulement tant qu'une transition est en cours.
    if (fps > 0 && (this.animated || this.isBusy(n))) this.raf = requestAnimationFrame(this.tick);
  };

  private isBusy(n: number): boolean {
    const transitions =
      this.growStart >= 0 || this.lutMix(n) < 1 || this.lights.busy(n) || this.gust > 0.02 || this.rayBoost > 0.02 || this.lantern.busy(n);
    if (!this.animated) return transitions && this.cfg.motion === 'still' && this.cfg.live;
    return transitions || this.spirits.busy(n) || this.seasons.busy(n) || Math.abs(this.pointer.tx - this.pointer.x) + Math.abs(this.pointer.ty - this.pointer.y) > 1e-4;
  }

  private renderOnce(n: number, fps: number) {
    const t0 = performance.now();
    const dt = this.lastNow ? Math.min(0.1, Math.max(0, n - this.lastNow)) : 0;
    this.lastNow = n;
    renderWorld(this, n, dt, fps);
    this.frames++;
    this.emaFrame += (performance.now() - t0 - this.emaFrame) * 0.1;
    if (!this.firstFrame) {
      this.firstFrame = true;
      // Laisse le compositeur afficher l'image avant le fondu enchaîné.
      requestAnimationFrame(() => this.cfg.onFirstFrame?.());
    }
  }

  private trackQuality(interval: number) {
    this.emaInterval += (interval * 1000 - this.emaInterval) * 0.1;
    if (!this.startAt) this.startAt = this.lastNow;
    if (this.cfg.quality !== 'auto' || this.tier >= 2 || this.lastNow - this.startAt < 3) return;
    this.ema = this.emaInterval;
    if (this.ema > 24) this.slowFor += interval;
    else this.slowFor = Math.max(0, this.slowFor - interval);
    if (this.slowFor > 1.5) {
      this.tier++;
      this.slowFor = 0;
      this.applySize();
    }
  }

  stats(): EngineStats {
    return {
      fps: 1000 / Math.max(1, this.emaInterval), frameMs: this.emaFrame, tier: this.tier,
      targetFps: this.targetFps(now(), this.isBusy(now())), memoryMB: this.res.memoryMB, dpr: this.dpr,
      frames: this.frames,
    };
  }
}

export function clampStage(s: number): GrowthStage {
  return Math.min(7, Math.max(1, Math.round(s))) as GrowthStage;
}

export const now = () => performance.now() / 1000;
