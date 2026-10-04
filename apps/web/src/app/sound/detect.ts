/**
 * Détection PURE des sons à jouer, à partir de deux AppState successifs
 * (précédent → courant). Aucune dépendance d'exécution (imports de types
 * seulement) : testée directement par Node (`detect.check.mjs`).
 *
 * Règles :
 * - on ne joue que des transitions **pas à pas**, celles d'un geste pendant
 *   la session (cocher, annuler, passer, cercle, lanterne) ;
 * - un remplacement en bloc (import d'une sauvegarde, remise à zéro,
 *   rechargement) ne joue rien : le store remplace alors toutes les
 *   branches à la fois (nouvelles références), alors qu'un geste ne touche
 *   que celles qu'il modifie ; des écarts trop grands (plusieurs stades,
 *   beaucoup de faits d'un coup) sont aussi traités comme un bloc ;
 * - plusieurs événements d'une même transition sont regroupés et
 *   enchaînés (la lumière, puis la créature, puis la forêt qui grandit).
 */
import type { AppState, ChoreCompletion } from '@a2/core';
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
  if (added(prev.focus?.sessions, next.focus?.sessions).length > 0) events.push({ cue: 'lantern' });
  if (circleChanged(prev, next)) events.push({ cue: 'circle' });

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
