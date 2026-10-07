/**
 * Kodama « karakara » : touché, un kodama secoue vivement la tête de gauche
 * à droite — rotation du haut du sprite autour du cou, joint doux dans le
 * shader des sprites (glsl/layers.ts) — avec un cliquetis de bois ; ses
 * voisins l'imitent avec un léger décalage, comme dans le film.
 *
 * Module pur (testé) : gréement de la tête de chaque peinture, courbe de la
 * secousse, ordre des voisins, test de toucher (point de vue → kodama).
 */
import type { Framing } from './framing';

/** Tête d'un kodama peint, en coordonnées du sprite rogné (0..1, y vers le bas). */
export interface HeadRig {
  /** Centre et demi-axes de la tête : la zone qui tourne (joint doux au-delà). */
  center: readonly [number, number];
  radius: readonly [number, number];
  /** Le cou : pivot de la rotation, et centre du toucher. */
  pivot: readonly [number, number];
}

/** Gréement mesuré sur chaque peinture (kodama-N.webp, marges rognées). */
const RIGS: Record<number, HeadRig> = {
  1: { center: [0.447, 0.176], radius: [0.192, 0.184], pivot: [0.463, 0.353] },
  2: { center: [0.394, 0.159], radius: [0.211, 0.163], pivot: [0.512, 0.315] },
  3: { center: [0.678, 0.388], radius: [0.149, 0.129], pivot: [0.654, 0.525] },
  4: { center: [0.471, 0.125], radius: [0.165, 0.129], pivot: [0.397, 0.289] },
  // Le grand des deux (le petit reste sage).
  5: { center: [0.354, 0.141], radius: [0.168, 0.148], pivot: [0.347, 0.316] },
  6: { center: [0.507, 0.153], radius: [0.196, 0.161], pivot: [0.543, 0.306] },
  // Peint en pleine secousse : la zone couvre le flou de la tête.
  7: { center: [0.502, 0.177], radius: [0.424, 0.197], pivot: [0.488, 0.346] },
  8: { center: [0.475, 0.151], radius: [0.173, 0.155], pivot: [0.462, 0.298] },
};

/** Repli (peinture inconnue, labo) : tête ronde dans le haut du sprite. */
export const DEFAULT_RIG: HeadRig = { center: [0.5, 0.2], radius: [0.22, 0.18], pivot: [0.5, 0.38] };

export function rigFor(url: string): HeadRig {
  const m = /kodama-(\d+)[-.]/.exec(url);
  return (m && RIGS[Number(m[1])]) || DEFAULT_RIG;
}

/** Durée d'une secousse (s). */
export const RATTLE_S = 1.25;
/** Cadence de la secousse (allers-retours par seconde). */
const RATTLE_HZ = 6.5;
/** Amplitude d'une secousse franche (rad, ≈ 19°). */
export const RATTLE_AMP = 0.33;

export interface Rattle {
  /** Début (horloge du moteur, s) ; dans le futur pour un voisin qui va imiter. */
  at: number;
  amp: number;
}

export interface HeadPose {
  /** Inclinaison de la tête (rad). */
  angle: number;
  /** Pincement horizontal : la tête vue de profil au plus fort de la secousse. */
  squeeze: number;
}

/** Pose de la tête à l'instant `now` ; null hors secousse. */
export function rattlePose(r: Rattle | null | undefined, now: number): HeadPose | null {
  if (!r) return null;
  const k = now - r.at;
  if (k < 0 || k > RATTLE_S) return null;
  const env = Math.min(1, k / 0.06) * Math.pow(1 - k / RATTLE_S, 1.5);
  const s = Math.sin(k * RATTLE_HZ * Math.PI * 2);
  return { angle: s * r.amp * env, squeeze: Math.abs(s) * 0.2 * env };
}

/** Secousse en cours ou prévue (anti-rafale : on ne relance pas une tête qui claque). */
export function rattling(r: Rattle | null | undefined, now: number): boolean {
  return !!r && now - r.at < RATTLE_S * 0.85;
}

export interface Imitator {
  index: number;
  /** Retard (s) avant d'imiter. */
  delay: number;
  /** Part de l'amplitude du premier. */
  amp: number;
}

/** Les voisins visibles les plus proches imitent, du plus près au plus loin. */
export function imitators(
  spots: readonly { x: number; y: number }[],
  from: number,
  visible: (i: number) => boolean,
  max = 3,
): Imitator[] {
  const o = spots[from];
  if (!o) return [];
  return spots
    .map((s, i) => ({ i, d: Math.hypot(s.x - o.x, s.y - o.y) }))
    .filter((c) => c.i !== from && visible(c.i))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((c, rank) => ({ index: c.i, delay: 0.26 + rank * 0.16 + Math.min(0.22, c.d * 0.6), amp: 0.82 * Math.pow(0.86, rank) }));
}

/** Pivot de la parallaxe (glsl/common.ts, PIVOT). */
export const PARALLAX_PIVOT = 0.4;

/** Un kodama à l'écran, tel que le moteur le dessine. */
export interface TouchTarget {
  x: number;
  y: number;
  depth: number;
  /** Hauteur du sprite (unités : hauteur d'image). */
  h: number;
  /** Largeur / hauteur du sprite rogné. */
  aspect: number;
  /** Cou (coordonnées du sprite) : centre de la zone de toucher. */
  pivot: readonly [number, number];
  vis: number;
}

/** Rayon minimal de la zone de toucher (px CSS) : un doigt, même sur un kodama lointain. */
export const TOUCH_RADIUS = 24;

/** Centre (px CSS, relatifs à la vue) et rayon de la zone de toucher d'un kodama. */
export function touchZone(f: Framing, par: readonly [number, number], sceneAspect: number, t: TouchTarget) {
  const ax = t.x + par[0] * (t.depth - PARALLAX_PIVOT);
  const ay = t.y + par[1] * (t.depth - PARALLAX_PIVOT);
  const nx = ax + ((t.pivot[0] - 0.5) * t.h * t.aspect) / sceneAspect;
  const ny = ay - (1 - t.pivot[1]) * t.h;
  const hpx = (t.h / f.vh) * f.h;
  return { x: ((nx - f.cx) / f.vw + 0.5) * f.w, y: ((ny - f.cy) / f.vh + 0.5) * f.h, r: Math.max(TOUCH_RADIUS, hpx * 0.42) };
}

/**
 * Test de toucher : point de vue (px CSS relatifs au canvas) → indice du
 * kodama visible touché (le plus proche de son cou), ou -1. Tient compte du
 * cadrage, de la parallaxe (profondeur de chaque kodama) et de sa taille.
 */
export function kodamaAt(
  f: Framing,
  par: readonly [number, number],
  sceneAspect: number,
  targets: readonly (TouchTarget | null)[],
  px: number,
  py: number,
): number {
  let best = -1;
  let bd = Infinity;
  targets.forEach((t, i) => {
    if (!t || t.vis < 0.3) return;
    const z = touchZone(f, par, sceneAspect, t);
    const d = Math.hypot(px - z.x, py - z.y) / z.r;
    if (d <= 1 && d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
