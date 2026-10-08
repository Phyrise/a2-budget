/** Types partagés du module Noiraudes (état, environnement, création). */

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
export type ArmPose = 'none' | 'up' | 'cheer' | 'wave' | 'flail';
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
