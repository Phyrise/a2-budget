/**
 * Saisons : particules saisonnières (feuilles, neige, pétales — shader
 * glsl/season.ts), lucioles du soir en été (lot des spores), légère teinte
 * d'étalonnage, tourbillon au passage d'un pulse. Coût : un seul appel de
 * dessin gl.POINTS (≤ SEASON points), aucun calcul par particule sur le CPU.
 *
 * En mouvement « immobile » (et en bandeau) : rien ne tombe ; l'automne et le
 * printemps montrent quelques feuilles / pétales posés au sol.
 *
 * Avec une peinture de saison (manifest.seasons) : feuilles aux teintes vives
 * de la peinture d'automne, neige plus dense (plus encore par temps calme,
 * elle remplace la pluie), pas de teinte d'étalonnage (la peinture suffit).
 */
import type { ScenePoint, Season, WorldManifest } from '../types';

/** Nombre de points du lot saisonnier. */
export const SEASON = 150;

const WHIRL_SECONDS = 2.8;

/** Densité par saison (avant paliers de qualité) et code du shader. */
const SEASON_CFG: Record<Season, { count: number; code: number; tint: [number, number, number] }> = {
  spring: { count: 30, code: 0, tint: [1.01, 0.995, 1.0] },
  summer: { count: 0, code: -1, tint: [1.0, 1.0, 0.99] },
  autumn: { count: 26, code: 1, tint: [1.035, 1.0, 0.94] },
  winter: { count: 120, code: 2, tint: [0.95, 0.985, 1.05] },
};

/**
 * Où se posent les feuilles en image fixe : mousse et rochers visibles dans
 * le cadrage mobile (vérifié en capture), loin des visages des kodama.
 */
const REST_POINTS: [number, number, number][] = [
  [0.599, 0.66, 0.24],
  [0.709, 0.685, 0.25],
  [0.807, 0.709, 0.33],
  [0.662, 0.624, 0.22],
  [0.88, 0.662, 0.27],
  [0.47, 0.664, 0.33],
  [0.757, 0.756, 0.34],
  [0.625, 0.715, 0.27],
];

export interface SeasonFrame {
  /** Code shader (-1 = pas de particules dans la scène). */
  code: number;
  count: number;
  rest: boolean;
  tint: [number, number, number];
  /** Lucioles du soir (été) 0..1. */
  fireflies: number;
  /** 1 = peinture de saison affichée (teintes vives accordées à la peinture). */
  vivid: number;
}

/**
 * Saison des particules : celle de la peinture affichée ; pendant le
 * chargement d'une peinture de saison, rien de saisonnier (pas de feuilles
 * d'automne sur la forêt d'été) ; sans variante peinte, la saison demandée.
 */
export function particleSeason(m: WorldManifest, wanted: Season, painted: Season): Season {
  if (painted !== 'summer') return painted;
  return wanted !== 'summer' && m.seasons?.[wanted] ? 'summer' : wanted;
}

export class SeasonFx {
  private whirl = { x: 0.5, y: 0.5, strength: 0, start: -10 };
  /** Heure locale forcée (labo) ; null = horloge réelle. */
  hourOverride: number | null = null;
  private hourCache = { at: -10, hour: 12 };

  /** Tourbillon de feuilles autour d'un point de scène (atterrissage d'un pulse). */
  stir(x: number, y: number, strength: number, now: number) {
    if (strength <= 0) return;
    this.whirl = { x, y, strength: Math.min(1, strength), start: now };
  }

  busy(now: number): boolean {
    return now - this.whirl.start < WHIRL_SECONDS;
  }

  /** Heure locale (relue au plus une fois par minute). */
  hour(now: number): number {
    if (this.hourOverride !== null) return this.hourOverride;
    if (now - this.hourCache.at > 60) {
      const d = new Date();
      this.hourCache = { at: now, hour: d.getHours() + d.getMinutes() / 60 };
    }
    return this.hourCache.hour;
  }

  /** `painted` : peinture de saison affichée ; `rain` : pluie de l'humeur (l'hiver, plus de neige). */
  frame(season: Season, now: number, animate: boolean, night: number, painted = false, rain = 0): SeasonFrame {
    const cfg = SEASON_CFG[season] ?? SEASON_CFG.autumn;
    const rest = !animate;
    let count = cfg.count;
    if (season === 'winter') count = Math.min(SEASON, count * (1 + 0.3 * rain));
    if (rest) count = cfg.code === 0 || cfg.code === 1 ? REST_POINTS.length : 0;
    let fireflies = 0;
    let tint = cfg.tint;
    if (season === 'summer') {
      const h = this.hour(now);
      // Le soir : de 19 h à l'aube, en fondu sur une heure ; lumière un peu plus basse.
      const dusk = Math.min(1, Math.min(1, Math.max(0, h - 18.5)) + Math.min(1, Math.max(0, 5.5 - h))) * (1 - night);
      if (animate) fireflies = Math.max(dusk, 0.25) * (1 - night);
      tint = [1 - 0.08 * dusk, 1 - 0.1 * dusk, 0.99 - 0.1 * dusk];
    } else if (painted) tint = [1, 1, 1];
    return { code: cfg.code, count, rest, tint, fireflies, vivid: painted ? 1 : 0 };
  }

  /** Uniformes du lot saisonnier (hors temps / taille, posés par frame.ts). */
  uniforms(u: Record<string, { value: unknown }>, f: SeasonFrame, now: number, avoid: number[][], gust: number) {
    u.uSeason!.value = Math.max(0, f.code);
    u.uCount!.value = f.count;
    u.uRest!.value = f.rest ? 1 : 0;
    u.uRestCount!.value = f.rest ? f.count : 0;
    u.uGust!.value = gust;
    u.uVivid!.value = f.vivid;
    u.uAvoid!.value = avoid;
    const w = this.whirl;
    const k = (now - w.start) / WHIRL_SECONDS;
    if (k >= 0 && k < 1 && !f.rest) {
      u.uWhirl!.value = [w.x, w.y, w.strength, 0.16];
      u.uWhirlK!.value = k;
    } else {
      u.uWhirl!.value = [0, 0, 0, 0.16];
      u.uWhirlK!.value = 0;
    }
  }
}

export const restPoints = (): number[][] => REST_POINTS.map((p) => [...p]);

/** Visages des kodama à éviter : x, y du visage, rayon, visibilité. */
export function avoidList(spots: ScenePoint[], vis: (i: number) => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const s = spots[i];
    if (!s) {
      out.push([0, 0, 0, 0]);
      continue;
    }
    const h = s.scale ?? 0.05;
    out.push([s.x, s.y - h * 0.6, h * 0.9, vis(i)]);
  }
  return out;
}
