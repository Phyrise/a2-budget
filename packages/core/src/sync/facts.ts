/**
 * Faits annulables (V5, synchronisation à deux) : docs/SYNC_DESIGN.md §2.1–2.2.
 *
 * En mode synchronisé, ce qui « s'est passé » (cocher une tâche, « pas
 * aujourd'hui », une pause de la forêt, une lanterne, un achat) est un FAIT :
 * écrit une fois, jamais supprimé ni réécrit. Décocher ne retire rien : le
 * fait est seulement marqué annulé (`undoneAt`, `undoneDay`, `undoneBy`).
 * L'état affiché (complétions, passages…) est la projection des faits
 * vivants ; la forêt est rejouée à partir d'eux (replay.ts).
 *
 * Conflits (deux téléphones hors ligne) :
 * - deux complétions de la même occurrence → la première (`completedAt`, puis
 *   id) est gardée ; si l'un et l'autre l'ont faite, elle devient « fait
 *   ensemble » (`doneBy: 'both'`). Un seul crédit (même clé).
 * - deux « pas aujourd'hui » de la même occurrence → le premier (`at`, id).
 * - deux annulations du même fait → la plus ancienne (`undoneAt`, qui).
 *
 * Fonctions pures, déterministes, indépendantes de l'ordre d'arrivée.
 */

import { localDateKey } from '../home/dates.js';
import { creditKeyFor } from '../home/occurrences.js';
import type {
  ChoreCompletion,
  ChoreSkip,
  FocusSession,
  GroceryPurchase,
  HouseholdTask,
} from '../home/types.js';

/** Rôle d'un membre du foyer : 'a' (AL, Jiji) ou 'b' (AC, Calcifer). */
export type Role = 'a' | 'b';

/** Annulation douce d'un fait (§2.1). Absente : le fait est vivant. */
export interface FactUndo {
  /** Horodatage ISO de l'annulation. */
  undoneAt?: string;
  /** Jour local « YYYY-MM-DD » de l'annulation (fuseau de celui qui annule). */
  undoneDay?: string;
  /** Qui a annulé. */
  undoneBy?: Role;
  /** Annulation d'un geste de l'autre, en mode développeur (§9). */
  devOverride?: true;
}

/** Fait « tâche faite » : la complétion + son jour local et sa clé de crédit. */
export interface CompletionFact extends ChoreCompletion, FactUndo {
  /** Jour local de l'auteur, figé (jamais recalculé dans le fuseau du lecteur). */
  localDay: string;
  /** Clé de crédit de la forêt au moment de cocher (creditKeyFor). */
  creditKey: string;
  /** Importé à la migration : déjà compté dans le point de reprise genèse. */
  imported?: true;
}

/** Fait « pas aujourd'hui ». */
export interface SkipFact extends ChoreSkip, FactUndo {}

/** Fait « lanterne allumée ». */
export interface FocusFact extends FocusSession, FactUndo {}

/** Fait « article acheté » (historique des courses). */
export interface PurchaseFact extends GroceryPurchase, FactUndo {}

/** Fait « maison mise en pause / forêt réveillée ». */
export interface ForestEventFact extends FactUndo {
  id: string;
  kind: 'pause' | 'resume';
  /** Jour local de l'auteur. */
  localDay: string;
  /** Horodatage ISO. */
  at: string;
}

/** Annulation à poser sur un fait. */
export interface UndoInput {
  at: string;
  day: string;
  by: Role;
  devOverride?: boolean;
}

/** Vrai si le fait n'est pas annulé. */
export function isLive(fact: FactUndo): boolean {
  return fact.undoneAt === undefined;
}

/** Marque le fait annulé. Déjà annulé → même référence (la première annulation reste). Pur. */
export function undoFact<T extends FactUndo>(fact: T, undo: UndoInput): T {
  if (!isLive(fact)) return fact;
  const next: T = { ...fact, undoneAt: undo.at, undoneDay: undo.day, undoneBy: undo.by };
  if (undo.devOverride === true) next.devOverride = true;
  return next;
}

function undoRank(fact: FactUndo): string {
  return `${fact.undoneAt ?? ''}|${fact.undoneBy ?? ''}`;
}

/**
 * Deux versions du même fait (même id) : l'annulée l'emporte ; deux
 * annulations → la plus ancienne. Commutatif et idempotent. Pur.
 */
export function mergeFact<T extends FactUndo>(x: T, y: T): T {
  if (isLive(y)) return x;
  if (isLive(x)) return y;
  return undoRank(y) < undoRank(x) ? y : x;
}

/** Fusionne une liste de faits par id (ordre de première apparition conservé). Pur. */
export function dedupeFacts<T extends FactUndo & { id: string }>(facts: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const fact of facts) {
    const seen = byId.get(fact.id);
    byId.set(fact.id, seen === undefined ? fact : mergeFact(seen, fact));
  }
  return [...byId.values()];
}

/** Retire l'annulation d'un fait (forme du domaine). */
function withoutUndo<T extends FactUndo>(fact: T): Omit<T, keyof FactUndo> {
  const { undoneAt: _a, undoneDay: _d, undoneBy: _b, devOverride: _o, ...rest } = fact;
  return rest;
}

/** Faits vivants, dans l'ordre donné, sans les champs d'annulation. Pur. */
export function liveFacts<T extends FactUndo & { id: string }>(facts: readonly T[]): Omit<T, keyof FactUndo>[] {
  return dedupeFacts(facts).filter(isLive).map(withoutUndo);
}

/**
 * Fait de complétion à partir d'une complétion du domaine. Le jour local est
 * celui de `completedAt` dans le fuseau de l'appelant (l'auteur) ; la clé de
 * crédit suit la tâche si elle est connue. Pur.
 */
export function completionFact(
  completion: ChoreCompletion,
  task: HouseholdTask | undefined,
): CompletionFact {
  const creditKey = task !== undefined
    ? creditKeyFor(task, completion.dueDate)
    : `${completion.taskId}|${completion.dueDate}`;
  return { ...completion, localDay: localDateKey(new Date(completion.completedAt)), creditKey };
}

function occurrenceKey(x: { taskId: string; dueDate: string }): string {
  return `${x.taskId}|${x.dueDate}`;
}

function firstBy<T extends { id: string }>(items: readonly T[], at: (item: T) => string): T {
  return items.reduce((best, item) => {
    const a = at(item);
    const b = at(best);
    return a < b || (a === b && item.id < best.id) ? item : best;
  });
}

function doers(completion: ChoreCompletion): Role[] {
  const who = completion.doneBy ?? completion.assignee;
  return who === 'both' ? ['a', 'b'] : who === 'a' || who === 'b' ? [who] : [];
}

/**
 * Complétions vivantes, une par occurrence `(taskId, dueDate)` : la première
 * (`completedAt`, id) ; « fait ensemble » si l'un et l'autre l'ont faite.
 * Ordre : celui des faits gardés dans `facts`. Pur.
 */
export function liveCompletions(facts: readonly CompletionFact[]): ChoreCompletion[] {
  const groups = new Map<string, CompletionFact[]>();
  for (const fact of dedupeFacts(facts)) {
    if (!isLive(fact)) continue;
    const key = occurrenceKey(fact);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const kept = new Map<string, ChoreCompletion>();
  for (const group of groups.values()) {
    const first = firstBy(group, (f) => f.completedAt);
    const { localDay: _d, creditKey: _k, imported: _i, ...rest } = withoutUndo(first);
    const completion: ChoreCompletion = { ...rest };
    const who = new Set(group.flatMap(doers));
    if (group.length > 1 && who.has('a') && who.has('b')) {
      if (completion.assignee === 'both') delete completion.doneBy;
      else completion.doneBy = 'both';
    }
    kept.set(first.id, completion);
  }
  return dedupeFacts(facts).flatMap((f) => kept.get(f.id) ?? []);
}

/**
 * « Pas aujourd'hui » vivants, un par occurrence : le premier (`at`, id).
 * Ordre : celui des faits gardés. Pur.
 */
export function liveSkips(facts: readonly SkipFact[]): ChoreSkip[] {
  const firstOf = new Map<string, SkipFact>();
  const live = dedupeFacts(facts).filter(isLive);
  for (const fact of live) {
    const key = occurrenceKey(fact);
    const seen = firstOf.get(key);
    firstOf.set(key, seen === undefined ? fact : firstBy([seen, fact], (f) => f.at));
  }
  const keptIds = new Set([...firstOf.values()].map((f) => f.id));
  return live.filter((f) => keptIds.has(f.id)).map((f) => withoutUndo(f) as ChoreSkip);
}

/**
 * Faits vivants d'une occurrence (pour décocher ou annuler « pas
 * aujourd'hui » : toutes les versions de l'occurrence sont annulées). Pur.
 */
export function liveFactsOfOccurrence<T extends FactUndo & { id: string; taskId: string; dueDate: string }>(
  facts: readonly T[],
  taskId: string,
  dueDate: string,
): T[] {
  return dedupeFacts(facts).filter((f) => isLive(f) && f.taskId === taskId && f.dueDate === dueDate);
}
