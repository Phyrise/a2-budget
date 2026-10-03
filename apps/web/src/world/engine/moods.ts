/**
 * Paramètres d'ambiance par humeur. Tous continus : le moteur les interpole
 * (constante de temps ~1 s, transition visible ~3 s) pour qu'un changement
 * d'humeur soit une lente variation de lumière, jamais un saut.
 */
import type { Mood } from '../types';

export interface MoodParams {
  /** Densité de brume 0..1. */
  fog: number;
  /** La brume se lève (0 = au ras du sol, 1 = haute et claire). */
  fogLift: number;
  /** Intensité globale des rayons. */
  rays: number;
  /** Poids de chacun des 4 rayons (0..1). */
  ray0: number;
  ray1: number;
  ray2: number;
  ray3: number;
  /** Nombre de spores visibles. */
  spores: number;
  /** Teinte dorée des spores 0..1. */
  gold: number;
  /** Pluie fine en traits. */
  rain: number;
  /** Gouttes qui perlent (effet peint). */
  drips: number;
  /** Scintillements (gouttes sur feuilles, eau). */
  sparkle: number;
  /** Mousse lumineuse. */
  moss: number;
  /** Vent de base. */
  wind: number;
  /** Étalonnage procédural léger (neutre quand une LUT est fournie). */
  exposure: number;
  saturation: number;
  warmth: number;
}

export const MOODS: Record<Mood, MoodParams> = {
  quiet: {
    fog: 1, fogLift: 0, rays: 0.06, ray0: 1, ray1: 0, ray2: 0, ray3: 0,
    spores: 12, gold: 0, rain: 0.85, drips: 0.9, sparkle: 0.05, moss: 0, wind: 0.8,
    exposure: -0.12, saturation: 0.8, warmth: -0.06,
  },
  peaceful: {
    fog: 0.6, fogLift: 0.3, rays: 0.42, ray0: 1, ray1: 0, ray2: 0, ray3: 0,
    spores: 24, gold: 0.15, rain: 0, drips: 0.25, sparkle: 0.2, moss: 0.12, wind: 0.6,
    exposure: 0, saturation: 0.97, warmth: 0,
  },
  lively: {
    fog: 0.42, fogLift: 0.6, rays: 0.66, ray0: 1, ray1: 1, ray2: 0.75, ray3: 0,
    spores: 40, gold: 0.45, rain: 0, drips: 0.12, sparkle: 0.65, moss: 0.3, wind: 0.7,
    exposure: 0.03, saturation: 1.03, warmth: 0.035,
  },
  flourishing: {
    fog: 0.32, fogLift: 0.75, rays: 0.88, ray0: 1, ray1: 1, ray2: 1, ray3: 0.8,
    spores: 60, gold: 1, rain: 0, drips: 0.05, sparkle: 0.5, moss: 0.85, wind: 0.65,
    exposure: 0.05, saturation: 1.07, warmth: 0.07,
  },
};

export const MOOD_KEYS = Object.keys(MOODS.quiet) as (keyof MoodParams)[];

export function cloneParams(p: MoodParams): MoodParams {
  return { ...p };
}

/** Rapproche `cur` de `target` (exponentielle, indépendante du pas de temps). */
export function approachParams(cur: MoodParams, target: MoodParams, dt: number, tau = 1): boolean {
  const k = 1 - Math.exp(-dt / tau);
  let moving = false;
  for (const key of MOOD_KEYS) {
    const d = target[key] - cur[key];
    if (Math.abs(d) > 1e-3) {
      cur[key] += d * k;
      moving = true;
    } else cur[key] = target[key];
  }
  return moving;
}

/** Nombre de kodama visibles selon l'humeur (tous la nuit). */
export function kodamaCount(mood: Mood, spots: number, night: boolean): number {
  if (night) return spots;
  switch (mood) {
    case 'quiet':
      return 0;
    case 'peaceful':
      return Math.min(1, spots);
    case 'lively':
      return Math.min(3, spots);
    default:
      return spots;
  }
}
