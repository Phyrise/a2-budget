/**
 * Noiraudes (susuwatari) dessinées par le code — module réutilisable.
 *
 * - `createSusuwatariLayer(canvas, options)` : une toile, sa boucle, ses
 *   sprites pré-rendus ; `spawn` crée une Noiraude.
 * - `Susuwatari` : placer, regarder (`lookAt`), marcher vers (`walkTo`),
 *   rebondir (`bounce`), trembler (`shiver`), s'enfuir (`flee`), dormir
 *   (`sleep` / `wake`), se tenir debout (`stand`), lever les bras (`setArms`).
 * Voir layer.ts (calque), creature.ts (état et physique), draw.ts (dessin),
 * sprites.ts et fur.ts (fourrure pré-rendue).
 */
export { createSusuwatariLayer, type SusuwatariLayer, type SusuwatariLayerOptions } from './layer';
export { Susuwatari, type ArmPose, type EyeMood, type Point, type Rect, type SusuwatariInit, type SusuwatariState } from './creature';
