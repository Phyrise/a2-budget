/**
 * Calque de Noiraudes : UNE toile pour toutes (pas un élément DOM par
 * Noiraude), sa boucle d'animation et son cache de sprites.
 *
 * - Densité réelle de l'écran (devicePixelRatio, plafonnée à 3) ; la toile
 *   suit sa taille CSS (ResizeObserver). Garde-fou : si l'appareil peine
 *   (moins de ~45 i/s soutenus), la densité descend à 2 puis 1,5.
 * - Boucle en pause quand l'onglet est caché ou le calque `paused`.
 * - prefers-reduced-motion (suivi en direct) : mouvements calmes.
 * - `night` : seuls les yeux restent visibles ; `setCalm` : calme forcé
 *   (forêt « immobile »), comme prefers-reduced-motion.
 * - `drawUnder` / `drawOver` : ce que l'écran dessine sous et sur les
 *   Noiraudes (kompeitō au sol, objets portés), sur la même toile.
 * - `idleWhenEmpty` : sans Noiraude (ni `keepAwake`), la boucle s'arrête ;
 *   `spawn` ou `wake` la relancent.
 * - Profondeur : `depth(y)` réduit un peu celles qui sont loin (haut de zone).
 * - Apparence : `params` (SootSpriteParams) ; `setParams` la change en direct :
 *   membres, yeux et tempo tout de suite, sprites reconstruits dès l'image
 *   suivante (les anciens servent en attendant). Pendant un glissé de curseur,
 *   une reconstruction en cours n'est relancée qu'une fois finie (ou après
 *   REBUILD_MS) : l'aperçu suit le doigt sans mettre la page à genoux.
 *
 * Usage :
 *   const layer = createSusuwatariLayer(canvas, { rim: 1 });
 *   const s = layer.spawn({ x: 120, y: 300, size: 44 });
 *   s.walkTo(220, 320); layer.setGaze({ x, y }); layer.hitTest(x, y)?.bounce();
 */
import { live } from './behavior';
import { SpriteCache } from './cache';
import { Susuwatari, type Point, type Rect, type SusuwatariEnv, type SusuwatariInit } from './creature';
import { drawSusuwatari } from './draw';
import { DEFAULT_SOOT_PARAMS, rigOf, type SootSpriteParams } from './params';

export interface SusuwatariLayerOptions {
  /** Plafond de densité (défaut 3). */
  maxDpr?: number;
  /** Baisse la densité si l'appareil peine (défaut true). */
  adaptive?: boolean;
  /** Lueur des pointes et halo pour les fonds sombres (0–1, défaut 0). */
  rim?: number;
  /** Opacité de l'ombre au sol (défaut 1, 0 : aucune). */
  shadow?: number;
  /** Zone de promenade des Noiraudes autonomes (défaut : toute la toile, marges). */
  area?: (width: number, height: number) => Rect;
  /** Échelle de profondeur selon y (défaut : 1). */
  depth?: (y: number, height: number) => number;
  /** Appelé à chaque image après la mise à jour (chef d'orchestre). */
  onFrame?: (dt: number, time: number) => void;
  /** Apparence (défaut : le modèle visé, DEFAULT_SOOT_PARAMS). */
  params?: SootSpriteParams;
  /** Dessiné avant les Noiraudes / après elles (toile en px appareil, `dpr`). */
  drawUnder?: (ctx: CanvasRenderingContext2D, dpr: number, time: number) => void;
  drawOver?: (ctx: CanvasRenderingContext2D, dpr: number, time: number) => void;
  /** Boucle arrêtée quand il n'y a personne (défaut false). */
  idleWhenEmpty?: boolean;
  /** Garde la boucle en marche malgré tout (ex. un kompeitō au sol). */
  keepAwake?: () => boolean;
}

export interface SusuwatariLayer {
  readonly creatures: readonly Susuwatari[];
  readonly width: number;
  readonly height: number;
  spawn(init: SusuwatariInit): Susuwatari;
  remove(s: Susuwatari): void;
  clear(): void;
  setGaze(point: Point | null): void;
  setNight(on: boolean): void;
  setPaused(on: boolean): void;
  /** Calme forcé (forêt « immobile ») en plus de prefers-reduced-motion. */
  setCalm(on: boolean): void;
  /** Relance la boucle (après `idleWhenEmpty`). */
  wake(): void;
  setRim(rim: number): void;
  /** Change l'apparence de toutes les Noiraudes du calque. */
  setParams(params: SootSpriteParams): void;
  readonly params: SootSpriteParams;
  /** La Noiraude visible sous ce point (la plus en avant), sinon null. */
  hitTest(x: number, y: number): Susuwatari | null;
  area(): Rect;
  view(): Rect;
  /** Images par seconde mesurées, durée moyenne d'une image (ms), densité. */
  stats(): { fps: number; frameMs: number; dpr: number };
  destroy(): void;
}

function reducedQuery(): MediaQueryList | null {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return null;
  }
}

/** Délai maximal avant de relancer une reconstruction en cours (s). */
const REBUILD_S = 0.2;

export function createSusuwatariLayer(canvas: HTMLCanvasElement, options: SusuwatariLayerOptions = {}): SusuwatariLayer {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D indisponible');
  let maxDpr = options.maxDpr ?? 3;
  let rim = options.rim ?? 0;
  let params = options.params ?? DEFAULT_SOOT_PARAMS;
  let rig = rigOf(params);
  const cache = new SpriteCache(rim, params);
  /** Apparence pas encore passée aux sprites, et quand ils ont été relancés. */
  let pendingSprites: SootSpriteParams | null = null;
  let relaunchedAt = -Infinity;
  const creatures: Susuwatari[] = [];
  const query = reducedQuery();
  let reduced = query?.matches ?? false;
  let calm = false;
  let night = false;
  let paused = false;
  let gaze: Point | null = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let time = 0;
  let fps = 60;
  let frameMs = 0;
  let destroyed = false;
  // Garde-fou de densité : intervalle moyen sur une fenêtre de 90 images.
  let slowSum = 0;
  let slowCount = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min((globalThis as any).__sootExp?.dpr ?? maxDpr, Math.max(1, window.devicePixelRatio || 1));
    width = rect.width;
    height = rect.height;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const area = (): Rect =>
    options.area?.(width, height) ?? { left: 40, top: 40, right: Math.max(41, width - 40), bottom: Math.max(41, height - 20) };
  const view = (): Rect => ({ left: 0, top: 0, right: width, bottom: height });

  const frame = (now: number) => {
    raf = 0;
    if (destroyed || paused || document.visibilityState === 'hidden') return;
    const start = performance.now();
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    if (last !== 0) {
      fps = fps * 0.95 + (1000 / Math.max(1, now - last)) * 0.05;
      // Les images qui suivent la peinture de sprites (et leur envoi au
      // processeur graphique) ne comptent pas : seule la marche courante juge.
      if (options.adaptive !== false && !(globalThis as any).__sootExp?.noAdapt && time > 2 && dpr > 1.5 && now - cache.builtAt > 600) {
        slowSum += now - last;
        slowCount += 1;
        if (slowCount >= 90) {
          if (slowSum / slowCount > 22) {
            maxDpr = dpr > 2 ? 2 : 1.5;
            resize();
          }
          slowSum = 0;
          slowCount = 0;
        }
      }
    }
    last = now;
    time += dt;

    const env: SusuwatariEnv = { time, reduced: reduced || calm, gaze, view: view() };
    const zone = area();
    for (const s of creatures) {
      s.k = options.depth?.(s.y, height) ?? 1;
      live(s, time, zone, env.reduced);
      s.update(dt, env);
    }
    options.onFrame?.(dt, time);

    if (pendingSprites && (!cache.rebuilding || time - relaunchedAt > REBUILD_S)) {
      cache.setParams(pendingSprites);
      pendingSprites = null;
      relaunchedAt = time;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!(globalThis as any).__sootExp?.noClear) ctx.clearRect(0, 0, canvas.width, canvas.height);
    options.drawUnder?.(ctx, dpr, time);
    // De l'arrière vers l'avant.
    const order = creatures.filter((s) => s.state !== 'gone').sort((a, b) => a.y - b.y);
    for (const s of order) {
      const sprites = cache.get(s.variant, (s.scale / 2) * dpr, time);
      if (sprites && !(globalThis as any).__sootExp?.noBodies) drawSusuwatari(ctx, s, sprites, { dpr, night, time, shadow: options.shadow ?? 1, rim, params });
    }
    options.drawOver?.(ctx, dpr, time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    cache.pump(4, time, now);
    frameMs = frameMs * 0.9 + (performance.now() - start) * 0.1;
    // Personne, rien à dessiner : la boucle s'arrête (toile déjà vidée).
    if (options.idleWhenEmpty && creatures.length === 0 && !options.keepAwake?.()) {
      last = 0;
      return;
    }
    schedule();
  };

  const schedule = () => {
    if (raf === 0 && !destroyed && !paused && document.visibilityState !== 'hidden') raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    last = 0;
    schedule();
  };
  const onReduced = (event: MediaQueryListEvent) => {
    reduced = event.matches;
  };

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  query?.addEventListener('change', onReduced);
  resize();
  schedule();

  return {
    get creatures() {
      return creatures;
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    spawn(init) {
      const s = new Susuwatari(init);
      s.rig = rig;
      s.k = options.depth?.(s.y, height) ?? 1;
      // Premier affichage net : le palier exact est construit tout de suite.
      cache.warm(s.variant, (s.scale / 2) * dpr, time);
      creatures.push(s);
      schedule();
      return s;
    },
    remove(s) {
      const i = creatures.indexOf(s);
      if (i >= 0) creatures.splice(i, 1);
    },
    clear() {
      creatures.length = 0;
    },
    setGaze(point) {
      gaze = point;
    },
    setNight(on) {
      night = on;
    },
    setPaused(on) {
      paused = on;
      last = 0;
      schedule();
    },
    setCalm(on) {
      calm = on;
    },
    wake() {
      schedule();
    },
    setRim(value) {
      rim = value;
      cache.setRim(value);
    },
    get params() {
      return params;
    },
    setParams(value) {
      params = value;
      rig = rigOf(value);
      for (const s of creatures) s.rig = rig;
      pendingSprites = value;
      schedule();
    },
    hitTest(x, y) {
      let hit: Susuwatari | null = null;
      for (const s of creatures) {
        if (s.state === 'gone') continue;
        const b = s.body();
        const r = s.scale * 0.55;
        if ((x - b.x) ** 2 + (y - b.y) ** 2 <= r * r && (hit === null || s.y > hit.y)) hit = s;
      }
      return hit;
    },
    area,
    view,
    stats: () => ({ fps, frameMs, dpr }),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      query?.removeEventListener('change', onReduced);
      creatures.length = 0;
      cache.dispose();
    },
  };
}
