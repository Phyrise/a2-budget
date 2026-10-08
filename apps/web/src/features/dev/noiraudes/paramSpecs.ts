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
    spec('body', 'radius', 'Taille du disque', 0.3, 1.1, 0.01),
    spec('body', 'blur', 'Flou du contour (duveteux)', 0, 0.4, 0.005),
    spec('body', 'darkness', 'Noirceur du corps', 0.5, 1, 0.01),
    spec('body', 'ratio', 'Ovalité (hauteur / largeur)', 0.75, 1.3, 0.01),
    spec('body', 'wobble', 'Irrégularité du contour', 0, 0.12, 0.002),
    spec('body', 'sheen', 'Reflet', 0, 1, 0.02),
    spec('shadow', 'opacity', 'Ombre au sol', 0, 1.5, 0.05),
    spec('shadow', 'width', 'Largeur de l’ombre', 0.8, 3, 0.05),
  ],
  hair: [
    spec('hair', 'count', 'Nombre de poils', 0, 1200, 1),
    spec('hair', 'lenMin', 'Longueur min', 0, 1.2, 0.005),
    spec('hair', 'lenMax', 'Longueur max', 0, 1.4, 0.005),
    spec('hair', 'width', 'Épaisseur des poils', 0.004, 0.08, 0.001),
    spec('hair', 'taper', 'Effilement (0 : droits, 1 : pointus)', 0, 1, 0.01),
    spec('hair', 'cap', 'Bout arrondi', 0, 1, 0.05),
    spec('hair', 'over', 'Poils sur le corps', 0, 1, 0.01),
    spec('hair', 'inner', 'Jusqu’où ils rentrent (0 : centre)', 0, 1, 0.01),
    spec('hair', 'ink', 'Noirceur des poils', 0.5, 1, 0.01),
    spec('hair', 'jitter', 'Jitter d’angle', 0, 1, 0.005, ' rad'),
    spec('hair', 'under', 'Dessous tassé', 0, 0.9, 0.05),
    spec('hair', 'fuzz', 'Densité du duvet', 0, 3, 0.05, '×'),
    spec('hair', 'fuzzLen', 'Longueur du duvet', 0.2, 3, 0.05, '×'),
    spec('hair', 'fuzzAlpha', 'Opacité du duvet', 0, 1, 0.01),
    spec('hair', 'depth', 'Épaisseur du halo', 0, 0.4, 0.005),
    spec('hair', 'rootOut', 'Racine (bord du disque)', 0.4, 1.05, 0.005),
    spec('hair', 'opacity', 'Opacité des poils', 0, 1, 0.01),
    spec('hair', 'bend', 'Courbure', 0, 1.5, 0.01),
    spec('hair', 'tufts', 'Épis (touffes)', 0, 1, 0.02),
  ],
  eyes: [
    spec('eyes', 'size', 'Taille des yeux', 0.08, 0.32, 0.002),
    spec('eyes', 'cross', 'Strabisme (vers le nez)', 0, 1, 0.01),
    spec('eyes', 'ring', 'Liseré sombre', 0, 0.3, 0.005),
    spec('eyes', 'aspect', 'Forme des yeux (h / l)', 0.8, 1.6, 0.01),
    spec('eyes', 'gap', 'Écart des yeux', 0.12, 0.45, 0.005),
    spec('eyes', 'lift', 'Hauteur des yeux', -0.2, 0.35, 0.005),
    spec('eyes', 'pupil', 'Taille des pupilles', 0.02, 0.14, 0.002),
    spec('eyes', 'lid', 'Ombre de la paupière', 0, 0.6, 0.01),
    spec('eyes', 'turn', 'Les yeux suivent le regard', 0, 0.2, 0.005),
    spec('eyes', 'blink', 'Clignement', 0, 4, 0.1, '×'),
  ],
  limbs: [
    spec('limbs', 'legs', 'Longueur des jambes', 0.1, 0.8, 0.01),
    spec('limbs', 'bow', 'Arc des jambes', 0, 1.5, 0.01),
    spec('limbs', 'mirror', 'Arcs en miroir « ( ) »', 0, 1, 0.05),
    spec('limbs', 'knee', 'Hauteur du genou', 0.15, 0.85, 0.01),
    spec('limbs', 'stance', 'Écart des pieds', -0.3, 0.8, 0.01),
    spec('limbs', 'hip', 'Écart des hanches', 0, 1, 0.01),
    spec('limbs', 'width', 'Épaisseur des membres', 0.01, 0.16, 0.001),
    spec('limbs', 'toes', 'Doigts fins (0 : pieds ronds)', 0, 5, 1),
    spec('limbs', 'feet', 'Pieds / orteils', 0.02, 0.24, 0.002),
    spec('limbs', 'hands', 'Mains / doigts', 0.01, 0.2, 0.002),
    spec('limbs', 'spread', 'Éventail des doigts', 0, 3, 0.05, ' rad'),
    spec('limbs', 'fine', 'Finesse des doigts', 0.15, 1, 0.01, '×'),
    spec('limbs', 'arms', 'Longueur des bras', 0.1, 0.9, 0.01),
    spec('limbs', 'shoulder', 'Écart des épaules', 0.3, 1.2, 0.01),
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
