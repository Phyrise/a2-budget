/**
 * Labo Noiraudes — les curseurs du panneau « Réglages », groupe par groupe :
 * quel paramètre de `SootSpriteParams` chacun règle, ses bornes et son pas.
 * Les bornes laissent explorer les anciens essais (poils longs, courbes, épis).
 */
import type { ParamGroup, SootSpriteParams } from '../../../creatures/susuwatari';

export type TuneTab = 'body' | 'hair' | 'eyes' | 'limbs' | 'anim' | 'scene';

export const TABS: ReadonlyArray<{ id: TuneTab; label: string }> = [
  { id: 'body', label: 'Corps' },
  { id: 'hair', label: 'Poils' },
  { id: 'eyes', label: 'Yeux' },
  { id: 'limbs', label: 'Membres' },
  { id: 'anim', label: 'Anim.' },
  { id: 'scene', label: 'Scène' },
];

export interface ParamSpec {
  group: ParamGroup;
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const spec = (group: ParamGroup, key: string, label: string, min: number, max: number, step: number, unit?: string): ParamSpec => ({
  group,
  key,
  label,
  min,
  max,
  step,
  unit,
});

export const SPECS: Record<Exclude<TuneTab, 'scene'>, ParamSpec[]> = {
  body: [
    spec('body', 'radius', 'Taille du disque', 0.5, 1.1, 0.01),
    spec('body', 'ratio', 'Ovalité (hauteur / largeur)', 0.75, 1.3, 0.01),
    spec('body', 'wobble', 'Irrégularité du contour', 0, 0.12, 0.002),
    spec('body', 'darkness', 'Noirceur', 0.5, 1, 0.01),
    spec('body', 'sheen', 'Reflet', 0, 1, 0.02),
    spec('shadow', 'opacity', 'Ombre au sol', 0, 1.5, 0.05),
    spec('shadow', 'width', 'Largeur de l’ombre', 0.8, 3, 0.05),
  ],
  hair: [
    spec('hair', 'count', 'Nombre de poils', 0, 1200, 5),
    spec('hair', 'lenMin', 'Longueur min', 0, 0.8, 0.005),
    spec('hair', 'lenMax', 'Longueur max', 0, 1, 0.005),
    spec('hair', 'jitter', 'Jitter d’angle', 0, 1, 0.005, ' rad'),
    spec('hair', 'width', 'Épaisseur des poils', 0.004, 0.08, 0.001),
    spec('hair', 'opacity', 'Opacité des poils', 0, 1, 0.01),
    spec('hair', 'bend', 'Courbure', 0, 1.5, 0.01),
    spec('hair', 'fuzz', 'Densité du duvet', 0, 3, 0.05, '×'),
    spec('hair', 'depth', 'Épaisseur du halo', 0, 0.4, 0.005),
    spec('hair', 'rootOut', 'Racine (bord du disque)', 0.6, 1.05, 0.005),
    spec('hair', 'fuzzLen', 'Longueur du duvet', 0.2, 3, 0.05, '×'),
    spec('hair', 'tufts', 'Épis (touffes)', 0, 1, 0.02),
    spec('hair', 'under', 'Dessous tassé', 0, 0.9, 0.05),
  ],
  eyes: [
    spec('eyes', 'size', 'Taille des yeux', 0.08, 0.32, 0.002),
    spec('eyes', 'aspect', 'Forme des yeux (h / l)', 0.8, 1.6, 0.01),
    spec('eyes', 'gap', 'Écart des yeux', 0.12, 0.45, 0.005),
    spec('eyes', 'lift', 'Hauteur des yeux', -0.2, 0.35, 0.005),
    spec('eyes', 'pupil', 'Taille des pupilles', 0.02, 0.14, 0.002),
    spec('eyes', 'blink', 'Clignement', 0, 4, 0.1, '×'),
  ],
  limbs: [
    spec('limbs', 'legs', 'Longueur des jambes', 0.1, 0.6, 0.01),
    spec('limbs', 'arms', 'Longueur des bras', 0.1, 0.7, 0.01),
    spec('limbs', 'width', 'Épaisseur des membres', 0.02, 0.16, 0.002),
    spec('limbs', 'feet', 'Taille des pieds', 0.02, 0.2, 0.002),
    spec('limbs', 'hands', 'Taille des mains', 0.01, 0.14, 0.002),
  ],
  anim: [
    spec('anim', 'furSpeed', 'Vitesse du frisottis', 0, 4, 0.05, '×'),
    spec('anim', 'wave', 'Ondulation des poils', 0, 4, 0.05, '×'),
    spec('anim', 'hold', 'Pause du frisottis', 0, 0.9, 0.05),
    spec('anim', 'bounce', 'Rebond', 0, 2, 0.05, '×'),
  ],
};

export function readParam(p: SootSpriteParams, s: ParamSpec): number {
  const v = (p[s.group] as unknown as Record<string, unknown>)[s.key];
  return typeof v === 'number' ? v : 0;
}

/** Nouveaux paramètres (copie du seul groupe modifié). */
export function writeParam(p: SootSpriteParams, s: ParamSpec, value: number): SootSpriteParams {
  return { ...p, [s.group]: { ...p[s.group], [s.key]: value } };
}

/** Décimales à afficher d'après le pas du curseur. */
export function digitsOf(step: number): number {
  if (step >= 1) return 0;
  return Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
}
