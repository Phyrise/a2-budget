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
import { addDays, isValidLocalDateKey, localDateKey, parseLocalDateKey } from './dates.js';

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
/** Deux journées d'inactivité terminées sont offertes avant toute décroissance. */
export const INACTIVITY_GRACE_DAYS = 2;
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

/** Nombre de crédits accordés le `localDate` (actifs + tombstones, hors faits sans crédit). */
export function creditsGrantedOn(forest: ForestState, localDate: string): number {
  return Object.values(forest.creditLedger).filter(
    (c) => c.grantedOn === localDate && c.status !== 'uncredited',
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
function latestObservedDay(forest: ForestState): string | null {
  let latest = forest.lastProcessedDay;
  for (const day of [forest.lastMeaningfulActionDate, forest.pausedAt,
    ...forest.pauses.map((pause) => pause.end ?? pause.start),
    ...Object.values(forest.creditLedger).map((credit) => credit.grantedOn)]) {
    if (day !== null && (latest === null || day > latest)) latest = day;
  }
  return latest;
}

export function grantCredit(
  forest: ForestState,
  creditKey: CreditKey,
  completionLocalDate: string,
): { forest: ForestState; granted: boolean } {
  const latest = latestObservedDay(forest);
  if (!isValidLocalDateKey(completionLocalDate) ||
    (latest !== null && completionLocalDate < latest)) {
    return { forest, granted: false };
  }
  if (forest.creditLedger[creditKey] !== undefined) {
    return { forest, granted: false }; // idempotent (actif ou tombstone)
  }
  if (forest.paused || creditsGrantedOn(forest, completionLocalDate) >= DAILY_CREDIT_CAP) {
    // Le fait reste enregistré mais ne pourra pas être récompensé au re-clic,
    // même après une annulation, un rechargement ou un changement de jour.
    return {
      forest: {
        ...forest,
        creditLedger: {
          ...forest.creditLedger,
          [creditKey]: { grantedOn: completionLocalDate, status: 'uncredited' },
        },
      },
      granted: false,
    };
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
  if (credit === undefined || credit.status !== 'active') {
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
  if (localDate <= lastDate) return false;
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
  const latest = latestObservedDay(forest);
  if (forest.paused || !isValidLocalDateKey(localDate) ||
    (latest !== null && localDate < latest)) return forest;
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
 * Réconcilie les journées TERMINÉES avant `localDate`. Le jour courant reste
 * ouvert : son premier soin peut prolonger le streak de la veille. La vitalité
 * ne décroît qu'après deux journées d'inactivité non pausées. Un saut de dates
 * produit le même résultat que des chargements quotidiens ; reculer est un no-op.
 * En pause : aucun effet (la forêt est endormie). Pur.
 */
export function advanceDay(forest: ForestState, localDate: string): ForestState {
  if (forest.paused) return forest;
  if (!isValidLocalDateKey(localDate)) return forest;
  const latest = latestObservedDay(forest);
  if ((forest.lastProcessedDay !== null && localDate <= forest.lastProcessedDay) ||
    (latest !== null && localDate < latest)) return forest;
  const lastAction = forest.lastMeaningfulActionDate;
  if (lastAction === null || lastAction >= localDate) {
    return { ...forest, lastProcessedDay: localDate };
  }
  const firstIdleDay = localDateKey(addDays(parseLocalDateKey(lastAction), 1));
  const finishedThrough = localDateKey(addDays(parseLocalDateKey(localDate), -1));
  const totalIdleDays = countActiveDays(forest.pauses, firstIdleDay, finishedThrough);
  const previouslyThrough = forest.lastProcessedDay === null
    ? lastAction
    : localDateKey(addDays(parseLocalDateKey(forest.lastProcessedDay), -1));
  const previousIdleDays = countActiveDays(forest.pauses, firstIdleDay, previouslyThrough);
  const decayDays = Math.max(0, totalIdleDays - INACTIVITY_GRACE_DAYS) -
    Math.max(0, previousIdleDays - INACTIVITY_GRACE_DAYS);
  const broken = totalIdleDays > 0;
  return {
    ...forest,
    vitality: Math.max(0, forest.vitality - Math.max(0, decayDays) * DAILY_DECAY),
    currentStreak: broken ? 0 : forest.currentStreak,
    lastProcessedDay: localDate,
  };
}

/** Calendrier civil : compter des composantes de dates évite les journées DST de 23/25 h. */
function calendarOrdinal(key: string): number {
  const date = parseLocalDateKey(key);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** Nombre de jours inclusifs hors pause, sans boucle proportionnelle à une longue absence. */
function countActiveDays(pauses: PauseInterval[], first: string, last: string): number {
  if (last < first) return 0;
  const start = calendarOrdinal(first);
  const end = calendarOrdinal(last);
  const ranges = pauses.map((pause) => [
    Math.max(start, calendarOrdinal(pause.start)),
    Math.min(end, pause.end === null ? end : calendarOrdinal(pause.end)),
  ] as const).filter(([a, b]) => a <= b).sort((a, b) => a[0] - b[0]);
  let pausedDays = 0;
  let coveredThrough = start - 1;
  for (const [a, b] of ranges) {
    pausedDays += Math.max(0, b - Math.max(a, coveredThrough + 1) + 1);
    coveredThrough = Math.max(coveredThrough, b);
  }
  return end - start + 1 - pausedDays;
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
 * Le prototype mémorise la première visite du gardien au passage de <10 à ≥10.
 * Rejouer une transition, recharger ou recommencer une série ne répète pas la
 * visite déjà enregistrée ; une économie de visites récurrentes reste à définir.
 * Pur.
 */
export function evaluateRareEvents(
  forest: ForestState,
  previousStreak: number,
  newStreak: number,
): { forest: ForestState; triggered: string | null } {
  if (newStreak >= GUARDIAN_STREAK && previousStreak < GUARDIAN_STREAK &&
    forest.lastRareEvent !== 'guardian') {
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
  const latest = latestObservedDay(forest);
  if (!isValidLocalDateKey(localDate) || (latest !== null && localDate < latest)) return forest;
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
  const latest = latestObservedDay(forest);
  if (!isValidLocalDateKey(localDate) || (latest !== null && localDate < latest)) return forest;
  const pauses = forest.pauses.slice();
  for (let i = pauses.length - 1; i >= 0; i -= 1) {
    if (pauses[i]!.end === null) {
      const start = pauses[i]!.start;
      const dayBefore = localDateKey(addDays(parseLocalDateKey(localDate), -1));
      // Une pause/reprise dans le même jour n'exempte aucun jour calendaire.
      if (localDate === start) pauses.splice(i, 1);
      else pauses[i] = { start, end: dayBefore };
      break;
    }
  }
  return { ...forest, paused: false, pausedAt: null, pauses };
}
