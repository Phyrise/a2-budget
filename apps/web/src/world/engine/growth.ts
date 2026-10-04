/**
 * Changement de stade : charge la peinture suivante puis lance la dissolution
 * organique (3,6 s en direct, 0,7 s en « immobile », immédiate sinon).
 */
import type { GrowthStage } from '../types';
import { now, type WorldEngine } from './Engine';

export const GROW_SECONDS = 3.6;

export async function changeStage(e: WorldEngine, stage: GrowthStage) {
  if (e.loadingStage === stage) return;
  e.loadingStage = stage;
  try {
    const st = await e.res.loadStage(stage);
    if (e.isDestroyed || e.loadingStage !== stage) {
      e.res.free(st.color);
      e.res.free(st.depth);
      return;
    }
    e.disposePrev();
    const smooth = e.animated || (e.cfg.motion === 'still' && e.cfg.live);
    if (smooth && e.stage) {
      e.prev = e.stage;
      e.growStart = now();
      e.growDur = e.animated ? GROW_SECONDS : 0.7;
    } else if (e.stage) {
      e.res.free(e.stage.color);
      e.res.free(e.stage.depth);
    }
    e.stage = st;
    e.requestFrame(true);
  } catch {
    /* échec de chargement : on garde le stade affiché */
  } finally {
    if (e.loadingStage === stage) e.loadingStage = null;
  }
}
