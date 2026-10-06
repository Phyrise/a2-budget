/**
 * Lanterne de pierre (tōrō) posée au pied du cèdre : peintures éteinte et
 * allumée superposées (mêmes toiles, alignées au pixel), fondu de l'une à
 * l'autre selon le minuteur (lantern.ts donne le niveau). Changement de
 * modèle : l'ancien s'efface pendant que le nouveau se dévoile.
 *
 * Vie autour de la pierre :
 * - de temps en temps (tirage doux), un kodama vient s'asseoir sur le toit,
 *   puis repart ; jamais pendant la floraison ;
 * - la nuit (Maison en pause), quelques lucioles tournent autour.
 * Rien de tout cela en mouvement « immobile » ni en bandeau (images fixes).
 *
 * Calcul seul : le moteur dessine (sprites dans la peinture, lucioles dans le
 * lot émissif).
 */
import type { Texture } from 'ogl';
import { GLOW, type BillboardWriter } from './batch';
import { rng } from './noise';
import type { SpriteAsset, SpriteDraw } from './spirits';
import {
  between, DEFAULT_LANTERN, FALLBACK_SHAPE, KODAMA_ON_ROOF, LANTERN_HEIGHT, lanternGeometry, VISIT, visitFrame,
  type LanternGeometry, type LanternShape,
} from './toro';

/** Peintures d'un modèle (contrat de themes/lanterns.ts, LanternArt). */
export interface LanternPaint extends LanternShape {
  unlit: string;
  lit: string;
}

/** Source des peintures : modèles par identifiant + kodama à poser sur le toit. */
export interface LanternArtSource {
  art: Partial<Record<string, LanternPaint>>;
  kodama: readonly { src: string; seat: number }[];
}

interface Model {
  id: string;
  shape: LanternShape;
  unlit: SpriteAsset;
  lit: SpriteAsset;
  /** Début du dévoilement. */
  since: number;
}

interface RoofKodama extends SpriteAsset {
  seat: number;
  /** Hauteur relative au plus grand sprite (même échelle de planche). */
  rel: number;
}

const SWAP = 1.4;
const NIGHT_FLIES = 6;

type Loader = (url: string) => Promise<SpriteAsset | null>;

export class StoneLantern {
  model: Model | null = null;
  private prev: Model | null = null;
  private wanted: string | null = null;
  private pending: Promise<boolean> = Promise.resolve(false);
  private kodama: RoofKodama[] = [];
  private kodamaLoad: Promise<void> | null = null;
  private visit: { pose: number; start: number; end: number } | null = null;
  private nextVisit = -1;
  /** Dernière image vue (une scène figée qui reprend : le kodama repart en douceur). */
  private lastSeen = -1;
  private readonly rand = rng(1717);
  private readonly seeds: [number, number, number][];
  private disposed = false;

  constructor(
    private readonly src: LanternArtSource | null,
    private readonly load: Loader,
    private readonly free: (t: Texture) => void,
    private readonly sceneAspect: number,
  ) {
    const r = rng(9090);
    this.seeds = Array.from({ length: NIGHT_FLIES }, (): [number, number, number] => [r(), r(), r()]);
  }

  /** Identifiant affichable (inconnu → modèle par défaut). */
  resolve(id: string | undefined): string {
    const art = this.src?.art ?? {};
    return id && art[id] ? id : DEFAULT_LANTERN;
  }

  /**
   * Demande le modèle `id` (chargé à la demande ; le précédent s'efface
   * ensuite). Vrai quand un nouveau modèle vient d'être posé ; une demande
   * identique à celle en cours attend le même chargement.
   */
  want(id: string | undefined, now: () => number): Promise<boolean> {
    const target = this.resolve(id);
    if (target === this.wanted) return this.pending.then(() => false);
    this.wanted = target;
    this.pending = this.loadModel(target, now);
    return this.pending;
  }

  private async loadModel(target: string, now: () => number): Promise<boolean> {
    const paint = this.src?.art[target];
    if (!paint) return false;
    const [unlit, lit] = await Promise.all([this.load(paint.unlit), this.load(paint.lit)]);
    if (this.disposed || this.wanted !== target || !unlit || !lit) {
      for (const a of [unlit, lit]) if (a) this.free(a.tex);
      return false;
    }
    if (this.prev) this.release(this.prev);
    this.prev = this.model;
    this.model = { id: target, shape: paint, unlit, lit, since: now() };
    return true;
  }

  /** Géométrie de la pierre posée (repli : proportions d'une kasuga). */
  geometry(): LanternGeometry {
    return lanternGeometry(this.model?.shape ?? FALLBACK_SHAPE, this.sceneAspect);
  }

  /** QA / labo : un kodama vient s'asseoir tout de suite (pose 0..3). */
  visitNow(now: number, pose = 0, stay = 30) {
    void this.loadKodama();
    this.visit = { pose, start: now, end: now + stay };
  }

  /** Avance les visites (`animate` : scène vivante ; `blooming` : floraison en cours). */
  update(now: number, animate: boolean, blooming: boolean) {
    if (this.nextVisit < 0) this.nextVisit = now + between(this.rand(), VISIT.first);
    const v = this.visit;
    // Reprise après un gel : la visite échue se termine en fondu plutôt que de disparaître net.
    if (v && now - this.lastSeen > 1 && now > v.end) v.end = now;
    this.lastSeen = now;
    if (v && blooming && v.end > now) v.end = now; // la floraison l'envole doucement
    if (v && now > v.end + VISIT.fade) this.visit = null;
    if (!animate || blooming || this.visit || now < this.nextVisit || !this.model) return;
    if (this.kodama.length === 0) {
      void this.loadKodama();
      return;
    }
    const stay = between(this.rand(), VISIT.stay);
    this.visit = { pose: Math.floor(this.rand() * this.kodama.length), start: now, end: now + stay };
    this.nextVisit = now + stay + between(this.rand(), VISIT.gap);
  }

  /** Transition visible (dévoilement d'un modèle, arrivée ou départ d'un kodama). */
  busy(now: number): boolean {
    if (this.model && now - this.model.since < SWAP) return true;
    const v = this.visit;
    return !!v && (now - v.start < VISIT.fade || (now > v.end && now < v.end + VISIT.fade));
  }

  /** Sprites dans la peinture : pierre éteinte, pierre allumée (fondu), kodama assis. */
  draws(now: number, t: number, lit: number, night: number, fog: number, animate: boolean): SpriteDraw[] {
    const m = this.model;
    if (!m) return [];
    const out: SpriteDraw[] = [];
    const k = animate ? Math.min(1, Math.max(0, (now - m.since) / SWAP)) : 1;
    if (k >= 1 && this.prev) {
      this.release(this.prev);
      this.prev = null;
    }
    const fogMix = fog * (1 - this.geometry().ground.depth) * 0.3;
    const stone = (model: Model, alpha: number, reveal: number) => {
      const g = lanternGeometry(model.shape, this.sceneAspect);
      const base = { x: g.ground.x, y: g.ground.y, depth: g.ground.depth, h: g.h, rot: 0, reveal, glowColor: [1, 0.8, 0.5] as [number, number, number], fogMix };
      out.push({ ...base, asset: model.unlit, alpha, glow: 0 });
      // Allumée par-dessus : seule la lumière change (hors foyer, pixels de l'éteinte).
      if (lit > 0.002) out.push({ ...base, asset: model.lit, alpha: alpha * lit, glow: night * 0.35 * lit });
    };
    if (this.prev && k < 1) stone(this.prev, 1 - k, 1);
    stone(m, 1, k);
    const v = this.visit;
    const kd = v ? this.kodama[v.pose % Math.max(1, this.kodama.length)] : undefined;
    if (v && kd) {
      const { vis, hop } = visitFrame(v.start, v.end, now);
      if (vis > 0.01) {
        const g = this.geometry();
        const h = KODAMA_ON_ROOF * LANTERN_HEIGHT * kd.rel;
        const sway = animate ? Math.sin(t * 0.7 + v.pose) * 0.035 : 0;
        out.push({
          asset: kd, x: g.roof.x, y: g.roof.y + (1 - kd.seat) * h - hop * h * 0.45, depth: g.ground.depth + 0.002, h, rot: sway,
          alpha: vis, reveal: 1, glow: night * 0.55 * vis, glowColor: [0.75, 0.95, 0.85], fogMix,
        });
      }
    }
    return out;
  }

  /** La nuit : quelques lucioles tournent autour de la pierre (positions figées en image fixe). */
  emitNight(out: BillboardWriter, t: number, night: number) {
    if (night < 0.02 || !this.model) return;
    const g = this.geometry();
    const cx = g.fire.x;
    const cy = g.fire.y + g.h * 0.08;
    for (let i = 0; i < NIGHT_FLIES; i++) {
      const [s0, s1, s2] = this.seeds[i]!;
      const ang = t * (0.25 + s0 * 0.35) * (s1 > 0.5 ? 1 : -1) + s2 * 6.283;
      const rad = g.h * (0.5 + 0.35 * s1) + 0.006 * Math.sin(t * 0.8 + s0 * 9);
      const x = cx + (Math.cos(ang) * rad) / this.sceneAspect;
      const y = cy + Math.sin(ang) * rad * 0.42 + 0.01 * Math.sin(t * 1.1 + s2 * 7);
      const blink = 0.5 + 0.5 * Math.sin(t * (1.4 + s0 * 1.6) + s1 * 20);
      out.push(x, y, g.ground.depth + 0.01, 0.017, 0.017, 0, 0.86, 1, 0.55, night * (0.35 + 0.6 * blink), GLOW);
    }
  }

  private loadKodama(): Promise<void> {
    if (!this.kodamaLoad) {
      const list = this.src?.kodama ?? [];
      this.kodamaLoad = Promise.all(list.map((k) => this.load(k.src))).then((assets) => {
        if (this.disposed) {
          for (const a of assets) if (a) this.free(a.tex);
          return;
        }
        const px = assets.map((a) => a?.px ?? 1);
        const max = Math.max(1, ...px);
        this.kodama = assets.flatMap((a, i) => (a ? [{ ...a, seat: list[i]!.seat, rel: px[i]! / max }] : []));
      });
    }
    return this.kodamaLoad;
  }

  private release(m: Model) {
    this.free(m.unlit.tex);
    this.free(m.lit.tex);
  }

  dispose() {
    this.disposed = true;
  }
}
