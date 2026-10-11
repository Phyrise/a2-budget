/**
 * Cocher une tâche de la maison depuis le Calendrier (V4) : même geste que
 * dans Maison — `toggleHomeTask` (occurrence du jour, ou ponctuelle), la
 * luciole s'envole depuis la case vers la forêt quand elle est visible
 * (ordinateur), une lueur de rizière sur la ligne. Décocher ne dit rien de
 * plus que la case elle-même.
 * V5.10 : cocher attribue tout de suite à la personne prévue (expectedDoer) ;
 * toast « Fait par toi » (useDoneToast) : « C'était AC », « Ensemble »
 * (l'auteur change, soin gardé) ou « Annuler » (V5.9 : ce fait précis,
 * undoHomeCompletion — luciole éteinte, soin retiré, jamais une recoche).
 * Appui long sur la case : la feuille « Qui ? » complète (WhoDidSheet) ;
 * la fermer sans choisir ne coche rien.
 */
import { expectedDoer, type ChoreDoer } from '@a2/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { useWorld } from '../../world/WorldContext';
import { useDoneToast } from '../maison/useDoneToast';
import { WhoDidSheet, likelyDoer } from '../maison/WhoDidSheet';
import type { TaskItem } from './taskAgenda';

const GLOW_MS = 1400;
/** Attente maximale de la fermeture de la feuille avant l'envol. */
const SHEET_WAIT_MS = 900;

type Origin = { x: number; y: number };

export function useTaskToggle(): {
  celebratingKey: string | null;
  toggle: (item: TaskItem, origin: Origin) => void;
  /** Appui long : « Qui ? » avant de cocher. */
  askWho: (item: TaskItem, origin: Origin) => void;
  asking: boolean;
  sheet: ReactNode;
} {
  const { toggleHomeTask, undoHomeCompletion, me } = useApp();
  const world = useWorld();
  const doneToast = useDoneToast();
  const [celebratingKey, setCelebratingKey] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ item: TaskItem; origin: Origin } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const waits = useRef<number[]>([]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      waits.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const whenSheetsClosed = useCallback((fn: () => void, waited = 0) => {
    if (waited >= SHEET_WAIT_MS || document.querySelector('dialog[open]') === null) fn();
    else waits.current.push(window.setTimeout(() => whenSheetsClosed(fn, waited + 40), 40));
  }, []);

  /** Coche avec un auteur ; `fromSheet` : le vol attend la fermeture de la feuille. */
  const check = (item: TaskItem, origin: Origin, doneBy: ChoreDoer, fromSheet: boolean) => {
    const task = item.task;
    const result = toggleHomeTask(task, { doneBy });
    if (result.completionId === null || !result.completed) return;
    const completionId = result.completionId;
    const who: ChoreDoer = result.doneBy === 'a' || result.doneBy === 'b' || result.doneBy === 'both' ? result.doneBy : doneBy;
    playGive(1, 'soin'); // Un kompeitō au bocal du Budget (jamais retiré).
    const fly = () =>
      world.pulse({ id: completionId, who, fromClientX: origin.x, fromClientY: origin.y, ...(task.effort === 3 ? { strong: true } : {}) });
    if (fromSheet) {
      world.expectPulse(completionId);
      whenSheetsClosed(fly);
    } else fly();
    window.clearTimeout(timer.current);
    setCelebratingKey(item.key);
    timer.current = window.setTimeout(() => setCelebratingKey(null), GLOW_MS);
    // Annule CE fait précis : déjà décoché à la case, « Annuler » ne recoche rien.
    doneToast({ completionId, who, undo: () => undoHomeCompletion(completionId) });
  };

  const toggle = (item: TaskItem, origin: Origin) => {
    if (!item.checkable) return;
    // Décocher : sans question.
    if (item.done) toggleHomeTask(item.task);
    else check(item, origin, expectedDoer(item.who, me), false);
  };

  const askWho = (item: TaskItem, origin: Origin) => {
    if (item.checkable && !item.done) setAsking({ item, origin });
  };

  const pick = (doneBy: ChoreDoer) => {
    const pending = asking;
    setAsking(null);
    if (pending !== null) check(pending.item, pending.origin, doneBy, true);
  };

  const sheet = (
    <WhoDidSheet
      open={asking !== null}
      title={asking?.item.task.title}
      suggested={asking ? likelyDoer(asking.item.who, me) : undefined}
      onPick={pick}
      onClose={() => setAsking(null)}
    />
  );

  return { celebratingKey, toggle, askWho, asking: asking !== null, sheet };
}
