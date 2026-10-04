/**
 * Détection PURE des sons à jouer, à partir de deux AppState successifs
 * (précédent → courant). Aucune dépendance d'exécution (imports de types
 * seulement) : testée directement par Node (`detect.check.mjs`).
 *
 * Règles :
 * - on ne joue que des transitions **pas à pas**, celles d'un geste pendant
 *   la session (cocher, annuler, passer, cercle) ; la floraison d'une
 *   lanterne est jouée par son contrôleur (useLanternController) ;
 * - un remplacement en bloc (import d'une sauvegarde, remise à zéro,
 *   rechargement) ne joue rien : le store remplace alors toutes les
 *   branches à la fois (nouvelles références), alors qu'un geste ne touche
 *   que celles qu'il modifie ; des écarts trop grands (plusieurs stades,
 *   beaucoup de faits d'un coup) sont aussi traités comme un bloc ;
 * - plusieurs événements d'une même transition sont regroupés et
 *   enchaînés (la lumière, puis la créature, puis la forêt qui grandit) ;
 * - univers des modules (V3.2) : un montant du mois affiché qui change
 *   (pièces), une dépense ajoutée (kompeitō), un article coché (balai), le
 *   panier vidé (clochette), un événement ajouté au calendrier (bois).
 *   Changer de mois, retirer, décocher : rien.
 */
import type { AppState, ChoreCompletion, MonthRecord } from '@a2/core';
import type { PlannedSound, SoundCue, SoundEvent, SoundVoice } from './cues';

/** Au-delà de ce nombre de faits ajoutés / retirés d'un coup : changement en bloc. */
const MAX_STEP_ITEMS = 3;
/** Streak qui fait venir le gardien (domaine : GUARDIAN_STREAK). */
const GUARDIAN_STREAK = 10;

function idsOf<T extends { id: string }>(list: readonly T[] | undefined): Set<string> {
  return new Set((list ?? []).map((x) => x.id));
}

function added<T extends { id: string }>(prev: readonly T[] | undefined, next: readonly T[] | undefined): T[] {
  const before = idsOf(prev);
  return (next ?? []).filter((x) => !before.has(x.id));
}

function removedCount<T extends { id: string }>(prev: readonly T[] | undefined, next: readonly T[] | undefined): number {
  const after = idsOf(next);
  return (prev ?? []).filter((x) => !after.has(x.id)).length;
}

/**
 * Vrai si la transition ressemble à un remplacement d'état (import, remise
 * à zéro, rechargement) plutôt qu'à un geste : rien ne doit sonner.
 */
export function isWholesaleChange(prev: AppState, next: AppState): boolean {
  // Un geste ne réécrit jamais à la fois les tâches et les courses (ou le
  // foyer) : seul un état entièrement reconstruit le fait.
  if (prev.chores !== next.chores && (prev.groceries !== next.groceries || prev.household !== next.household)) {
    return true;
  }
  const pc = prev.chores;
  const nc = next.chores;
  if (added(pc.completions, nc.completions).length > MAX_STEP_ITEMS) return true;
  if (removedCount(pc.completions, nc.completions) > MAX_STEP_ITEMS) return true;
  if (added(pc.skips, nc.skips).length > MAX_STEP_ITEMS) return true;
  if (added(prev.focus?.sessions, next.focus?.sessions).length > 1) return true;
  if (added(prev.rituals?.circles, next.rituals?.circles).length > 1) return true;
  if (added(prev.calendar?.events, next.calendar?.events).length > MAX_STEP_ITEMS) return true;
  const pf = prev.forest;
  const nf = next.forest;
  if (nf.growthStage - pf.growthStage > 1) return true;
  if (nf.unlockedCreatureIds.length - pf.unlockedCreatureIds.length > MAX_STEP_ITEMS) return true;
  // La croissance ne diminue jamais : si elle recule, l'état a été remplacé.
  if (nf.growthStage < pf.growthStage || nf.lifetimeCare < pf.lifetimeCare) return true;
  return false;
}

function voiceOf(c: ChoreCompletion): SoundVoice {
  const who = c.doneBy ?? c.assignee;
  return who === 'unassigned' ? 'none' : who;
}

function mergeVoices(voices: SoundVoice[]): SoundVoice {
  const set = new Set(voices);
  if (set.size === 1) return voices[0] ?? 'none';
  set.delete('none');
  return set.size === 1 ? [...set][0]! : 'both';
}

function circleChanged(prev: AppState, next: AppState): boolean {
  const before = new Map((prev.rituals?.circles ?? []).map((c) => [c.id, c.heldAt]));
  return (next.rituals?.circles ?? []).some((c) => before.get(c.id) !== c.heldAt);
}

/** Le montant d'une dépense, par id (pour repérer un montant modifié). */
function expenseAmounts(month: MonthRecord): Map<string, number> {
  return new Map(month.expenses.map((e) => [e.id, e.amountCents]));
}

/**
 * Budget : seulement le mois affiché, et seulement s'il reste affiché (un
 * changement de mois ou un mois créé ne sonne pas). Dépense ajoutée →
 * kompeitō ; montant modifié (salaire, compléments, dépense, réserve) → pièces.
 */
function budgetEvents(prev: AppState, next: AppState): SoundEvent[] {
  const pb = prev.budget;
  const nb = next.budget;
  if (pb === nb || pb.months === nb.months || pb.selectedMonth !== nb.selectedMonth) return [];
  const pm = pb.months.find((m) => m.monthKey === pb.selectedMonth);
  const nm = nb.months.find((m) => m.monthKey === nb.selectedMonth);
  if (pm === undefined || nm === undefined || pm === nm) return [];
  const newExpenses = added(pm.expenses, nm.expenses);
  if (newExpenses.length > MAX_STEP_ITEMS) return [];
  if (newExpenses.length > 0) return [{ cue: 'konpeito' }];
  const before = expenseAmounts(pm);
  const amountChanged =
    pm.salaryACents !== nm.salaryACents ||
    pm.salaryBCents !== nm.salaryBCents ||
    pm.bonusACents !== nm.bonusACents ||
    pm.bonusBCents !== nm.bonusBCents ||
    pm.reserveTargetCents !== nm.reserveTargetCents ||
    nm.expenses.some((e) => before.has(e.id) && before.get(e.id) !== e.amountCents);
  return amountChanged ? [{ cue: 'coins' }] : [];
}

/** Courses : article coché → balai ; panier vidé (archivé) → clochette. */
function groceryEvents(prev: AppState, next: AppState): SoundEvent[] {
  const pg = prev.groceries;
  const ng = next.groceries;
  if (pg === ng) return [];
  const before = new Map(pg.items.map((i) => [i.id, i]));
  // Vider le panier archive les articles cochés (l'historique change) ;
  // retirer un seul article d'un glissement ne touche pas l'historique.
  const after = idsOf(ng.items);
  const clearedDone = pg.items.filter((i) => i.done && !after.has(i.id)).length;
  if (clearedDone > 0 && pg.history !== ng.history) return [{ cue: 'shopBell' }];
  const checked = ng.items.filter((i) => {
    const old = before.get(i.id);
    return old !== undefined && !old.done && i.done;
  }).length;
  if (checked > 0 && checked <= MAX_STEP_ITEMS) return [{ cue: 'broom' }];
  return [];
}

/** Calendrier : un événement ajouté → note de bois. */
function calendarEvents(prev: AppState, next: AppState): SoundEvent[] {
  if (prev.calendar === next.calendar) return [];
  return added(prev.calendar?.events, next.calendar?.events).length > 0 ? [{ cue: 'woodNote' }] : [];
}

/**
 * Événements sonores d'une transition, dans l'ordre où on les entend :
 * le geste (lumière, souffle, cercle, lanterne), puis la créature, la
 * croissance et le gardien. Vide au premier rendu et pour un remplacement.
 */
export function detectSoundEvents(prev: AppState | null, next: AppState | null): SoundEvent[] {
  if (prev === null || next === null || prev === next) return [];
  if (isWholesaleChange(prev, next)) return [];
  const events: SoundEvent[] = [];

  // 1. Le geste.
  const newFacts = added(prev.chores.completions, next.chores.completions);
  if (newFacts.length > 0) {
    const tasks = new Map(next.chores.tasks.map((t) => [t.id, t]));
    const chore = newFacts.some((c) => tasks.get(c.taskId)?.effort === 3);
    events.push({ cue: chore ? 'chore' : 'done', who: mergeVoices(newFacts.map(voiceOf)) });
  } else if (removedCount(prev.chores.completions, next.chores.completions) > 0) {
    events.push({ cue: 'undo' });
  } else if (added(prev.chores.skips, next.chores.skips).length > 0) {
    events.push({ cue: 'skip' });
  } else if (removedCount(prev.chores.skips, next.chores.skips) > 0) {
    events.push({ cue: 'undo' });
  }
  // La lanterne n'est pas détectée ici : une session est aussi mémorisée
  // après un arrêt anticipé. Sa floraison est jouée par le contrôleur de la
  // lanterne, seulement menée au bout et si son son n'est pas coupé.
  if (circleChanged(prev, next)) events.push({ cue: 'circle' });
  events.push(...budgetEvents(prev, next), ...groceryEvents(prev, next), ...calendarEvents(prev, next));

  // 2. Ce que la forêt en fait.
  const pf = prev.forest;
  const nf = next.forest;
  if (nf.unlockedCreatureIds.length > pf.unlockedCreatureIds.length) events.push({ cue: 'creature' });
  if (nf.growthStage > pf.growthStage) events.push({ cue: 'growth' });
  const guardianNow =
    nf.lastRareEvent === 'guardian' &&
    (pf.lastRareEvent !== 'guardian' ||
      (pf.currentStreak < GUARDIAN_STREAK && nf.currentStreak >= GUARDIAN_STREAK));
  if (guardianNow) events.push({ cue: 'guardian' });
  return events;
}

/** Temps (ms) laissé à chaque son avant le suivant d'un même enchaînement. */
const LEAD_MS: Record<SoundCue, number> = {
  done: 360,
  chore: 560,
  undo: 220,
  skip: 320,
  lantern: 620,
  circle: 560,
  creature: 440,
  growth: 520,
  guardian: 0,
  coins: 320,
  konpeito: 300,
  broom: 340,
  shopBell: 480,
  woodNote: 300,
};

/** Importance (mouvement réduit : on ne garde que le plus marquant). */
const PRIORITY: Record<SoundCue, number> = {
  guardian: 9,
  growth: 8,
  creature: 7,
  lantern: 6,
  chore: 5,
  circle: 4,
  done: 3,
  skip: 2,
  undo: 1,
  shopBell: 3,
  konpeito: 3,
  woodNote: 3,
  coins: 2,
  broom: 2,
};

/**
 * Enchaîne les événements d'une transition. Mouvement réduit : un seul son
 * (le plus marquant), pas d'enchaînement.
 */
export function planSounds(events: readonly SoundEvent[], opts: { reduced?: boolean } = {}): PlannedSound[] {
  if (events.length === 0) return [];
  if (opts.reduced === true) {
    const best = events.reduce((a, b) => (PRIORITY[b.cue] > PRIORITY[a.cue] ? b : a));
    return [{ ...best, delayMs: 0 }];
  }
  let at = 0;
  return events.map((e) => {
    const planned = { ...e, delayMs: at };
    at += LEAD_MS[e.cue];
    return planned;
  });
}
