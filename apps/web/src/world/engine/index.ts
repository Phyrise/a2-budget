/**
 * Point d'entrée du moteur, chargé paresseusement (import dynamique) par
 * <LivingForest> : ni OGL ni les shaders ne retardent la première peinture.
 */
export type { EngineConfig, EngineStats, QualitySetting } from './Engine';
export { WorldEngine } from './Engine';
export { bindKodamaTouch, previewKodama } from './kodamaTouch';
