/**
 * Mesures du moteur : temps CPU par image, intervalle entre images à la
 * cadence haute (60 fps, 30 sous le plafond), décision de descendre d'un
 * palier de qualité (intervalle > 24 ms à 60 fps, 48 ms à 30, pendant
 * 1,5 s, après 3 s de chauffe), densité de rendu par palier.
 */

export type QualitySetting = 'auto' | 0 | 1 | 2;

export interface EngineStats {
  fps: number;
  frameMs: number;
  tier: number;
  targetFps: number;
  /** Plafond de cadence (Réglages › « 30 images/s »). */
  maxFps: number;
  /** Images/s réelles, toutes cadences (moyenne glissante, gardée pendant un gel). */
  rate: number;
  memoryMB: number;
  dpr: number;
  /** Images rendues depuis la création (mesure du débit réel). */
  frames: number;
  /** Peinture affichée (« saison:stade »), vide avant la première. */
  paint: string;
  /** Fondu ou chargement de peinture en cours. */
  fading: boolean;
}

/** Densité de rendu par palier. */
export const DPR_CAPS = [1.5, 1.25, 1] as const;
/**
 * Palier 0 « net » : 2,5 ≈ densité de la peinture 1536 px dans un héros de
 * téléphone (au-delà, rien de plus à montrer). Premier renoncement quand les
 * images ralentissent, avant tout palier d'effets.
 */
export const SHARP_DPR = 2.5;
/** Pixels rendus par image au plus (grands écrans de bureau à haute densité). */
export const MAX_PIXELS = 4.2e6;

/** Densité de rendu : écran, palier, plafond de pixels (jamais sous 1 px CSS). */
export function renderDpr(device: number, tier: number, cssW: number, cssH: number, sharp = true): number {
  const cap = tier === 0 && sharp ? SHARP_DPR : (DPR_CAPS[tier] ?? 1);
  const budget = Math.sqrt(MAX_PIXELS / Math.max(1, cssW * cssH));
  return Math.min(device, cap, Math.max(1, budget));
}

export class QualityMeter {
  frames = 0;
  frameMs = 0;
  intervalMs = 16;
  /** Palier 0 « net » (SHARP_DPR) tant que les images suivent. */
  sharp = true;
  private slowFor = 0;
  private startAt = 0;
  private paceMs = 0;

  /** Réglage choisi : palier de départ, densité « nette » rétablie. */
  reset(q: QualitySetting): number {
    this.sharp = true;
    return typeof q === 'number' ? q : 0;
  }

  /** Un cran plus bas : d'abord la densité « nette » (si l'écran en profitait), puis le palier suivant. */
  step(tier: number, dpr: number): number {
    if (tier > 0 || !this.sharp || dpr <= DPR_CAPS[0]) return tier + 1;
    this.sharp = false;
    return tier;
  }

  /** Une image rendue (temps CPU en ms). */
  frame(cpuMs: number) {
    this.frames++;
    this.frameMs += (cpuMs - this.frameMs) * 0.1;
  }

  /** Écart (s) entre deux images rendues, toutes cadences ; une reprise après gel ne compte pas. */
  pace(sec: number) {
    if (sec <= 0 || sec > 0.25) return;
    this.paceMs = this.paceMs ? this.paceMs + (sec * 1000 - this.paceMs) * 0.1 : sec * 1000;
  }

  get rate() {
    return this.paceMs ? 1000 / this.paceMs : 0;
  }

  /** Plafond de cadence changé : la moyenne repart de l'intervalle visé. */
  retarget(fps: number) {
    this.intervalMs = 1000 / fps;
    this.slowFor = 0;
  }

  /**
   * Intervalle (s) entre deux images à la cadence haute `fps`. Renvoie true
   * s'il faut descendre d'un palier (`auto` : le moteur peut encore descendre).
   */
  interval(sec: number, at: number, auto: boolean, fps = 60): boolean {
    this.intervalMs += (sec * 1000 - this.intervalMs) * 0.1;
    if (!this.startAt) this.startAt = at;
    if (!auto || at - this.startAt < 3) return false;
    if (this.intervalMs > (24 * 60) / fps) this.slowFor += sec;
    else this.slowFor = Math.max(0, this.slowFor - sec);
    if (this.slowFor <= 1.5) return false;
    this.slowFor = 0;
    return true;
  }

  get fps() {
    return 1000 / Math.max(1, this.intervalMs);
  }
}
