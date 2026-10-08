/**
 * Modèles de Noiraudes (onglet « Scène » du Labo) :
 * - `defaut` : le modèle par défaut (DEFAULT_SOOT_PARAMS) ;
 * - `film`   : au plus près du plan du film (gros plan) : traits plus fins,
 *              jambes plus longues ; le défaut en est une version un peu
 *              plus appuyée, plus lisible à 30–50 px ;
 * - `arthurV1` : le meilleur réglage d'Arthur avec l'ancien moteur, tel quel
 *              (pointes effilées, rien sur le corps, genoux du même côté) ;
 * - `vise`, `porcEpic`, `ronces` : anciens essais (moteur d'avant).
 *
 * `legacy` remet les champs ajoutés depuis à leur valeur « ancien moteur » :
 * ces modèles se dessinent comme à l'époque.
 *
 * Ce qui les rend mignonnes (Arthur) → où le régler dans le Labo :
 * 1. jambes arquées en « ( ) », en miroir : Membres › Arc, Arcs en miroir,
 *    Hauteur du genou (limbs.bow, mirror, knee) ;
 * 2. poils rectilignes, pas pointus : Poils › Effilement 0, Bout arrondi
 *    (hair.taper, cap) ;
 * 3. yeux qui louchent vers le nez : Yeux › Strabisme (eyes.cross), Liseré ;
 * 4. corps moins noir que les poils et flou, poils qui y rentrent : Corps ›
 *    Flou du contour, Noirceur du corps ; Poils › Noirceur des poils, Poils
 *    sur le corps, Jusqu'où ils rentrent (body.blur, darkness, hair.ink,
 *    over, inner) ; le duvet devient alors de fines stries d'encre ;
 * 5. pieds et mains = trois bouts très fins : Membres › Doigts fins 3,
 *    Pieds / orteils, Mains / doigts, Éventail, Finesse (limbs.toes…).
 * Le Labo a un « Gros plan » (case Code) cadré comme le plan du film.
 */
import { DEFAULT_SOOT_PARAMS, cloneParams, type SootSpriteParams } from './params';

/** Paramètres d'avant les nouveaux champs → rendu de l'ancien moteur. */
export function legacy(p: SootSpriteParams): SootSpriteParams {
  const out = cloneParams(p);
  out.body.blur = 0;
  Object.assign(out.hair, { taper: 1, cap: 0, over: 0, inner: 0.5, ink: out.body.darkness });
  out.eyes.cross = 0;
  out.eyes.ring = 0;
  Object.assign(out.limbs, { bow: 1, mirror: 0, knee: 0.5, stance: 0.225, toes: 0, spread: 1.2, fine: 0.5 });
  return out;
}

/** Ancien modèle visé : disque très noir, halo dense de poils courts sous le disque. */
const VISE: SootSpriteParams = legacy({
  ...cloneParams(DEFAULT_SOOT_PARAMS),
  body: { ...DEFAULT_SOOT_PARAMS.body, radius: 0.86, ratio: 0.97, wobble: 0.022, darkness: 0.94, sheen: 0.12 },
  hair: {
    ...DEFAULT_SOOT_PARAMS.hair,
    count: 150,
    rootOut: 0.98,
    depth: 0.1,
    lenMin: 0.1,
    lenMax: 0.2,
    jitter: 0.08,
    width: 0.034,
    opacity: 1,
    bend: 0,
    tufts: 0,
    under: 0.3,
    fuzz: 0.6,
    fuzzLen: 0.75,
    fuzzAlpha: 0.45,
    tone: 0.05,
  },
  eyes: { ...DEFAULT_SOOT_PARAMS.eyes, size: 0.18, aspect: 1.2, gap: 0.27, lift: 0.07, pupil: 0.062, blink: 1, lid: 0.18, turn: 0.1 },
  limbs: { ...DEFAULT_SOOT_PARAMS.limbs, legs: 0.3, arms: 0.36, width: 0.07, feet: 0.09, hands: 0.05, hip: 0.36, shoulder: 0.84 },
  shadow: { opacity: 0.85, width: 1.9, height: 0.22 },
});

/** Le réglage d'Arthur (« le plus proche que j'ai pu faire »), ancien moteur. */
const ARTHUR_V1: SootSpriteParams = legacy({
  ...cloneParams(VISE),
  body: { ...VISE.body, radius: 0.5, ratio: 1, wobble: 0.022, darkness: 0.85, sheen: 0.12 },
  hair: {
    ...VISE.hair,
    count: 40,
    rootOut: 0.825,
    depth: 0.17,
    lenMin: 0.575,
    lenMax: 0.78,
    jitter: 0.095,
    width: 0.05,
    opacity: 1,
    bend: 0,
    tufts: 0.36,
    under: 0.3,
    fuzz: 0,
    fuzzLen: 0.9,
    fuzzAlpha: 0.45,
    tone: 0.05,
  },
  eyes: { ...VISE.eyes, size: 0.166, aspect: 1.17, gap: 0.225, lift: 0.035, pupil: 0.042, blink: 1, lid: 0.18, turn: 0.1 },
  limbs: { ...VISE.limbs, legs: 0.5, arms: 0.6, width: 0.038, feet: 0.042, hands: 0.038, hip: 0.36, shoulder: 0.84 },
  shadow: { opacity: 1.5, width: 2, height: 0.22 },
});

/** Au plus près du plan du film (gros plan) : poils et membres plus fins, jambes plus longues. */
const FILM: SootSpriteParams = {
  ...cloneParams(DEFAULT_SOOT_PARAMS),
  hair: { ...DEFAULT_SOOT_PARAMS.hair, width: 0.024 },
  eyes: { ...DEFAULT_SOOT_PARAMS.eyes, size: 0.17 },
  limbs: { ...DEFAULT_SOOT_PARAMS.limbs, legs: 0.66, width: 0.034 },
};

export type PresetId = 'defaut' | 'film' | 'arthurV1' | 'vise' | 'porcEpic' | 'ronces';

export const SOOT_PRESETS: Record<PresetId, SootSpriteParams> = {
  defaut: DEFAULT_SOOT_PARAMS,
  film: FILM,
  arthurV1: ARTHUR_V1,
  vise: VISE,
  /** Aiguilles radiales trop longues. */
  porcEpic: {
    ...cloneParams(VISE),
    body: { ...VISE.body, radius: 0.74, ratio: 1, wobble: 0.04, darkness: 0.92, sheen: 0.1 },
    hair: { ...VISE.hair, count: 520, rootOut: 0.95, depth: 0.2, lenMin: 0.18, lenMax: 0.42, jitter: 0.12, width: 0.026, tufts: 0.5, fuzz: 0.5, fuzzLen: 1.3, ink: 0.92 },
    eyes: { ...VISE.eyes, size: 0.195, gap: 0.28, lift: 0.08, pupil: 0.068 },
    limbs: { ...VISE.limbs, legs: 0.4, arms: 0.48, width: 0.1, feet: 0.156, hands: 0.08 },
  },
  /** Poils courbes emmêlés. */
  ronces: {
    ...cloneParams(VISE),
    body: { ...VISE.body, radius: 0.72, ratio: 1, wobble: 0.05, darkness: 0.9, sheen: 0.05 },
    hair: { ...VISE.hair, count: 380, rootOut: 0.95, depth: 0.25, lenMin: 0.2, lenMax: 0.5, jitter: 0.5, width: 0.018, bend: 0.9, fuzz: 1, fuzzLen: 1.4, ink: 0.9 },
    anim: { ...VISE.anim, wave: 1.8 },
  },
};
