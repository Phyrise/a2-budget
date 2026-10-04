import { describe, expect, it } from 'vitest';
import { emptyForest, grantCredit, tombstoneCredit, DAILY_CREDIT_CAP, GROWTH_THRESHOLDS } from './forest.js';
import { forestProgress, weeklyCareGoal, WEEKLY_GOAL_LEVELS, WEEKLY_GOAL_TARGET } from './forestProgress.js';
import type { ForestState } from './types.js';

/** Accorde `n` crédits le jour `day` (tâches distinctes). */
function care(forest: ForestState, day: string, n: number, prefix = 't'): ForestState {
  let f = forest;
  for (let i = 0; i < n; i += 1) f = grantCredit(f, `${prefix}${i}|${day}`, day).forest;
  return f;
}

describe('forestProgress', () => {
  it('forêt neuve : stade 1, 0 % vers le stade 2', () => {
    const p = forestProgress(emptyForest(), '2026-10-05');
    expect(p).toMatchObject({
      stage: 1, lifetimeCare: 0, stageFloor: 0, nextThreshold: GROWTH_THRESHOLDS[1], progressToNext: 0,
      creditsToday: 0, dailyCap: DAILY_CREDIT_CAP, vitality: 0, vitalityState: 'quiet', paused: false,
    });
  });

  it('calcule la progression vers le stade suivant', () => {
    const forest = { ...emptyForest(), lifetimeCare: 15, growthStage: 2 };
    const p = forestProgress(forest, '2026-10-05');
    expect(p.stageFloor).toBe(10);
    expect(p.nextThreshold).toBe(25);
    expect(p.progressToNext).toBeCloseTo(5 / 15);
  });

  it('dernier stade : pas de seuil suivant, progression pleine', () => {
    const last = GROWTH_THRESHOLDS.length;
    const p = forestProgress({ ...emptyForest(), lifetimeCare: 999, growthStage: last }, '2026-10-05');
    expect(p.nextThreshold).toBeNull();
    expect(p.progressToNext).toBe(1);
  });

  it('crédits du jour : actifs et annulés comptent pour le plafond (Date ou clé)', () => {
    let f = care(emptyForest(), '2026-10-05', 2);
    f = tombstoneCredit(f, 't0|2026-10-05').forest;
    expect(forestProgress(f, '2026-10-05').creditsToday).toBe(2);
    expect(forestProgress(f, new Date(2026, 9, 5, 23, 59)).creditsToday).toBe(2);
    expect(forestProgress(f, '2026-10-06').creditsToday).toBe(0);
    expect(forestProgress(f, 'pas une date').creditsToday).toBe(0);
  });

  it('ne mute pas la forêt', () => {
    const f = care(emptyForest(), '2026-10-05', 1);
    const frozen = structuredClone(f);
    forestProgress(f, '2026-10-05');
    expect(f).toEqual(frozen);
  });
});

describe('weeklyCareGoal (jamais une sanction)', () => {
  const sunday = new Date(2026, 9, 11, 18, 0); // dimanche 11 octobre 2026

  it('expose des seuils cohérents', () => {
    expect(WEEKLY_GOAL_TARGET).toBe(12);
    expect(WEEKLY_GOAL_LEVELS).toEqual({ resting: 0, good: 5, flourishing: 12 });
  });

  it('semaine calme : la forêt se repose', () => {
    const g = weeklyCareGoal(emptyForest(), sunday);
    expect(g).toMatchObject({
      weekStart: '2026-10-05', weekEnd: '2026-10-11', creditsThisWeek: 0, target: 12, goodFrom: 5,
      level: 'resting', progress: 0, trend: 'resting',
    });
  });

  it('niveaux : < 5 au repos, 5–11 dans le bon, ≥ 12 florissante', () => {
    let f = care(emptyForest(), '2026-10-05', 3);
    f = care(f, '2026-10-06', 1);
    expect(weeklyCareGoal(f, sunday).level).toBe('resting');
    f = care(f, '2026-10-07', 1);
    expect(weeklyCareGoal(f, sunday)).toMatchObject({ creditsThisWeek: 5, level: 'good' });
    f = care(f, '2026-10-08', 3);
    f = care(f, '2026-10-09', 3);
    expect(weeklyCareGoal(f, sunday).level).toBe('good'); // 11
    f = care(f, '2026-10-10', 1);
    expect(weeklyCareGoal(f, sunday)).toMatchObject({ creditsThisWeek: 12, level: 'flourishing', progress: 1 });
  });

  it('ne compte que les crédits actifs de la semaine locale (lundi → dimanche)', () => {
    let f = care(emptyForest(), '2026-10-04', 3, 'prev'); // dimanche précédent
    f = care(f, '2026-10-05', 3);
    f = tombstoneCredit(f, 't0|2026-10-05').forest;
    expect(weeklyCareGoal(f, sunday).creditsThisWeek).toBe(2);
    expect(weeklyCareGoal(f, new Date(2026, 9, 12, 8, 0)).creditsThisWeek).toBe(0); // lundi suivant
  });

  it('objectif configurable : le seuil « dans le bon » suit la proportion', () => {
    const f = care(emptyForest(), '2026-10-05', 3);
    expect(weeklyCareGoal(f, sunday, { target: 6 })).toMatchObject({ target: 6, goodFrom: 3, level: 'good', progress: 0.5 });
    expect(weeklyCareGoal(f, sunday, { target: 0 }).target).toBe(12);
    expect(weeklyCareGoal(f, sunday, { target: 1 })).toMatchObject({ goodFrom: 1, level: 'flourishing' });
  });

  it('tendance : comparée à la semaine précédente sur le même nombre de jours', () => {
    const wednesday = new Date(2026, 9, 7, 12, 0);
    let f = care(emptyForest(), '2026-09-28', 2, 'a'); // lundi précédent
    f = care(f, '2026-10-01', 3, 'b'); // jeudi précédent : hors fenêtre lun→mer
    f = care(f, '2026-10-05', 1);
    const g = weeklyCareGoal(f, wednesday);
    expect(g.previousWeekSameSpan).toBe(2);
    expect(g.trend).toBe('resting');
    f = care(f, '2026-10-06', 1, 'c');
    expect(weeklyCareGoal(f, wednesday).trend).toBe('steady');
    f = care(f, '2026-10-07', 1, 'd');
    expect(weeklyCareGoal(f, wednesday).trend).toBe('rising');
  });

  it('tendance par la vitalité quand celle du début de semaine est connue', () => {
    const f = { ...emptyForest(), vitality: 40 };
    expect(weeklyCareGoal(f, sunday, { weekStartVitality: 30 }).trend).toBe('rising');
    expect(weeklyCareGoal(f, sunday, { weekStartVitality: 40 }).trend).toBe('steady');
    expect(weeklyCareGoal(f, sunday, { weekStartVitality: 50 }).trend).toBe('resting');
  });
});
