/**
 * Lecture seule de la forêt (V3.2) : progression détaillée (pour le mode
 * développeur) et objectif de la semaine (pour une phrase bienveillante).
 *
 * L'OBJECTIF DE LA SEMAINE N'EST JAMAIS UNE SANCTION. Il dit seulement
 * comment la forêt a été choyée cette semaine : « au repos », « dans le
 * bon », « florissante ». Le niveau le plus bas s'appelle `resting` (la
 * forêt se repose) : la forêt ne meurt jamais, ne rougit jamais, et aucune
 * dette ne se reporte d'une semaine sur l'autre. L'interface en tire une
 * phrase douce, jamais un reproche ni une comparaison entre les deux.
 *
 * Les nombres renvoyés restent internes : seul le mode développeur les
 * affiche (pour régler les constantes ensemble), l'interface normale n'en
 * montre que des états qualitatifs. Fonctions pures.
 */

import { addDays, isValidLocalDateKey, localDateKey, startOfWeek } from './dates.js';
import {
  creditsGrantedOn,
  DAILY_CREDIT_CAP,
  GROWTH_THRESHOLDS,
  VITALITY_MAX,
  vitalityState,
} from './forest.js';
import type { ForestState, VitalityState } from './types.js';

// ---------------------------------------------------------------------------
// Progression (mode développeur)
// ---------------------------------------------------------------------------

export interface ForestProgress {
  /** Stade permanent affiché (1..GROWTH_THRESHOLDS.length). */
  stage: number;
  /** Soins cumulés (crédits accordés depuis toujours). */
  lifetimeCare: number;
  /** Seuil de lifetimeCare du stade actuel. */
  stageFloor: number;
  /** Seuil du stade suivant (null au dernier stade). */
  nextThreshold: number | null;
  /** Avancée vers le stade suivant, 0..1 (1 au dernier stade). */
  progressToNext: number;
  /** Crédits comptés pour le plafond aujourd'hui (actifs + annulés). */
  creditsToday: number;
  /** Plafond quotidien (DAILY_CREDIT_CAP). */
  dailyCap: number;
  /** Vitalité court terme 0..VITALITY_MAX. */
  vitality: number;
  vitalityMax: number;
  vitalityState: VitalityState;
  currentStreak: number;
  longestStreak: number;
  /** Maison en pause. */
  paused: boolean;
}

function dayKey(day: Date | string): string | null {
  if (typeof day === 'string') return isValidLocalDateKey(day) ? day : null;
  return Number.isNaN(day.getTime()) ? null : localDateKey(day);
}

/**
 * Tous les chiffres cachés de la forêt, pour le jour local `today` (Date ou
 * clé « YYYY-MM-DD »). Ne modifie rien.
 */
export function forestProgress(forest: ForestState, today: Date | string): ForestProgress {
  const last = GROWTH_THRESHOLDS.length;
  const stage = Math.min(last, Math.max(1, forest.growthStage));
  const stageFloor = GROWTH_THRESHOLDS[stage - 1] ?? 0;
  const nextThreshold = stage < last ? GROWTH_THRESHOLDS[stage]! : null;
  const progressToNext = nextThreshold === null
    ? 1
    : Math.min(1, Math.max(0, (forest.lifetimeCare - stageFloor) / (nextThreshold - stageFloor)));
  const key = dayKey(today);
  return {
    stage,
    lifetimeCare: forest.lifetimeCare,
    stageFloor,
    nextThreshold,
    progressToNext,
    creditsToday: key === null ? 0 : creditsGrantedOn(forest, key),
    dailyCap: DAILY_CREDIT_CAP,
    vitality: forest.vitality,
    vitalityMax: VITALITY_MAX,
    vitalityState: vitalityState(forest.vitality),
    currentStreak: forest.currentStreak,
    longestStreak: forest.longestStreak,
    paused: forest.paused,
  };
}

// ---------------------------------------------------------------------------
// Objectif de la semaine (bienveillant)
// ---------------------------------------------------------------------------

/** Objectif par défaut : 12 crédits = 4 jours de soins pleins (3 × 4). */
export const WEEKLY_GOAL_TARGET = 12;

/**
 * Seuils (crédits « active » de la semaine) de chaque niveau, pour l'objectif
 * par défaut : au repos < 5, dans le bon 5–11, florissante ≥ 12.
 */
export const WEEKLY_GOAL_LEVELS = { resting: 0, good: 5, flourishing: 12 } as const;

export type WeeklyGoalLevel = 'resting' | 'good' | 'flourishing';
export type WeeklyGoalTrend = 'rising' | 'steady' | 'resting';

export interface WeeklyGoalOptions {
  /**
   * Objectif (crédits) ; défaut WEEKLY_GOAL_TARGET. Le seuil « dans le bon »
   * suit la même proportion (5/12, au moins 1).
   */
  target?: number;
  /**
   * Vitalité au début de la semaine, si l'appelant l'a mémorisée : la
   * tendance compare alors la vitalité actuelle à celle-ci. Sinon (cas
   * général : l'état ne garde pas d'instantané), elle compare les soins de
   * cette semaine à ceux de la semaine précédente sur le même nombre de jours.
   */
  weekStartVitality?: number;
}

export interface WeeklyCareGoal {
  /** Lundi et dimanche de la semaine locale « YYYY-MM-DD ». */
  weekStart: string;
  weekEnd: string;
  /** Crédits « active » accordés du lundi au dimanche de la semaine. */
  creditsThisWeek: number;
  /** Crédits « active » de la semaine précédente, du lundi au même jour de semaine. */
  previousWeekSameSpan: number;
  target: number;
  /** Seuil « dans le bon » effectivement utilisé. */
  goodFrom: number;
  /** Crédits « active » accordés aujourd'hui (plafonnés à DAILY_CREDIT_CAP). */
  creditsToday: number;
  /** Niveau de la semaine seule (crédits cumulés). */
  weekLevel: WeeklyGoalLevel;
  /**
   * Niveau affiché : le meilleur entre `weekLevel` et le plancher du jour
   * (une journée pleine, DAILY_CREDIT_CAP soins, vaut au moins « dans le bon »).
   */
  level: WeeklyGoalLevel;
  /** creditsThisWeek / target, borné à 0..1 (pour une jauge douce). */
  progress: number;
  trend: WeeklyGoalTrend;
}

function activeCreditsBetween(forest: ForestState, from: string, to: string): number {
  let count = 0;
  for (const credit of Object.values(forest.creditLedger)) {
    if (credit.status === 'active' && credit.grantedOn >= from && credit.grantedOn <= to) count += 1;
  }
  return count;
}

/**
 * Objectif de la semaine locale de `now` (lundi → dimanche). Jamais une
 * sanction : `resting` signifie « la forêt se repose », rien de plus ; une
 * journée pleine (DAILY_CREDIT_CAP soins aujourd'hui) relève le niveau
 * affiché à « dans le bon » au moins. Pur.
 */
export function weeklyCareGoal(forest: ForestState, now: Date, opts: WeeklyGoalOptions = {}): WeeklyCareGoal {
  const rawTarget = opts.target;
  const target = rawTarget !== undefined && Number.isFinite(rawTarget) && rawTarget >= 1
    ? Math.floor(rawTarget)
    : WEEKLY_GOAL_TARGET;
  const goodFrom = Math.max(1, Math.round((target * WEEKLY_GOAL_LEVELS.good) / WEEKLY_GOAL_LEVELS.flourishing));
  const monday = startOfWeek(now);
  const weekStart = localDateKey(monday);
  const weekEnd = localDateKey(addDays(monday, 6));
  const creditsThisWeek = activeCreditsBetween(forest, weekStart, weekEnd);
  const elapsed = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
    monday.getTime()) / 86_400_000);
  const prevStart = localDateKey(addDays(monday, -7));
  const prevSameDay = localDateKey(addDays(monday, -7 + Math.min(6, Math.max(0, elapsed))));
  const previousWeekSameSpan = activeCreditsBetween(forest, prevStart, prevSameDay);
  const weekLevel: WeeklyGoalLevel = creditsThisWeek >= target
    ? 'flourishing'
    : creditsThisWeek >= goodFrom ? 'good' : 'resting';
  const todayKey = localDateKey(now);
  const creditsToday = activeCreditsBetween(forest, todayKey, todayKey);
  // Une journée pleine ne laisse jamais lire « la forêt se repose ».
  const level: WeeklyGoalLevel = weekLevel === 'resting' && creditsToday >= DAILY_CREDIT_CAP ? 'good' : weekLevel;
  let trend: WeeklyGoalTrend;
  const start = opts.weekStartVitality;
  if (start !== undefined && Number.isFinite(start)) {
    trend = forest.vitality > start ? 'rising' : forest.vitality < start ? 'resting' : 'steady';
  } else if (creditsThisWeek > previousWeekSameSpan) {
    trend = 'rising';
  } else if (creditsThisWeek < previousWeekSameSpan || creditsThisWeek === 0) {
    trend = 'resting';
  } else {
    trend = 'steady';
  }
  return {
    weekStart,
    weekEnd,
    creditsThisWeek,
    previousWeekSameSpan,
    target,
    goodFrom,
    creditsToday,
    weekLevel,
    level,
    progress: Math.min(1, creditsThisWeek / target),
    trend,
  };
}
