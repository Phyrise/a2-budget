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

export function useMaisonActions(names: Names, snapshot: Snapshot) {
  const { toggleHomeTask, skipToday, unskipToday, toggleHomePause } = useApp();
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

  const toggle = (task: HouseholdTask, origin: Origin, doneBy?: ChoreDoer) => {
    const { actionable, completions, doneTodayCount } = snap.current;
    const planned = nextAssignee(task, completions);
    const result = toggleHomeTask(task, doneBy !== undefined ? { doneBy } : undefined);
    if (result.completionId === null) return;
    const completionId = result.completionId;
    if (!result.completed) {
      dropLingering(task.id);
      return;
    }
    const who = (result.doneBy ?? planned) as Who;
    world.pulse({ id: completionId, who, fromClientX: origin.x, fromClientY: origin.y, ...(task.effort === 3 ? { strong: true } : {}) });
    setLingering((m) => ({ ...m, [task.id]: completionId }));
    later(() => dropLingering(task.id, completionId), LINGER_MS);
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
    voice.say('skip', speaker);
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
