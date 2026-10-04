/**
 * Projection AppState (core) → WorldState (monde). Pure, sans React.
 * Partagée par tous les écrans qui affichent la forêt.
 */
import {
  CREATURES,
  GROWTH_THRESHOLDS,
  localDateKey,
  vitalityState,
  type AppState,
} from '@a2/core';
import type { Mood, Season, WorldState } from './types';

/** Saison météorologique (hémisphère nord) d'après le mois local. */
export function seasonOf(now: Date): Season {
  const m = now.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function toWorldState(app: AppState, now: Date): WorldState {
  const forest = app.forest;
  const stage = Math.min(7, Math.max(1, forest.growthStage));
  const lo = GROWTH_THRESHOLDS[stage - 1] ?? 0;
  const hi = GROWTH_THRESHOLDS[stage];
  const growthProgress = hi === undefined ? 1 : Math.min(1, Math.max(0, (forest.lifetimeCare - lo) / (hi - lo)));
  const today = localDateKey(now);
  const lights = app.chores.completions
    .filter((c) => localDateKey(new Date(c.completedAt)) === today)
    .sort((x, y) => x.completedAt.localeCompare(y.completedAt))
    .map((c) => ({ id: c.id, who: c.doneBy ?? c.assignee }));
  return {
    stage,
    growthProgress,
    mood: vitalityState(forest.vitality) as Mood,
    paused: forest.paused,
    creatures: forest.unlockedCreatureIds,
    lights,
    season: seasonOf(now),
  };
}

/**
 * Aperçu du mode développeur : surcharge NON PERSISTANTE de ce que montre la
 * forêt (jamais écrite dans les données). Chaque champ absent garde la
 * valeur réelle. `lantern` (0..1) allume la lanterne de la scène.
 */
export interface WorldPreview {
  stage?: number;
  mood?: Mood;
  season?: Season;
  paused?: boolean;
  lantern?: number;
}

/** Vrai si l'aperçu change quelque chose (bandeau « Aperçu » visible). */
export function isPreviewActive(preview: WorldPreview | null): boolean {
  if (preview === null) return false;
  return (Object.keys(preview) as Array<keyof WorldPreview>).some((k) => preview[k] !== undefined);
}

/**
 * Applique un aperçu à l'état réel. Un stade forcé montre les créatures de
 * ce stade (et seulement elles), à mi-chemin du stade suivant. Pure.
 */
export function applyPreview(state: WorldState, preview: WorldPreview | null): WorldState {
  if (!isPreviewActive(preview) || preview === null) return state;
  const next: WorldState = { ...state };
  if (preview.stage !== undefined) {
    const stage = Math.min(7, Math.max(1, Math.round(preview.stage)));
    next.stage = stage;
    next.growthProgress = stage === state.stage ? state.growthProgress : stage >= 7 ? 1 : 0.5;
    next.creatures = CREATURES.filter((c) => c.stage <= stage).map((c) => c.id);
  }
  if (preview.mood !== undefined) next.mood = preview.mood;
  if (preview.season !== undefined) next.season = preview.season;
  if (preview.paused !== undefined) next.paused = preview.paused;
  return next;
}
