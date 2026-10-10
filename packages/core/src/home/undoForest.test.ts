/**
 * Annuler une tâche : ce qui revient dans la forêt, et ce qui reste.
 *
 * - Revient : le fait Maison (donc la luciole du jour, projetée depuis les
 *   faits) et l'objectif de la semaine (il ne compte que les crédits
 *   « active » ; le crédit annulé passe en tombstone).
 * - Reste (voulu, documenté dans forest.ts) : soins cumulés, vitalité,
 *   stade, créatures et décors débloqués, série, gardien. La forêt ne
 *   recule jamais ; le crédit annulé compte toujours pour le plafond du
 *   jour, si bien que cocher/annuler en boucle ne fait rien gagner.
 */
import { describe, expect, it } from 'vitest';
import { emptyAppState } from './appState.js';
import { toggleTaskToday, undoCompletion } from './choreActions.js';
import { GROWTH_THRESHOLDS, GUARDIAN_STREAK } from './forest.js';
import { weeklyCareGoal } from './forestProgress.js';
import { createTask } from './tasks.js';
import type { AppState } from './types.js';

const NOW = new Date(2026, 9, 15, 10, 0, 0); // jeudi 15 octobre 2026
const LATER = new Date(2026, 9, 15, 10, 5, 0);

const daily = { id: 'daily', title: 'Vaisselle', assignee: 'a', recurrence: 'daily' } as const;
const courses = { id: 'courses', title: 'Courses', assignee: 'both', recurrence: 'none', groceries: true } as const;

function stateWith(...tasks: Parameters<typeof createTask>[0][]): AppState {
  const state = emptyAppState();
  state.chores.tasks = tasks.map((t) => createTask(t, '2026-10-01'));
  return state;
}

/** Deux soins déjà faits aujourd'hui (autres tâches) : le troisième fait une « journée pleine ». */
function withTwoCreditsToday(state: AppState): AppState {
  return {
    ...state,
    forest: {
      ...state.forest,
      lifetimeCare: 2,
      vitality: 24,
      lastMeaningfulActionDate: '2026-10-15',
      lastProcessedDay: '2026-10-15',
      currentStreak: 1,
      longestStreak: 1,
      creditLedger: {
        'x|2026-10-15': { grantedOn: '2026-10-15', status: 'active' },
        'y|2026-10-15': { grantedOn: '2026-10-15', status: 'active' },
      },
    },
  };
}

describe('annuler une tâche — objectif de la semaine', () => {
  it('décocher (Maison, Calendrier) : compteur et palier reviennent à leur valeur d’avant', () => {
    const before = withTwoCreditsToday(stateWith(daily));
    const goalBefore = weeklyCareGoal(before.forest, NOW);
    expect(goalBefore).toMatchObject({ creditsThisWeek: 2, creditsToday: 2, level: 'resting' });

    const done = toggleTaskToday(before, 'daily', NOW, 'c1');
    expect(weeklyCareGoal(done.state.forest, NOW)).toMatchObject({ creditsThisWeek: 3, creditsToday: 3, level: 'good' });

    const undone = toggleTaskToday(done.state, 'daily', LATER, 'c2');
    expect(undone.completed).toBe(false);
    const goalAfter = weeklyCareGoal(undone.state.forest, LATER);
    expect(goalAfter.creditsThisWeek).toBe(goalBefore.creditsThisWeek);
    expect(goalAfter.creditsToday).toBe(goalBefore.creditsToday);
    expect(goalAfter.level).toBe(goalBefore.level);
    expect(goalAfter.progress).toBe(goalBefore.progress);
  });

  it('undoCompletion (Courses, toast « Annuler ») : même retour, l’autre fait du jour reste compté', () => {
    const before = withTwoCreditsToday(stateWith(courses));
    const first = toggleTaskToday(before, 'courses', NOW, 'k1');
    // Le plafond (3) est atteint : la seconde fois est enregistrée sans crédit.
    const second = toggleTaskToday(first.state, 'courses', LATER, 'k2');
    expect(second.state.chores.completions.map((c) => c.id)).toEqual(['k1', 'k2']);
    const undoSecond = undoCompletion(second.state, 'k2', LATER);
    expect(undoSecond.state.chores.completions.map((c) => c.id)).toEqual(['k1']);
    expect(weeklyCareGoal(undoSecond.state.forest, LATER).creditsThisWeek).toBe(3);
    const undoFirst = undoCompletion(undoSecond.state, 'k1', LATER);
    expect(undoFirst.state.chores.completions).toEqual([]);
    expect(weeklyCareGoal(undoFirst.state.forest, LATER)).toMatchObject({ creditsThisWeek: 2, level: 'resting' });
  });

  it('recocher après une annulation ne redonne pas le soin (pas de boucle à crédits)', () => {
    const before = withTwoCreditsToday(stateWith(daily));
    const done = toggleTaskToday(before, 'daily', NOW, 'c1');
    const undone = toggleTaskToday(done.state, 'daily', LATER, 'c2');
    const redone = toggleTaskToday(undone.state, 'daily', LATER, 'c3');
    expect(redone.completed).toBe(true);
    expect(weeklyCareGoal(redone.state.forest, LATER).creditsThisWeek).toBe(2);
    expect(redone.state.forest.lifetimeCare).toBe(3);
  });
});

describe('annuler une tâche — croissance (la forêt ne recule jamais)', () => {
  it('soin cumulé et vitalité restent acquis', () => {
    const before = withTwoCreditsToday(stateWith(daily));
    const done = toggleTaskToday(before, 'daily', NOW, 'c1');
    expect(done.state.forest).toMatchObject({ lifetimeCare: 3, vitality: 36 });
    const undone = toggleTaskToday(done.state, 'daily', LATER, 'c2');
    expect(undone.state.forest).toMatchObject({ lifetimeCare: 3, vitality: 36 });
  });

  it('un passage de stade (et sa créature) n’est pas repris par l’annulation', () => {
    const base = stateWith(daily);
    const threshold = GROWTH_THRESHOLDS[1]!; // stade 2
    const before: AppState = {
      ...base,
      forest: { ...base.forest, lifetimeCare: threshold - 1, lastProcessedDay: '2026-10-15' },
    };
    const done = toggleTaskToday(before, 'daily', NOW, 'c1');
    expect(done.state.forest.growthStage).toBe(2);
    expect(done.state.forest.unlockedCreatureIds).toContain('seed-spirit');
    const undone = undoCompletion(done.state, 'c1', LATER);
    expect(undone.state.forest.growthStage).toBe(2);
    expect(undone.state.forest.lifetimeCare).toBe(threshold);
    expect(undone.state.forest.unlockedCreatureIds).toContain('seed-spirit');
  });

  it('la visite du gardien reste enregistrée, la série aussi', () => {
    const base = stateWith(daily);
    const before: AppState = {
      ...base,
      forest: {
        ...base.forest,
        currentStreak: GUARDIAN_STREAK - 1,
        longestStreak: GUARDIAN_STREAK - 1,
        lastMeaningfulActionDate: '2026-10-14',
        lastProcessedDay: '2026-10-14',
      },
    };
    const done = toggleTaskToday(before, 'daily', NOW, 'c1');
    expect(done.state.forest).toMatchObject({ lastRareEvent: 'guardian', currentStreak: GUARDIAN_STREAK });
    const undone = toggleTaskToday(done.state, 'daily', LATER, 'c2');
    expect(undone.state.forest).toMatchObject({ lastRareEvent: 'guardian', currentStreak: GUARDIAN_STREAK });
  });
});
