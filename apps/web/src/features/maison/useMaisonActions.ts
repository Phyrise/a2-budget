/**
 * Gestes de la clairière et leurs retours : cocher (avec « qui l'a fait »),
 * « pas aujourd'hui », remettre, pause. Chaque geste reçoit une réponse
 * douce : lumière dans la forêt (plus forte pour une corvée), compagnon qui
 * réagit, petite réplique, toast annulable. Jamais de reproche.
 */
import { nextAssignee, type ChoreCompletion, type ChoreDoer, type HouseholdTask, type TaskAssignee } from '@a2/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { fr, useToast } from '../../ui';
import type { CompanionMood, Who } from '../../world/types';
import { useWorld } from '../../world/WorldContext';
import type { BubbleContext, Speaker } from './companionLines';
import type { Names, Origin } from './TaskRow';
import { speakerFor, useCompanionVoice } from './useCompanionVoice';

const LINGER_MS = 1300;
/** Attente maximale de la fermeture d'une feuille avant l'envol (< LINGER_MS). */
const SHEET_WAIT_MS = 900;

export interface Reaction {
  who: Who;
  mood: CompanionMood;
  key: number;
}

interface Snapshot {
  actionable: HouseholdTask[];
  completions: ChoreCompletion[];
  doneTodayCount: number;
  paused: boolean;
}

/** Choisit la réplique d'un geste coché (ordre de priorité du brief). */
export function checkContext(opts: {
  task: HouseholdTask;
  planned: TaskAssignee;
  who: TaskAssignee;
  explicit: boolean;
  remaining: number;
  firstOfDay: boolean;
  hour: number;
}): { context: BubbleContext; speaker: Speaker; mood: CompanionMood } {
  const { task, planned, who, explicit, remaining, firstOfDay, hour } = opts;
  const person = who === 'a' || who === 'b';
  if (remaining === 0) return { context: 'allDone', speaker: speakerFor(who), mood: 'proud' };
  if (task.effort === 3) return { context: 'chore', speaker: speakerFor(who), mood: 'proud' };
  if (explicit && person && (planned === 'a' || planned === 'b') && who !== planned) {
    return { context: 'help', speaker: planned, mood: 'happy' };
  }
  if (explicit && person && (planned === 'both' || planned === 'unassigned')) {
    return { context: 'claim', speaker: who === 'a' ? 'b' : 'a', mood: 'happy' };
  }
  if (firstOfDay && hour >= 5 && hour < 11) return { context: 'morning', speaker: speakerFor(who), mood: 'happy' };
  return { context: 'check', speaker: speakerFor(who), mood: 'happy' };
}

/**
 * Avant qu'une ligne cochée ne quitte la liste : si le focus clavier / lecteur
 * d'écran y était, le confier à la case suivante (à défaut la précédente, puis
 * le titre « Aujourd'hui ») au lieu de le laisser retomber sur <body>.
 */
function handOffFocus(taskId: string) {
  if (typeof document === 'undefined') return;
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.task-list:not(.task-list--done) > .task-row'));
  const row = rows.find((r) => r.dataset.taskId === taskId);
  if (!row || !row.classList.contains('is-leaving') || !row.contains(document.activeElement)) return;
  const i = rows.indexOf(row);
  const candidates = [...rows.slice(i + 1), ...rows.slice(0, i).reverse()];
  const next = candidates.find((r) => !r.classList.contains('is-leaving'));
  const target = next?.querySelector<HTMLElement>('button.check') ?? document.getElementById('maison-title');
  // Sans défilement : la case suivante prend la place de la ligne retirée,
  // et un clic à la souris ne doit pas faire sauter la page.
  target?.focus({ preventScroll: true });
}

/**
 * QA (serveur de dev uniquement) : trace de chaque envol de luciole — la
 * case est-elle encore là, et rien (feuille, dialogue) ne la recouvre-t-il ?
 */
function tracePulse(taskId: string, o: Origin) {
  const hit = document.elementFromPoint(o.x, o.y);
  const row = hit?.closest<HTMLElement>('[data-task-id]');
  const w = window as unknown as { __maisonPulses?: unknown[] };
  (w.__maisonPulses ??= []).push({
    taskId,
    x: o.x,
    y: o.y,
    t: performance.now(),
    onRow: row?.dataset.taskId === taskId,
    inSheet: hit?.closest('.screen-sheet') !== null && hit?.closest('.screen-sheet') !== undefined,
    dialogOpen: document.querySelector('dialog[open]') !== null,
  });
}

export function useMaisonActions(names: Names, snapshot: Snapshot) {
  const { toggleHomeTask, skipToday, unskipToday, toggleHomePause, me } = useApp();
  const world = useWorld();
  const toast = useToast();
  const voice = useCompanionVoice(names);
  const [lingering, setLingering] = useState<Record<string, string>>({});
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const reactionKey = useRef(0);
  const timers = useRef<number[]>([]);
  const snap = useRef(snapshot);
  snap.current = snapshot;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** Dès qu'aucune feuille n'est ouverte (au plus ~1 s : la ligne attend LINGER_MS). */
  const whenSheetsClosed = (fn: () => void, waited = 0) => {
    if (waited >= SHEET_WAIT_MS || document.querySelector('dialog[open]') === null) fn();
    else later(() => whenSheetsClosed(fn, waited + 40), 40);
  };

  const react = useCallback((who: Who, mood: CompanionMood) => {
    reactionKey.current += 1;
    const key = reactionKey.current;
    setReaction({ who, mood, key });
    timers.current.push(window.setTimeout(() => setReaction((r) => (r?.key === key ? null : r)), 1600));
  }, []);

  const dropLingering = (taskId: string, completionId?: string) =>
    setLingering((m) => {
      if (m[taskId] === undefined || (completionId !== undefined && m[taskId] !== completionId)) return m;
      const next = { ...m };
      delete next[taskId];
      return next;
    });

  /**
   * Cocher / décocher. La lumière (pulse) part de la case cochée tant que la
   * ligne est encore là (elle reste LINGER_MS avant de quitter la liste).
   * Depuis le menu ⋯, `afterSheet` attend que la feuille se soit vraiment
   * fermée (plus aucun <dialog open>) — la forêt redevient vivante, la case
   * n'est plus sous la feuille — puis `from` remesure la case. D'ici là, le
   * vol est réservé (`world.expectPulse`) : pas de lumière posée d'avance.
   */
  const toggle = (task: HouseholdTask, origin: Origin, doneBy?: ChoreDoer, afterSheet?: { from: () => Origin }) => {
    const { actionable, completions, doneTodayCount } = snap.current;
    const planned = nextAssignee(task, completions);
    const result = toggleHomeTask(task, doneBy !== undefined ? { doneBy } : undefined);
    if (result.othersGesture === true && me !== null) {
      // V5 : on ne décoche pas le geste de l'autre ; on dit simplement qui l'a fait.
      toast.show({ message: `C’est ${names[me === 'a' ? 'b' : 'a']} qui l’a cochée.`, icon: 'info' });
      return;
    }
    if (result.completionId === null) return;
    const completionId = result.completionId;
    if (!result.completed) {
      dropLingering(task.id);
      return;
    }
    const who = (result.doneBy ?? planned) as Who;
    const fly = (o: Origin) => {
      if (import.meta.env.DEV) tracePulse(task.id, o);
      world.pulse({ id: completionId, who, fromClientX: o.x, fromClientY: o.y, ...(task.effort === 3 ? { strong: true } : {}) });
    };
    if (afterSheet) {
      // L'état change tout de suite mais le vol attend la fermeture de la
      // feuille : la lumière ne doit pas s'allumer à sa place entre-temps
      // (synchrone, avant le rendu qui pousse les lumières au moteur).
      world.expectPulse(completionId);
      whenSheetsClosed(() => fly(afterSheet.from()));
    }
    else fly(origin);
    setLingering((m) => ({ ...m, [task.id]: completionId }));
    later(() => {
      handOffFocus(task.id);
      dropLingering(task.id, completionId);
    }, LINGER_MS);
    const { context, speaker, mood } = checkContext({
      task,
      planned,
      who,
      explicit: doneBy !== undefined,
      remaining: actionable.filter((t) => t.id !== task.id).length,
      firstOfDay: doneTodayCount === 0,
      hour: new Date().getHours(),
    });
    react(mood === 'proud' ? 'both' : speaker, mood);
    voice.say(context, speaker);
  };

  const skip = (task: HouseholdTask) => {
    const planned = nextAssignee(task, snap.current.completions);
    if (!skipToday(task)) return;
    const week = task.recurrence === 'weekly' && task.flexible === true;
    toast.show({
      message: week ? 'Pas cette semaine, et c’est très bien.' : 'Pas aujourd’hui, et c’est très bien.',
      icon: 'moon',
      action: { label: 'Annuler', onClick: () => unskipToday(task) },
    });
    const speaker = speakerFor(planned);
    react(speaker, 'curious');
    // Le toast annonce déjà le geste : la bulle reste visuelle.
    voice.say('skip', speaker, { quiet: true });
  };

  const restore = (task: HouseholdTask) => {
    if (!unskipToday(task)) return;
    const week = task.recurrence === 'weekly' && task.flexible === true;
    toast.show({ message: fr(`« ${task.title} » revient ${week ? 'cette semaine' : 'aujourd’hui'}.`), icon: 'leaf' });
  };

  const togglePause = () => {
    const pausing = !snap.current.paused;
    toggleHomePause();
    if (!pausing) {
      voice.hush();
      return;
    }
    const speaker = speakerFor('either');
    react(speaker, 'sleepy');
    voice.say('pause', speaker);
  };

  return { lingering, reaction, bubble: voice.bubble, toggle, skip, restore, togglePause };
}
