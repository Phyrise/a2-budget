/**
 * Noiraudes (susuwatari) dessinées par le code — module réutilisable.
 *
 * - `createSusuwatariLayer(canvas, options)` : une toile, sa boucle, ses
 *   sprites pré-rendus ; `spawn` crée une Noiraude.
 * - `Susuwatari` : placer, regarder (`lookAt`), marcher vers (`walkTo`),
 *   rebondir (`bounce`), trembler (`shiver`), s'enfuir (`flee`), dormir
 *   (`sleep` / `wake`), se tenir debout (`stand`), lever les bras (`setArms`),
 *   suivre le défilement (`shift`) ; `alpha`, `held`, `gold`, `strain`.
 * - `SootSpriteParams` : toute l'apparence (corps, poils, yeux, membres,
 *   ombre, frisottis) en un objet ; `DEFAULT_SOOT_PARAMS` est le modèle par
 *   défaut, `SOOT_PRESETS` les autres (film, réglage d'Arthur, anciens essais).
 * Voir layer.ts (calque), creature.ts (état et physique), draw.ts et
 * limbs.ts (dessin), sprites.ts, fur.ts et cache.ts (fourrure pré-rendue),
 * params.ts et paramsText.ts (apparence, copier / coller).
 */
export { createSusuwatariLayer, type SusuwatariLayer, type SusuwatariLayerOptions } from './layer';
export { Susuwatari } from './creature';
export { bodyMatrix } from './draw';
export { apply as applyMatrix, type BodyMatrix } from './limbs';
export type { ArmPose, EyeMood, Point, Rect, SusuwatariInit, SusuwatariState } from './types';
export {
  DEFAULT_SOOT_PARAMS,
  cloneParams,
  normalizeParams,
  spriteKey,
  type ParamGroup,
  type SootSpriteParams,
} from './params';
export { SOOT_PRESETS, legacy, type PresetId } from './presets';
export { formatParams, parseParams } from './paramsText';
