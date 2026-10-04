/**
 * Projection AppState (core) → WorldState (monde). Pure, sans React.
 * Partagée par tous les écrans qui affichent la forêt.
 */
import {
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
