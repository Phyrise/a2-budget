/**
 * Les rôles des Noiraudes d'un écran (un « acteur » = une Noiraude du calque
 * et ce qu'elle fait ici) et les petits outils communs : point de portage
 * au-dessus de la tête, fondu, sol.
 */
import { applyMatrix, bodyMatrix, type Point, type SootSpriteParams, type Susuwatari } from '../susuwatari';
import type { Item } from './items';

/**
 * - `stray`  : vagabonde perchée au bord d'un bloc (le petit jeu) ;
 * - `porter` : porte une pièce au Sans-Visage ou la rapporte ;
 * - `herd`   : venue pour un kompeitō du bocal ;
 * - `parade` : la procession (rare) ;
 * - `runner` : traverse en bas avec un kompeitō (un montant a changé).
 */
export type Role = 'stray' | 'porter' | 'herd' | 'parade' | 'runner';

export interface Actor {
  s: Susuwatari;
  role: Role;
  /** Défile avec la page (sinon attachée à l'écran : la bande du bas). */
  page: boolean;
  /** Objet porté au-dessus de la tête. */
  load: Item | null;
  /** Objets empilés sur `load` (une porteuse reprend la pièce d'une autre). */
  extra: Item[];
  /**
   * Elle lâche sa charge malgré elle (attrapée, enfuie) : le rôle décide de
   * ce qu'elle devient (les autres porteuses la reprennent, le bonbon
   * retombe pour le troupeau…). Sans cela : elle tombe et s'efface.
   */
  letGo: (() => void) | null;
  /** Portage à deux : l'autre porteuse du même objet. */
  mate: Actor | null;
  /** Fondu : opacité visée et vitesse (par seconde). */
  fadeTo: number;
  fadeRate: number;
  /** Retirée dès qu'elle est effacée. */
  leaving: boolean;
  /** Cible du doigt (bouton transparent qui la suit) : toutes les Noiraudes visibles. */
  hit: HTMLButtonElement | null;
  /** Dernière place écrite sur la cible (on n'écrit que si elle change). */
  hitAt: { x: number; y: number; w: number; h: number };
  /** Perchoir : pieds (x, y), bout du trot (x2). */
  perch: { x: number; y: number; x2: number } | null;
  /** Fin de visite, prochaine décision (horloge du calque, s). */
  until: number;
  next: number;
  caught: boolean;
  /** S'est trompée d'onglet (Courses, Calendrier). */
  lost: boolean;
  /** Occupée (geste, troupeau, fuite) : sa vie ordinaire attend. */
  busy: 'push' | 'climb' | 'herd' | 'flee' | null;
  /** Comportement propre au rôle, à chaque image. */
  tick: ((a: Actor, dt: number, time: number) => void) | null;
  /** Touchée (après le rebond et le « kyu ») : attraper (défaut), etc. */
  tap: (() => void) | null;
}

export function makeActor(s: Susuwatari, role: Role, page: boolean): Actor {
  return {
    s,
    role,
    page,
    load: null,
    extra: [],
    letGo: null,
    mate: null,
    fadeTo: 1,
    fadeRate: 3,
    leaving: false,
    hit: null,
    hitAt: { x: NaN, y: NaN, w: NaN, h: NaN },
    perch: null,
    until: Infinity,
    next: 0,
    caught: false,
    lost: false,
    busy: null,
    tick: null,
    tap: null,
  };
}

/** Bout des mains levées (`setArms('up')`), là où se pose ce qu'elle porte. */
export function handsUp(s: Susuwatari, p: SootSpriteParams): Point {
  const R = s.scale / 2;
  const Rd = R * p.body.radius;
  const L = p.limbs.arms * R;
  return applyMatrix(bodyMatrix(s), 0, -0.15 * Rd - 1.92 * L * s.arms);
}

/** Centre de l'objet porté (par une ou deux porteuses). */
export function loadPoint(a: Actor, p: SootSpriteParams): Point | null {
  const item = a.load;
  if (!item) return null;
  const h = handsUp(a.s, p);
  if (a.mate && a.mate.load === item) {
    const o = handsUp(a.mate.s, p);
    return { x: (h.x + o.x) / 2, y: Math.min(h.y, o.y) - item.r * 0.7 };
  }
  return { x: h.x, y: h.y - item.r * 0.75 };
}

export const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt);

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
