/**
 * Mode développeur — actions sur les données (même sémantique que les
 * autres : transition PURE via `transact`). Synchronisé : la différence part
 * comme tout geste (suppression douce), chez les deux en temps réel.
 */
import { useCallback, useMemo } from 'react';
import { weekStartKey } from '@a2/core';
import { ritualWeek } from '../features/rituals/ritualText';
import type { Transact } from './careActions';

export interface DevActions {
  /** Efface le cercle de la semaine (parts des deux et cercle à deux) ; rend le nombre effacé. */
  clearWeekLetters: () => number;
}

export function useDevActions(transact: Transact): DevActions {
  const clearWeekLetters = useCallback((): number => {
    const now = new Date();
    // Le lundi, le cercle est encore celui de la semaine d'avant : les deux semaines sont visées.
    const weeks = new Set([ritualWeek(now).weekStart, weekStartKey(now)]);
    return transact<number>((s) => {
      const circles = s.rituals?.circles ?? [];
      const kept = circles.filter((c) => !weeks.has(c.weekStart));
      if (kept.length === circles.length) return { state: s, result: 0 };
      return { state: { ...s, rituals: { ...s.rituals, circles: kept } }, result: circles.length - kept.length };
    }, 0);
  }, [transact]);

  return useMemo(() => ({ clearWeekLetters }), [clearWeekLetters]);
}
