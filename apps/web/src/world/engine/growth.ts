/**
 * Changement de peinture : stade (croissance) et / ou saison.
 *
 * On charge et décode la seule peinture utile, puis on lance la dissolution :
 * - croissance : organique, partant des racines (3,6 s en direct) ;
 * - saison seule : bruitée, du haut de la canopée vers le sol (2,6 s) ;
 * 0,7 s en « immobile », immédiate en image fixe. L'ancienne peinture reste
 * affichée tant que la nouvelle n'est pas prête (jamais d'écran noir) ; un
 * échec de chargement garde l'image courante.
 */
import type { GrowthStage, Season } from '../types';
import { now, type WorldEngine } from './Engine';
import { retargetGrade } from './grade';
import { prefetchIdle } from './loader';
import { nightLutUrl, SEASON_FADE_SECONDS, stageImage } from './paint';

export const GROW_SECONDS = 3.6;

/** 0 = croissance (depuis les racines), 1 = saison (voile bruité). */
export type FadeMode = 0 | 1;

const keyOf = (stage: GrowthStage, season: Season) => `${season}:${stage}`;

export async function changePainting(e: WorldEngine, stage: GrowthStage, season: Season) {
  const key = keyOf(stage, season);
  if (e.loadingKey === key) return;
  e.loadingKey = key;
  try {
    // La LUT de la saison peinte (nuit de saison) est prête au moment du fondu.
    const [st] = await Promise.all([e.res.loadStage(stage, season), e.res.loadLut(nightLutFor(e, season))]);
    if (e.isDestroyed || e.loadingKey !== key) {
      e.res.free(st.color);
      e.res.free(st.depth);
      return;
    }
    e.disposePrev();
    const smooth = e.animated || (e.cfg.motion === 'still' && e.cfg.live);
    const seasonOnly = !!e.stage && e.stage.stage === stage;
    if (smooth && e.stage) {
      e.prev = e.stage;
      e.growStart = now();
      e.fadeMode = seasonOnly ? 1 : 0;
      e.growDur = !e.animated ? 0.7 : seasonOnly ? SEASON_FADE_SECONDS : GROW_SECONDS;
    } else if (e.stage) {
      e.res.free(e.stage.color);
      e.res.free(e.stage.depth);
    }
    e.stage = st;
    // Étalonnage de la saison peinte (nuit de saison, LUT d'humeur atténuées) en même temps que le fondu.
    retargetGrade(e, false);
    prefetchNext(e);
    e.requestFrame(true);
  } catch {
    /* échec de chargement : on garde la peinture affichée */
  } finally {
    if (e.loadingKey === key) e.loadingKey = null;
  }
}

const nightLutFor = (e: WorldEngine, season: Season) => (e.state?.paused ? nightLutUrl(e.cfg.manifest, season) : null);

/** Précharge (au repos, hors Save-Data) la peinture du stade suivant, même saison. */
export function prefetchNext(e: WorldEngine) {
  const st = e.stage;
  if (!st || st.stage >= 7) return;
  prefetchIdle(stageImage(e.cfg.manifest, (st.stage + 1) as GrowthStage, st.season).color);
}
