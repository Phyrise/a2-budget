/**
 * Point d'entrée du moteur, chargé paresseusement (import dynamique) par
 * <LivingForest> : ni OGL ni les shaders ne retardent la première peinture.
 */
import { WorldEngine, type EngineConfig } from './Engine';
import type { WorldState } from '../types';

export type { EngineConfig, EngineStats, QualitySetting } from './Engine';
export { WorldEngine } from './Engine';


export async function createWorldEngine(
  canvas: HTMLCanvasElement,
  cfg: EngineConfig,
  state: WorldState,
  size: { w: number; h: number },
): Promise<WorldEngine> {
  const engine = new WorldEngine(canvas, cfg);
  engine.resize(size.w, size.h);
  try {
    await engine.init(state);
  } catch (err) {
    engine.destroy();
    throw err;
  }
  return engine;
}
