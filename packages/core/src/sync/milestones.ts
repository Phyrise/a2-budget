/**
 * Jalons de la forêt (V5) : « la croissance ne diminue jamais », même après
 * fusion (docs/SYNC_DESIGN.md §2.2).
 *
 * Un rejeu peut donner moins que ce qu'un téléphone a montré (une pause posée
 * par l'un pendant que l'autre cochait hors ligne). Le document
 * `meta/forestMilestones` garde donc le plus haut jamais vu : stade, soins,
 * plus longue série, déblocages, événements rares. Chaque téléphone y écrit
 * `max(local, distant)` ; l'affichage prend `max(rejeu, jalons)`. La vitalité
 * (court terme) n'y est pas : elle peut s'ajuster doucement.
 *
 * Fusion commutative, associative, idempotente. Fonctions pures.
 */

import { evaluateUnlocks, growthStageFor } from '../home/forest.js';
import type { ForestState } from '../home/types.js';
import { isIntInRange, isPlainObject, type Fail, type Ok } from '../home/validationHelpers.js';

/** Plus hauts repères de croissance jamais vus. */
export interface ForestMilestones {
  growthStage: number;
  lifetimeCare: number;
  longestStreak: number;
  unlockedCreatureIds: string[];
  unlockedEnvironmentIds: string[];
  /** Événements rares déjà vus (ex. « guardian »). */
  rareEvents: string[];
}

/** Aucun jalon (forêt neuve). */
export function emptyMilestones(): ForestMilestones {
  return {
    growthStage: 1,
    lifetimeCare: 0,
    longestStreak: 0,
    unlockedCreatureIds: [],
    unlockedEnvironmentIds: [],
    rareEvents: [],
  };
}

function sortedUnion(...lists: readonly string[][]): string[] {
  return [...new Set(lists.flat())].sort();
}

/** Jalons atteints par une forêt. */
export function milestonesOf(forest: ForestState): ForestMilestones {
  return {
    growthStage: forest.growthStage,
    lifetimeCare: forest.lifetimeCare,
    longestStreak: forest.longestStreak,
    unlockedCreatureIds: sortedUnion(forest.unlockedCreatureIds),
    unlockedEnvironmentIds: sortedUnion(forest.unlockedEnvironmentIds),
    rareEvents: forest.lastRareEvent === null ? [] : [forest.lastRareEvent],
  };
}

/** Maximum champ par champ (listes : union triée). */
export function mergeMilestones(x: ForestMilestones, y: ForestMilestones): ForestMilestones {
  return {
    growthStage: Math.max(x.growthStage, y.growthStage),
    lifetimeCare: Math.max(x.lifetimeCare, y.lifetimeCare),
    longestStreak: Math.max(x.longestStreak, y.longestStreak),
    unlockedCreatureIds: sortedUnion(x.unlockedCreatureIds, y.unlockedCreatureIds),
    unlockedEnvironmentIds: sortedUnion(x.unlockedEnvironmentIds, y.unlockedEnvironmentIds),
    rareEvents: sortedUnion(x.rareEvents, y.rareEvents),
  };
}

function includesAll(big: readonly string[], small: readonly string[]): boolean {
  const set = new Set(big);
  return small.every((id) => set.has(id));
}

/** Vrai si `next` ne baisse sur aucun jalon de `prev` (la règle d'écriture). */
export function milestonesAtLeast(next: ForestMilestones, prev: ForestMilestones): boolean {
  return next.growthStage >= prev.growthStage &&
    next.lifetimeCare >= prev.lifetimeCare &&
    next.longestStreak >= prev.longestStreak &&
    includesAll(next.unlockedCreatureIds, prev.unlockedCreatureIds) &&
    includesAll(next.unlockedEnvironmentIds, prev.unlockedEnvironmentIds) &&
    includesAll(next.rareEvents, prev.rareEvents);
}

/** Vrai si `candidate` apporte un jalon que `current` n'a pas (une écriture est utile). */
export function raisesMilestones(current: ForestMilestones, candidate: ForestMilestones): boolean {
  return !milestonesAtLeast(current, candidate);
}

/**
 * Forêt affichée : le rejeu, relevé aux jalons (stade, déblocages, plus
 * longue série, événement rare). `lifetimeCare` reste celui du rejeu (il
 * doit égaler les crédits du registre) ; le stade, lui, ne redescend pas.
 * Rien à relever → même référence. Pur.
 */
export function applyMilestones(forest: ForestState, milestones: ForestMilestones): ForestState {
  if (milestonesAtLeast(milestonesOf(forest), milestones)) return forest;
  const stage = Math.max(forest.growthStage, milestones.growthStage, growthStageFor(milestones.lifetimeCare));
  const rare = forest.lastRareEvent ?? milestones.rareEvents[milestones.rareEvents.length - 1] ?? null;
  return evaluateUnlocks({
    ...forest,
    growthStage: stage,
    longestStreak: Math.max(forest.longestStreak, milestones.longestStreak),
    unlockedCreatureIds: [...new Set([...forest.unlockedCreatureIds, ...milestones.unlockedCreatureIds])],
    unlockedEnvironmentIds: [...new Set([...forest.unlockedEnvironmentIds, ...milestones.unlockedEnvironmentIds])],
    lastRareEvent: rare,
  });
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

/** Validation d'un document de jalons (champs inconnus ignorés). */
export function validateMilestones(value: unknown): Ok<ForestMilestones> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'milestones-not-object' };
  const max = Number.MAX_SAFE_INTEGER;
  if (!isIntInRange(value.growthStage, 1, max)) return { ok: false, reason: 'milestones-invalid-stage' };
  if (!isIntInRange(value.lifetimeCare, 0, max)) return { ok: false, reason: 'milestones-invalid-care' };
  if (!isIntInRange(value.longestStreak, 0, max)) return { ok: false, reason: 'milestones-invalid-streak' };
  if (!isIdList(value.unlockedCreatureIds) || !isIdList(value.unlockedEnvironmentIds) ||
    !isIdList(value.rareEvents)) {
    return { ok: false, reason: 'milestones-invalid-ids' };
  }
  return {
    ok: true,
    state: {
      growthStage: value.growthStage,
      lifetimeCare: value.lifetimeCare,
      longestStreak: value.longestStreak,
      unlockedCreatureIds: sortedUnion(value.unlockedCreatureIds),
      unlockedEnvironmentIds: sortedUnion(value.unlockedEnvironmentIds),
      rareEvents: sortedUnion(value.rareEvents),
    },
  };
}
