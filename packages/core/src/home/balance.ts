/**
 * Équilibre de la semaine (V3) : une lecture **qualitative** de la charge
 * partagée, tournée vers l'entraide.
 *
 * ⚠️ weeklyBalance ne sert JAMAIS à afficher un classement, un score comparé
 * ou un « gagnant ». Les nombres `a`, `b`, `total` sont des intermédiaires de
 * calcul : l'interface n'affiche que le verdict (phrase bienveillante, visuel
 * qualitatif) et les suggestions applicables en un geste.
 */

import { completionsOfWeek, whoDid } from './tasks.js';
import type { ChoreCompletion, HouseholdTask } from './types.js';

/** Verdict qualitatif de la semaine. */
export type BalanceVerdict = 'quiet' | 'balanced' | 'a-carried' | 'b-carried';

/** Équilibre pondéré de la semaine (intermédiaires + verdict). */
export interface WeeklyBalance {
  /** Somme des efforts portés par A (« ensemble » compte moitié). */
  a: number;
  /** Somme des efforts portés par B (« ensemble » compte moitié). */
  b: number;
  /** a + b. */
  total: number;
  verdict: BalanceVerdict;
}

/** En dessous de ce total d'effort, la semaine est « calme » (aucun verdict). */
export const BALANCE_QUIET_BELOW = 3;
/** Écart relatif |a − b| / total au-delà duquel quelqu'un a « porté » plus. */
export const BALANCE_TOLERANCE = 0.25;

/**
 * Équilibre pondéré de la semaine ISO de `now` (faits par completedAt) :
 * somme des efforts (défaut 1 ; tâche supprimée → 1) par qui a fait
 * (`doneBy ?? assignee`) ; « ensemble » compte la moitié pour chacun ;
 * « non attribuée » est ignorée.
 * Verdict : 'quiet' si total < 3 ; 'balanced' si |a − b| / total ≤ 25 % ;
 * sinon 'a-carried' / 'b-carried' (la personne qui a porté le plus).
 */
export function weeklyBalance(
  tasks: HouseholdTask[],
  completions: ChoreCompletion[],
  now: Date,
): WeeklyBalance {
  const effortOf = new Map(tasks.map((t) => [t.id, t.effort ?? 1]));
  let a = 0;
  let b = 0;
  for (const c of completionsOfWeek(completions, now)) {
    const effort = effortOf.get(c.taskId) ?? 1;
    const who = whoDid(c);
    if (who === 'a') a += effort;
    else if (who === 'b') b += effort;
    else if (who === 'both') {
      a += effort / 2;
      b += effort / 2;
    }
  }
  const total = a + b;
  let verdict: BalanceVerdict;
  if (total < BALANCE_QUIET_BELOW) verdict = 'quiet';
  else if (Math.abs(a - b) / total <= BALANCE_TOLERANCE) verdict = 'balanced';
  else verdict = a > b ? 'a-carried' : 'b-carried';
  return { a, b, total, verdict };
}

/** Une suggestion de rééquilibrage, applicable en un geste. */
export interface RebalanceSuggestion {
  taskId: string;
  /** rotate → passer la tâche en tour à tour ; reassign → la confier à `to`. */
  kind: 'rotate' | 'reassign';
  /** reassign : la personne à qui confier la tâche. */
  to?: 'a' | 'b';
  /** Phrase française bienveillante, prête à afficher. */
  reason: string;
}

const NB = ' ';

/**
 * Suggestions de rééquilibrage (au plus `max`, défaut 3) quand une personne
 * a nettement porté plus cette semaine (verdict 'a-carried'/'b-carried') ;
 * vide sinon. Candidates : tâches récurrentes attribuées à cette personne,
 * pas déjà en tour à tour, les plus lourdes d'abord (effort, puis nombre de
 * fois faites cette semaine). Effort ≥ 2 → « tour à tour » ; effort 1 →
 * « confier à l'autre ». `names` (facultatif) personnalise les phrases.
 */
export function rebalanceSuggestions(
  tasks: HouseholdTask[],
  completions: ChoreCompletion[],
  now: Date,
  max = 3,
  names?: { a: string; b: string },
): RebalanceSuggestion[] {
  const { verdict } = weeklyBalance(tasks, completions, now);
  if (verdict !== 'a-carried' && verdict !== 'b-carried') return [];
  const heavy: 'a' | 'b' = verdict === 'a-carried' ? 'a' : 'b';
  const light: 'a' | 'b' = heavy === 'a' ? 'b' : 'a';
  const counts = new Map<string, number>();
  for (const c of completionsOfWeek(completions, now)) {
    if (whoDid(c) === heavy) counts.set(c.taskId, (counts.get(c.taskId) ?? 0) + 1);
  }
  const candidates = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.recurrence !== 'none' && task.rotation !== true && task.assignee === heavy)
    .sort(
      (x, y) =>
        (y.task.effort ?? 1) - (x.task.effort ?? 1) ||
        (counts.get(y.task.id) ?? 0) - (counts.get(x.task.id) ?? 0) ||
        x.index - y.index,
    );
  const limit = Math.max(0, Math.floor(max));
  return candidates.slice(0, limit).map(({ task }) => {
    const title = `«${NB}${task.title}${NB}»`;
    if ((task.effort ?? 1) >= 2) {
      return {
        taskId: task.id,
        kind: 'rotate' as const,
        reason: `Et si ${title} passait en tour à tour${NB}? Chacun son tour, sans avoir à y penser.`,
      };
    }
    const reason = names
      ? `${names[light]} pourrait prendre ${title} pour un temps — de quoi souffler un peu, ${names[heavy]}.`
      : `Confier ${title} à l'autre pour un temps${NB}? De quoi souffler un peu.`;
    return { taskId: task.id, kind: 'reassign' as const, to: light, reason };
  });
}
