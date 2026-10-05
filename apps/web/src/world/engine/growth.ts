/**
 * Changement de peinture : stade (croissance) et / ou saison.
 *
 * On charge et décode la seule peinture utile, puis on lance la dissolution :
 * - croissance : organique, partant des racines (3,6 s en direct) ;
 * - saison seule : bruitée, du haut de la canopée vers le sol (2,6 s) ;
 * 0,7 s en « immobile », immédiate en image fixe. L'ancienne peinture reste
 * affichée tant que la nouvelle n'est pas prête (jamais d'écran noir).
 * Peinture de saison indisponible : la base du même stade (précachée) la
 * remplace et le moteur réessaie plus tard (retour du réseau, délai croissant).
 */
import type { GrowthStage, Season } from '../types';
import { seasonOf } from '../worldState';
import { clampStage, now, type WorldEngine } from './Engine';
import { retargetGrade } from './grade';
import { prefetchIdle } from './loader';
import { nightLutUrl, paintSeason, SEASON_FADE_SECONDS, stageImage } from './paint';

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
    const same = !!e.stage && e.stage.stage === st.stage && e.stage.season === st.season;
    if (e.isDestroyed || e.loadingKey !== key || same) {
      // Abandonné, ou repli sur la base déjà affichée : rien à fondre.
      e.res.free(st.color);
      e.res.free(st.depth);
      if (same && !e.isDestroyed) settlePainting(e, st.season === season);
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
    settlePainting(e, st.season === season);
    e.requestFrame(true);
  } catch {
    /* échec complet (base comprise) : on garde la peinture affichée, nouvel essai plus tard */
    if (!e.isDestroyed) settlePainting(e, false);
  } finally {
    if (e.loadingKey === key) e.loadingKey = null;
  }
}

/** Nouvel essai d'une peinture de saison indisponible : délai croissant (s). */
const RETRY_MIN_S = 10;
const RETRY_MAX_S = 300;

/**
 * Fin d'un chargement de peinture : `ok` = la saison voulue est peinte.
 * Sinon (repli sur la base, ou échec), nouvel essai après un délai croissant
 * (10 s → 5 min), ou dès le retour du réseau (input.ts → retryPainting).
 */
export function settlePainting(e: WorldEngine, ok: boolean) {
  window.clearTimeout(e.retry.timer);
  e.retry.timer = 0;
  if (ok) {
    e.retry.delay = 0;
    return;
  }
  if (e.isDestroyed) return;
  const delay = e.retry.delay || RETRY_MIN_S;
  e.retry.delay = Math.min(RETRY_MAX_S, delay * 2);
  e.retry.timer = window.setTimeout(() => retryPainting(e), delay * 1000);
}

/** Recharge la peinture voulue si celle affichée n'y correspond pas (repli, échec). */
export function retryPainting(e: WorldEngine, resetDelay = false) {
  if (resetDelay) e.retry.delay = 0;
  if (!e.stage || e.isDestroyed || !e.state) return;
  const stage = clampStage(e.state.stage);
  const season = e.wantedSeason;
  if (stage !== e.stage.stage || season !== e.stage.season) void changePainting(e, stage, season);
}

const nightLutFor = (e: WorldEngine, season: Season) => (e.state?.paused ? nightLutUrl(e.cfg.manifest, season) : null);

/**
 * Précharge (au repos, hors Save-Data) la peinture du stade suivant, même
 * saison — seulement pour la saison réelle (pas pendant un aperçu de saison
 * du mode développeur, qui ne doit rien laisser dans le cache des saisons).
 */
export function prefetchNext(e: WorldEngine) {
  const st = e.stage;
  if (!st || st.stage >= 7) return;
  const m = e.cfg.manifest;
  if (st.season !== paintSeason(m, seasonOf(new Date()))) return;
  prefetchIdle(stageImage(m, (st.stage + 1) as GrowthStage, st.season).color);
}
