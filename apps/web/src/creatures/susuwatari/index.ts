/**
 * Noiraudes (susuwatari) dessinées par le code — module réutilisable.
 *
 * - `createSusuwatariLayer(canvas, options)` : une toile, sa boucle, ses
 *   sprites pré-rendus ; `spawn` crée une Noiraude.
 * - `Susuwatari` : placer, regarder (`lookAt`), marcher vers (`walkTo`),
 *   rebondir (`bounce`), trembler (`shiver`), s'enfuir (`flee`), dormir
 *   (`sleep` / `wake`), se tenir debout (`stand`), lever les bras (`setArms`).
 * - `SootSpriteParams` : toute l'apparence (corps, poils, yeux, membres,
 *   ombre, frisottis) en un objet ; `DEFAULT_SOOT_PARAMS` est le modèle visé.
 * Voir layer.ts (calque), creature.ts (état et physique), draw.ts et
 * limbs.ts (dessin), sprites.ts, fur.ts et cache.ts (fourrure pré-rendue),
 * params.ts et paramsText.ts (apparence, copier / coller).
 */
export { createSusuwatariLayer, type SusuwatariLayer, type SusuwatariLayerOptions } from './layer';
export { Susuwatari } from './creature';
export type { ArmPose, EyeMood, Point, Rect, SusuwatariInit, SusuwatariState } from './types';
export {
  DEFAULT_SOOT_PARAMS,
  SOOT_PRESETS,
  cloneParams,
  normalizeParams,
  spriteKey,
  type ParamGroup,
  type SootSpriteParams,
} from './params';
export { formatParams, parseParams } from './paramsText';
