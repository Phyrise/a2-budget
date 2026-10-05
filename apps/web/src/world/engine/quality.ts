/**
 * Mesures du moteur : temps CPU par image, intervalle entre images à 60 fps,
 * décision de descendre d'un palier de qualité (intervalle > 24 ms pendant
 * 1,5 s, après 3 s de chauffe).
 */

export type QualitySetting = 'auto' | 0 | 1 | 2;

export interface EngineStats {
  fps: number;
  frameMs: number;
  tier: number;
  targetFps: number;
  memoryMB: number;
  dpr: number;
  /** Images rendues depuis la création (mesure du débit réel). */
  frames: number;
  /** Peinture affichée (« saison:stade »), vide avant la première. */
  paint: string;
  /** Fondu ou chargement de peinture en cours. */
  fading: boolean;
}

export const DPR_CAPS = [1.5, 1.25, 1] as const;

export class QualityMeter {
  frames = 0;
  frameMs = 0;
  intervalMs = 16;
  private slowFor = 0;
  private startAt = 0;

  /** Une image rendue (temps CPU en ms). */
  frame(cpuMs: number) {
    this.frames++;
    this.frameMs += (cpuMs - this.frameMs) * 0.1;
  }

  /**
   * Intervalle (s) entre deux images à 60 fps. Renvoie true s'il faut
   * descendre d'un palier (`auto` : le moteur peut encore descendre).
   */
  interval(sec: number, at: number, auto: boolean): boolean {
    this.intervalMs += (sec * 1000 - this.intervalMs) * 0.1;
    if (!this.startAt) this.startAt = at;
    if (!auto || at - this.startAt < 3) return false;
    if (this.intervalMs > 24) this.slowFor += sec;
    else this.slowFor = Math.max(0, this.slowFor - sec);
    if (this.slowFor <= 1.5) return false;
    this.slowFor = 0;
    return true;
  }

  get fps() {
    return 1000 / Math.max(1, this.intervalMs);
  }
}
