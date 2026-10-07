/**
 * Rejeu déterministe de la forêt (V5) : docs/SYNC_DESIGN.md §2.2 et §3.3.
 *
 *   forêt = replayForest(point de reprise, faits postérieurs, aujourd'hui)
 *
 * Les faits sont triés par `(jour, horodatage, id, nature)` puis rejoués avec
 * exactement les briques de la bascule locale (`toggleTaskToday`,
 * `toggleHomePause`) :
 * - complétion → advanceDay, grantCredit, puis (si crédit) updateStreak,
 *   evaluateRareEvents, evaluateUnlocks ;
 * - annulation → advanceDay, tombstoneCredit (jamais avant sa complétion :
 *   son jour et son heure valent au moins ceux de la complétion) ;
 * - pause → advanceDay, pauseForest ; reprise → resumeForest ;
 * - à la fin, advanceDay(aujourd'hui).
 *
 * Mêmes faits ⇒ même forêt, quel que soit l'ordre d'arrivée. Le plafond
 * quotidien reste déterministe (ordre `(jour, completedAt, id)`) ; une
 * recomplétion après annulation ne redonne rien (clé déjà tombstonée).
 *
 * Points de reprise : la forêt figée à un jour J. Un point ordinaire exclut
 * tout fait de jour ≤ J ; la genèse (migration) exclut seulement les faits
 * importés. Fonctions pures.
 */

import { addDays, isValidLocalDateKey, localDateKey, parseLocalDateKey } from '../home/dates.js';
import {
  advanceDay,
  emptyForest,
  evaluateRareEvents,
  evaluateUnlocks,
  grantCredit,
  pauseForest,
  resumeForest,
  tombstoneCredit,
  updateStreak,
} from '../home/forest.js';
import type { ForestState } from '../home/types.js';
import { dedupeFacts, isLive, type CompletionFact, type ForestEventFact } from './facts.js';

/** Forêt figée à la fin du jour `day` (§3.3). */
export interface ForestCheckpoint {
  /** « YYYY-MM-DD » : les faits jusqu'à ce jour inclus sont dans `forest`. */
  day: string;
  forest: ForestState;
  /** Point de la migration : seuls les faits importés y sont déjà comptés. */
  genesis?: true;
}

/** Faits qui font la forêt. */
export interface ReplayFacts {
  completions: readonly CompletionFact[];
  forestEvents?: readonly ForestEventFact[];
}

export type ReplayStep =
  | { kind: 'complete' | 'undo'; day: string; at: string; id: string; creditKey: string }
  | { kind: 'pause' | 'resume'; day: string; at: string; id: string };

const RANK: Record<ReplayStep['kind'], number> = { complete: 0, undo: 1, pause: 2, resume: 2 };

function maxKey(a: string, b: string | undefined): string {
  return b !== undefined && b > a ? b : a;
}

function compareSteps(x: ReplayStep, y: ReplayStep): number {
  if (x.day !== y.day) return x.day < y.day ? -1 : 1;
  if (x.at !== y.at) return x.at < y.at ? -1 : 1;
  if (x.id !== y.id) return x.id < y.id ? -1 : 1;
  return RANK[x.kind] - RANK[y.kind];
}

/**
 * Étapes du rejeu postérieures au point de reprise, triées. Un fait au jour
 * invalide est ignoré (jamais une exception).
 */
export function forestTimeline(checkpoint: ForestCheckpoint | null, facts: ReplayFacts): ReplayStep[] {
  const after = (step: ReplayStep, imported: boolean): boolean => {
    if (checkpoint === null) return true;
    if (checkpoint.genesis === true) return step.kind !== 'complete' || !imported;
    return step.day > checkpoint.day;
  };
  const steps: ReplayStep[] = [];
  for (const fact of dedupeFacts(facts.completions)) {
    if (!isValidLocalDateKey(fact.localDay)) continue;
    const complete: ReplayStep = {
      kind: 'complete', day: fact.localDay, at: fact.completedAt, id: fact.id, creditKey: fact.creditKey,
    };
    if (after(complete, fact.imported === true)) steps.push(complete);
    if (isLive(fact)) continue;
    const undoDay = fact.undoneDay !== undefined && isValidLocalDateKey(fact.undoneDay) ? fact.undoneDay : fact.localDay;
    const undo: ReplayStep = {
      kind: 'undo',
      day: maxKey(fact.localDay, undoDay),
      at: maxKey(fact.completedAt, fact.undoneAt),
      id: fact.id,
      creditKey: fact.creditKey,
    };
    if (after(undo, fact.imported === true)) steps.push(undo);
  }
  for (const event of dedupeFacts(facts.forestEvents ?? [])) {
    if (!isLive(event) || !isValidLocalDateKey(event.localDay)) continue;
    if (event.kind !== 'pause' && event.kind !== 'resume') continue;
    const step: ReplayStep = { kind: event.kind, day: event.localDay, at: event.at, id: event.id };
    if (after(step, false)) steps.push(step);
  }
  return steps.sort(compareSteps);
}

function applyStep(forest: ForestState, step: ReplayStep): ForestState {
  switch (step.kind) {
    case 'complete': {
      const before = advanceDay(forest, step.day);
      const credit = grantCredit(before, step.creditKey, step.day);
      if (!credit.granted) return credit.forest;
      let next = updateStreak(credit.forest, step.day);
      next = evaluateRareEvents(next, before.currentStreak, next.currentStreak).forest;
      return evaluateUnlocks(next);
    }
    case 'undo':
      return tombstoneCredit(advanceDay(forest, step.day), step.creditKey).forest;
    case 'pause':
      return pauseForest(advanceDay(forest, step.day), step.day);
    case 'resume':
      return resumeForest(forest, step.day);
  }
}

function replaySteps(start: ForestState, steps: readonly ReplayStep[], today: string): ForestState {
  let forest = start;
  for (const step of steps) forest = applyStep(forest, step);
  return advanceDay(forest, today);
}

/**
 * Forêt = point de reprise (ou forêt neuve) + faits postérieurs, avancée à
 * `today` (« YYYY-MM-DD », jour local du téléphone). Indépendante de l'ordre
 * des faits. Pur.
 */
export function replayForest(
  checkpoint: ForestCheckpoint | null,
  facts: ReplayFacts,
  today: string,
): ForestState {
  return replaySteps(checkpoint?.forest ?? emptyForest(), forestTimeline(checkpoint, facts), today);
}

/**
 * Nouveau point de reprise au jour `day` : la forêt rejouée avec les faits
 * jusqu'à ce jour inclus. Déterministe (deux téléphones écrivent le même). Pur.
 */
export function buildCheckpoint(
  checkpoint: ForestCheckpoint | null,
  facts: ReplayFacts,
  day: string,
): ForestCheckpoint {
  const steps = forestTimeline(checkpoint, facts).filter((step) => step.day <= day);
  return { day, forest: replaySteps(checkpoint?.forest ?? emptyForest(), steps, day) };
}

/** Le plus récent point de reprise (à jour égal, l'ordinaire passe avant la genèse). */
export function latestCheckpoint(checkpoints: readonly ForestCheckpoint[]): ForestCheckpoint | null {
  let best: ForestCheckpoint | null = null;
  for (const cp of checkpoints) {
    if (!isValidLocalDateKey(cp.day)) continue;
    if (best === null || cp.day > best.day || (cp.day === best.day && best.genesis === true && cp.genesis !== true)) {
      best = cp;
    }
  }
  return best;
}

/**
 * Jour du point de reprise à écrire le mois de `today` : le dernier jour du
 * mois d'il y a deux mois (ex. 8 octobre → 31 août). Pur.
 */
export function checkpointDayFor(today: string): string {
  const date = parseLocalDateKey(today);
  return localDateKey(addDays(new Date(date.getFullYear(), date.getMonth() - 1, 1), -1));
}

/** Points de reprise à garder : la genèse et les 3 plus récents (§9). Pur. */
export function checkpointsToKeep<T extends ForestCheckpoint>(checkpoints: readonly T[]): T[] {
  const ordinary = checkpoints.filter((cp) => cp.genesis !== true)
    .sort((x, y) => (x.day < y.day ? 1 : x.day > y.day ? -1 : 0))
    .slice(0, 3);
  return checkpoints.filter((cp) => cp.genesis === true || ordinary.includes(cp));
}
