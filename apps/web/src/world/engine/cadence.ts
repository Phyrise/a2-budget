/**
 * Politique de cadence du moteur (fonction pure, testée) : 60 fps pendant
 * 3 s après une interaction → 30 → 15 → gel à 45 s ; lanterne allumée :
 * jamais de gel (30, 20 sur appareil lent). Le plafond (Réglages › « 30
 * images/s ») borne toutes les cadences, le plancher de la lanterne compris.
 */

/** Plafond de cadence choisi pour cet appareil. */
export type MaxFps = 30 | 60;

export interface CadenceInput {
  /** Animation continue autorisée (Engine.animated). */
  animated: boolean;
  /** Transition en cours (fondu, vol, rafale…). */
  busy: boolean;
  /** Secondes depuis la dernière interaction. */
  idle: number;
  lanternActive: boolean;
  /** Appareil lent (palier de qualité > 0). */
  slow: boolean;
  maxFps: MaxFps;
}

/** Images par seconde visées ; 0 = plus aucune image (gel). */
export function cadence({ animated, busy, idle, lanternActive, slow, maxFps }: CadenceInput): number {
  return Math.min(maxFps, uncapped(animated, busy, idle, lanternActive, slow));
}

function uncapped(animated: boolean, busy: boolean, idle: number, lanternActive: boolean, slow: boolean): number {
  // Images uniques (immobile, bandeau) : seulement le temps d'une transition.
  if (!animated) return busy ? 60 : 0;
  if (busy || idle < 3) return 60;
  // Lanterne allumée : la scène ne se fige jamais, coût plafonné.
  const floor = lanternActive ? (slow ? 20 : 30) : 0;
  if (idle < 15) return 30;
  if (idle < 45) return Math.max(15, floor);
  return floor;
}
