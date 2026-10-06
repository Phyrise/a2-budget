/**
 * Actions V3 « Prendre soin ensemble » du store (passages, suggestions,
 * cercle de la semaine, lanternes). Même sémantique que les autres actions :
 * transition PURE via `transact` (ids et horloge capturés avant, sûr en
 * StrictMode), résultat synchrone, écriture sérialisée par le store.
 */
import { useCallback, useMemo } from 'react';
import {
  addFocusSession as coreAddFocusSession,
  findOccurrenceCompletion,
  isDueOn,
  saveCircle as coreSaveCircle,
  skipDateFor,
  skipOccurrence,
  unskipOccurrence,
  updateTask,
  weekStartKey,
  type AppState,
  type Circle,
  type ChoreDoer,
  type FocusSession,
  type HouseholdTask,
  type RebalanceSuggestion,
} from '@a2/core';
import { newId } from './ids';

/** Signature de `transact` (voir store.tsx). */
export type Transact = <R>(fn: (s: AppState) => { state: AppState; result: R }, fallback: R) => R;

/** Saisie d'un cercle de la semaine (id et heure posés par le store). */
export interface CircleInput {
  gratitude: Circle['gratitude'];
  burdens: Circle['burdens'];
  intentions: string[];
  /** Lundi « YYYY-MM-DD » ; défaut : la semaine en cours. */
  weekStart?: string;
}

/** Saisie d'une session de lanterne terminée. */
export interface FocusInput {
  /** Minutes entières 1..120. */
  minutes: number;
  who: ChoreDoer;
  label?: string;
  taskId?: string;
  /** Horodatage ISO du début ; défaut : maintenant − minutes. */
  startedAt?: string;
  /** false : arrêtée avant la fin (ne débloque pas de lanterne de pierre). */
  completed?: boolean;
}

export interface CareActions {
  /**
   * « Pas aujourd'hui » : passe l'occurrence du jour (de la semaine pour une
   * hebdomadaire souple). Ni crédit, ni pénalité. false si la tâche est
   * inconnue, non due aujourd'hui ou déjà faite. Idempotent.
   */
  skipToday: (task: HouseholdTask, by?: 'a' | 'b') => boolean;
  /** Annule « pas aujourd'hui ». false si rien n'était passé. */
  unskipToday: (task: HouseholdTask) => boolean;
  /** Applique une suggestion de rééquilibrage (rotate → tour à tour ; reassign → confier). */
  applySuggestion: (suggestion: RebalanceSuggestion) => boolean;
  /** Enregistre le cercle de la semaine (remplace celui de la même semaine). null si invalide. */
  saveCircle: (input: CircleInput) => Circle | null;
  /** Mémorise une lanterne terminée. null si invalide. */
  addFocusSession: (input: FocusInput) => FocusSession | null;
}

export function useCareActions(transact: Transact): CareActions {
  const skipToday = useCallback(
    (task: HouseholdTask, by?: 'a' | 'b'): boolean => {
      const now = new Date();
      const id = newId();
      return transact((s) => {
        const t = s.chores.tasks.find((x) => x.id === task.id);
        if (t === undefined || (t.recurrence !== 'none' && !isDueOn(t, now))) return { state: s, result: false };
        if (findOccurrenceCompletion(t, s.chores.completions, now) !== undefined) return { state: s, result: false };
        const r = skipOccurrence(s.chores.skips, {
          id,
          taskId: t.id,
          dueDate: skipDateFor(t, now),
          at: now.toISOString(),
          ...(by !== undefined ? { by } : {}),
        });
        if (!r.added) return { state: s, result: true };
        return { state: { ...s, chores: { ...s.chores, skips: r.skips } }, result: true };
      }, false);
    },
    [transact],
  );

  const unskipToday = useCallback(
    (task: HouseholdTask): boolean => {
      const now = new Date();
      return transact((s) => {
        const t = s.chores.tasks.find((x) => x.id === task.id) ?? task;
        const r = unskipOccurrence(s.chores.skips, t.id, skipDateFor(t, now));
        if (!r.removed) return { state: s, result: false };
        return { state: { ...s, chores: { ...s.chores, skips: r.skips } }, result: true };
      }, false);
    },
    [transact],
  );

  const applySuggestion = useCallback(
    (suggestion: RebalanceSuggestion): boolean =>
      transact((s) => {
        const patch =
          suggestion.kind === 'rotate'
            ? { rotation: true }
            : suggestion.to !== undefined
              ? { assignee: suggestion.to }
              : null;
        if (patch === null) return { state: s, result: false };
        try {
          const tasks = updateTask(s.chores.tasks, suggestion.taskId, patch);
          if (!s.chores.tasks.some((t) => t.id === suggestion.taskId)) return { state: s, result: false };
          return { state: tasks === s.chores.tasks ? s : { ...s, chores: { ...s.chores, tasks } }, result: true };
        } catch {
          return { state: s, result: false };
        }
      }, false),
    [transact],
  );

  const saveCircle = useCallback(
    (input: CircleInput): Circle | null => {
      const now = new Date();
      const id = newId();
      const weekStart = input.weekStart ?? weekStartKey(now);
      return transact<Circle | null>((s) => {
        const existing = s.rituals?.circles.find((c) => c.weekStart === weekStart);
        try {
          const rituals = coreSaveCircle(s.rituals, {
            id: existing?.id ?? id,
            weekStart,
            heldAt: now.toISOString(),
            gratitude: input.gratitude,
            burdens: input.burdens,
            intentions: input.intentions,
          });
          const saved = rituals.circles.find((c) => c.weekStart === weekStart) ?? null;
          return { state: { ...s, rituals }, result: saved };
        } catch {
          return { state: s, result: null };
        }
      }, null);
    },
    [transact],
  );

  const addFocusSession = useCallback(
    (input: FocusInput): FocusSession | null => {
      const now = new Date();
      const id = newId();
      const startedAt =
        input.startedAt ?? new Date(now.getTime() - Math.max(0, input.minutes) * 60_000).toISOString();
      return transact<FocusSession | null>((s) => {
        try {
          const r = coreAddFocusSession(s.focus, {
            id,
            startedAt,
            minutes: input.minutes,
            who: input.who,
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            ...(input.completed === false ? { completed: false } : {}),
          });
          const saved = r.focus.sessions.find((x) => x.id === id) ?? null;
          return { state: r.added ? { ...s, focus: r.focus } : s, result: saved };
        } catch {
          return { state: s, result: null };
        }
      }, null);
    },
    [transact],
  );

  // Objet stable : le contexte du store ne se recalcule pas à chaque rendu.
  return useMemo(
    () => ({ skipToday, unskipToday, applySuggestion, saveCircle, addFocusSession }),
    [skipToday, unskipToday, applySuggestion, saveCircle, addFocusSession],
  );
}
