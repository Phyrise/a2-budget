/**
 * Forêt : état dérivé des événements de complétion Maison.
 *
 * Principes (voir le second prompt « living forest ») :
 * - La forêt **ne meurt jamais** : la croissance (lifetimeCare, growthStage,
 *   unlocks) est permanente et ne diminue jamais.
 * - La vitalité court terme fluctue doucement (monte avec les soins, décroît
 *   doucement sans activité).
 * - **Anti-spam** : au plus `DAILY_CREDIT_CAP` crédits significatifs par jour
 *   local. Créer/cocher 30 tâches ne fait pas farmer la croissance.
 * - Chaque crédit a une identité stable `(taskId, scheduledLocalDate)` ou
 *   `(taskId, once)`. Une seconde complétion du même événement est un no-op.
 * - Annuler met le crédit en **tombstone** (conservé, compte toujours pour le
 *   cap du jour) ; recompléter restaure le fait Maison mais ne redonne aucun
 *   crédit.
 * - La pause exclut les jours de pause (pas de décroissance, pas de pénalité
 *   de streak).
 *
 * Les nombres (vitalité, crédits, stades) sont **internes** : jamais exposés
 * en nombre à l'utilisateur. Fonctions pures : ne mutent jamais leurs entrées.
 */

import type {
  CreditKey,
  ForestState,
  PauseInterval,
  VitalityState,
} from './types.js';
import { addDays, localDateKey, parseLocalDateKey } from './dates.js';

// ---------------------------------------------------------------------------
// Constantes internes (jamais exposées)
// ---------------------------------------------------------------------------

export const VITALITY_MAX = 100;
/** Vitalité gagnée par crédit significatif. */
export const VITALITY_PER_CREDIT = 12;
/** Cap de crédits significatifs par jour local (anti-spam). */
export const DAILY_CREDIT_CAP = 3;
/** Décroissance douce de la vitalité par jour sans action. */
export const DAILY_DECAY = 6;
/** Streak (jours consécutifs) qui déclenche l'événement rare du gardien. */
export const GUARDIAN_STREAK = 10;

/** Seuil de vitalité pour chaque état qualitatif. */
export const VITALITY_STATE_THRESHOLDS: { state: VitalityState; min: number }[] = [
  { state: 'quiet', min: 0 },
  { state: 'peaceful', min: 25 },
  { state: 'lively', min: 50 },
  { state: 'flourishing', min: 75 },
];

/** Seuil de croissance (lifetimeCare) pour chaque stade permanent. */
export const GROWTH_THRESHOLDS: number[] = [0, 10, 25, 50, 100, 200, 400];

/** Créatures originales débloquées par stade (design à venir, ids stables). */
export const CREATURES: { id: string; stage: number }[] = [
  { id: 'moss-ling', stage: 1 },
  { id: 'seed-spirit', stage: 2 },
  { id: 'leaf-sprite', stage: 3 },
  { id: 'ember-wisp', stage: 4 },
  { id: 'mushroom-pip', stage: 5 },
  { id: 'water-drip', stage: 6 },
];

/** Éléments d'environnement originaux débloqués par stade. */
export const ENVIRONMENTS: { id: string; stage: number }[] = [
  { id: 'young-tree', stage: 1 },
  { id: 'larger-canopy', stage: 2 },
  { id: 'moss-patch', stage: 3 },
  { id: 'flowers', stage: 4 },
  { id: 'stream', stage: 5 },
  { id: 'pond', stage: 6 },
  { id: 'lanterns', stage: 7 },
];

// ---------------------------------------------------------------------------
// État initial
// ---------------------------------------------------------------------------

/** Forêt neuve : calme, jeune, aucun crédit, aucun déblocage. */
export function emptyForest(): ForestState {
  return {
    vitality: 0,
    lifetimeCare: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastMeaningfulActionDate: null,
    growthStage: 1,
    unlockedCreatureIds: [],
    unlockedEnvironmentIds: [],
    lastRareEvent: null,
    paused: false,
    pausedAt: null,
    pauses: [],
    creditLedger: {},
    lastProcessedDay: null,
  };
}

// ---------------------------------------------------------------------------
// Vitalité
// ---------------------------------------------------------------------------

/** État qualitatif de la vitalité (jamais de nombre affiché). */
export function vitalityState(vitality: number): VitalityState {
  let result: VitalityState = 'quiet';
  for (const t of VITALITY_STATE_THRESHOLDS) {
    if (vitality >= t.min) result = t.state;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Crédits (anti-spam)
// ---------------------------------------------------------------------------

/** Nombre de crédits accordés le `localDate` (actifs + tombstones). */
export function creditsGrantedOn(forest: ForestState, localDate: string): number {
  return Object.values(forest.creditLedger).filter(
    (c) => c.grantedOn === localDate,
  ).length;
}

/**
 * Accorde un crédit significatif si :
 * - la forêt n'est pas en pause,
 * - le crédit n'existe pas déjà (actif ou tombstone) → idempotent,
 * - le cap quotidien (`DAILY_CREDIT_CAP`) n'est pas atteint.
 *
 * Accroît `lifetimeCare` (croissance permanente) et la vitalité.
 * Pur : ne mute jamais `forest`.
 */
export function grantCredit(
  forest: ForestState,
  creditKey: CreditKey,
  completionLocalDate: string,
): { forest: ForestState; granted: boolean } {
  if (forest.paused) return { forest, granted: false };
  if (forest.creditLedger[creditKey] !== undefined) {
    return { forest, granted: false }; // idempotent (actif ou tombstone)
  }
  if (creditsGrantedOn(forest, completionLocalDate) >= DAILY_CREDIT_CAP) {
    return { forest, granted: false }; // cap quotidien atteint
  }
  const next: ForestState = {
    ...forest,
    creditLedger: {
      ...forest.creditLedger,
      [creditKey]: { grantedOn: completionLocalDate, status: 'active' },
    },
    lifetimeCare: forest.lifetimeCare + 1,
    vitality: Math.min(VITALITY_MAX, forest.vitality + VITALITY_PER_CREDIT),
  };
  return { forest: next, granted: true };
}

/**
 * Met un crédit en **tombstone** (annulation). Le crédit reste au ledger :
 * il compte toujours pour le cap du jour et ne redonnera rien si l'occurrence
 * est recomplétée. `lifetimeCare`, vitalité, stade et unlocks ne diminuent
 * jamais. Pur.
 */
export function tombstoneCredit(
  forest: ForestState,
  creditKey: CreditKey,
): { forest: ForestState; tombstoned: boolean } {
  const credit = forest.creditLedger[creditKey];
  if (credit === undefined || credit.status === 'tombstoned') {
    return { forest, tombstoned: false };
  }
  const next: ForestState = {
    ...forest,
    creditLedger: {
      ...forest.creditLedger,
      [creditKey]: { ...credit, status: 'tombstoned' },
    },
  };
  return { forest: next, tombstoned: true };
}

// ---------------------------------------------------------------------------
// Streak (jours consécutifs, jours de pause exclus)
// ---------------------------------------------------------------------------

/** Vrai si le jour `dayKey` est couvert par une pause. */
export function isDayPaused(pauses: PauseInterval[], dayKey: string): boolean {
  return pauses.some((p) => {
    if (dayKey < p.start) return false;
    if (p.end === null) return true; // pause toujours en cours
    return dayKey <= p.end;
  });
}

/**
 * Vrai si tous les jours strictement entre `lastDate` et `localDate` sont des
 * jours de pause (le gap est « ponté » par la pause).
 */
export function isGapFullyPaused(
  pauses: PauseInterval[],
  lastDate: string,
  localDate: string,
): boolean {
  let cursor = addDays(parseLocalDateKey(lastDate), 1);
  const end = parseLocalDateKey(localDate);
  while (cursor.getTime() < end.getTime()) {
    if (!isDayPaused(pauses, localDateKey(cursor))) return false;
    cursor = addDays(cursor, 1);
  }
  return true;
}

/**
 * Met à jour le streak après une action significative le `localDate`.
 * - Premier jour → 1.
 * - Même jour → inchangé.
 * - Gap entièrement ponctué de jours de pause → streak + 1 (ponté).
 * - Sinon → le streak repart à 1 (jour manqué non ponctué).
 * Met aussi à jour `longestStreak` et `lastMeaningfulActionDate`. Pur.
 */
export function updateStreak(forest: ForestState, localDate: string): ForestState {
  const last = forest.lastMeaningfulActionDate;
  let currentStreak: number;
  if (last === null) {
    currentStreak = 1;
  } else if (last === localDate) {
    currentStreak = forest.currentStreak;
  } else {
    currentStreak = isGapFullyPaused(forest.pauses, last, localDate)
      ? forest.currentStreak + 1
      : 1;
  }
  return {
    ...forest,
    currentStreak,
    longestStreak: Math.max(forest.longestStreak, currentStreak),
    lastMeaningfulActionDate: localDate,
  };
}

/**
 * Avance la forêt d'un jour (`localDate`) : décroissance douce de la vitalité
 * si aucune action ce jour-là, et cassure du streak si un jour non ponctué
 * passe sans action. **Idempotent par jour** (via `lastProcessedDay`).
 * En pause : aucun effet (la forêt est endormie). Pur.
 */
export function advanceDay(forest: ForestState, localDate: string): ForestState {
  if (forest.paused) return forest;
  if (forest.lastProcessedDay === localDate) return forest;
  const actedToday = forest.lastMeaningfulActionDate === localDate;
  let vitality = forest.vitality;
  if (!actedToday) {
    vitality = Math.max(0, vitality - DAILY_DECAY);
  }
  let currentStreak = forest.currentStreak;
  if (
    !actedToday &&
    forest.lastMeaningfulActionDate !== null &&
    !isDayPaused(forest.pauses, localDate)
  ) {
    currentStreak = 0; // un jour non ponctué sans action casse le streak
  }
  return { ...forest, vitality, currentStreak, lastProcessedDay: localDate };
}

// ---------------------------------------------------------------------------
// Croissance permanente + déblocages
// ---------------------------------------------------------------------------

/** Stade de croissance permanent pour un `lifetimeCare` donné. */
export function growthStageFor(lifetimeCare: number): number {
  let stage = 1;
  for (let i = 0; i < GROWTH_THRESHOLDS.length; i += 1) {
    const threshold = GROWTH_THRESHOLDS[i]!;
    if (lifetimeCare >= threshold) stage = i + 1;
  }
  return stage;
}

function unionIds(existing: string[], added: string[]): string[] {
  return Array.from(new Set([...existing, ...added]));
}

/**
 * Évalue les déblocages (stade, créatures, environnement) à partir de
 * `lifetimeCare`. **Ne diminue jamais** : le stade et les ids débloqués sont
 * des maximums cumulatifs. Pur.
 */
export function evaluateUnlocks(forest: ForestState): ForestState {
  const stage = Math.max(forest.growthStage, growthStageFor(forest.lifetimeCare));
  const creatures = CREATURES.filter((c) => c.stage <= stage).map((c) => c.id);
  const environments = ENVIRONMENTS.filter((e) => e.stage <= stage).map((e) => e.id);
  return {
    ...forest,
    growthStage: stage,
    unlockedCreatureIds: unionIds(forest.unlockedCreatureIds, creatures),
    unlockedEnvironmentIds: unionIds(forest.unlockedEnvironmentIds, environments),
  };
}

// ---------------------------------------------------------------------------
// Événements rares (momentum / streak)
// ---------------------------------------------------------------------------

/**
 * Évalue les événements rares après une montée de streak. Le **gardien**
 * (événement mythique rare) se déclenche quand le streak passe de <10 à ≥10,
 * **une seule fois** par série de streak (pas de doublon à 11, 12, …).
 * Pur.
 */
export function evaluateRareEvents(
  forest: ForestState,
  previousStreak: number,
  newStreak: number,
): { forest: ForestState; triggered: string | null } {
  if (newStreak >= GUARDIAN_STREAK && previousStreak < GUARDIAN_STREAK) {
    return { forest: { ...forest, lastRareEvent: 'guardian' }, triggered: 'guardian' };
  }
  return { forest, triggered: null };
}

// ---------------------------------------------------------------------------
// Pause (« Mettre la maison en pause »)
// ---------------------------------------------------------------------------

/**
 * Met la maison en pause à partir du `localDate`. Pas de justification
 * requise. En pause : pas de décroissance, pas de pénalité de streak, pas de
 * crédit. Pur.
 */
export function pauseForest(
  forest: ForestState,
  localDate: string,
): ForestState {
  if (forest.paused) return forest;
  const pauses: PauseInterval[] = [
    ...forest.pauses,
    { start: localDate, end: null },
  ];
  return { ...forest, paused: true, pausedAt: localDate, pauses };
}

/**
 * Reprend la forêt au `localDate`. Ferme la pause en cours : les jours de
 * pause sont [début, localDate − 1] (le jour de reprise est le premier jour
 * actif). La forêt se réveille normalement. Pur.
 */
export function resumeForest(
  forest: ForestState,
  localDate: string,
): ForestState {
  if (!forest.paused) return forest;
  const pauses = forest.pauses.slice();
  for (let i = pauses.length - 1; i >= 0; i -= 1) {
    if (pauses[i]!.end === null) {
      const start = pauses[i]!.start;
      const dayBefore = localDateKey(addDays(parseLocalDateKey(localDate), -1));
      const end = dayBefore < start ? start : dayBefore;
      pauses[i] = { start, end };
      break;
    }
  }
  return { ...forest, paused: false, pausedAt: null, pauses };
}
