/**
 * Cocher une tâche de la maison depuis le Calendrier (V4) : même geste que
 * dans Maison — `toggleHomeTask` (occurrence du jour, ou ponctuelle), la
 * luciole s'envole depuis la case vers la forêt quand elle est visible
 * (ordinateur), une lueur de rizière sur la ligne, un toast doux avec
 * « Annuler ». Décocher ne dit rien de plus que la case elle-même.
 * V5.4 : cocher demande d'abord « qui ? » (WhoDidSheet) ; fermer sans
 * choisir ne coche rien. Kompeitō et luciole partent après le choix.
 * V5.9 : « Annuler » retire ce fait précis (undoHomeCompletion) : luciole
 * éteinte, soin retiré de l'objectif de la semaine, jamais une recoche.
 */
import type { ChoreDoer } from '@a2/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { fr, useToast } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { WhoDidSheet, likelyDoer } from '../maison/WhoDidSheet';
import type { TaskItem } from './taskAgenda';

const GLOW_MS = 1400;
/** Attente maximale de la fermeture de la feuille avant l'envol. */
const SHEET_WAIT_MS = 900;

type Origin = { x: number; y: number };

export function useTaskToggle(): {
  celebratingKey: string | null;
  toggle: (item: TaskItem, origin: Origin) => void;
  asking: boolean;
  sheet: ReactNode;
} {
  const { toggleHomeTask, undoHomeCompletion, me } = useApp();
  const world = useWorld();
  const toast = useToast();
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

  const toggle = useCallback(
    (item: TaskItem, origin: Origin) => {
      if (!item.checkable) return;
      // Décocher : sans question.
      if (item.done) toggleHomeTask(item.task);
      else setAsking({ item, origin });
    },
    [toggleHomeTask],
  );

  const pick = (doneBy: ChoreDoer) => {
    const pending = asking;
    setAsking(null);
    if (pending === null) return;
    const { item, origin } = pending;
    const task = item.task;
    const result = toggleHomeTask(task, { doneBy });
    if (result.completionId === null || !result.completed) return;
    const completionId = result.completionId;
    playGive(1, 'soin'); // Un kompeitō au bocal du Budget (jamais retiré).
    world.expectPulse(completionId);
    whenSheetsClosed(() =>
      world.pulse({ id: completionId, who: result.doneBy ?? doneBy, fromClientX: origin.x, fromClientY: origin.y, ...(task.effort === 3 ? { strong: true } : {}) }),
    );
    window.clearTimeout(timer.current);
    setCelebratingKey(item.key);
    timer.current = window.setTimeout(() => setCelebratingKey(null), GLOW_MS);
    toast.show({
      message: fr(`Fait : ${task.title}. Une luciole de plus dans la forêt.`),
      icon: 'check',
      // Annule CE fait précis : déjà décoché à la case, « Annuler » ne recoche rien.
      action: { label: 'Annuler', onClick: () => undoHomeCompletion(completionId) },
    });
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

  return { celebratingKey, toggle, asking: asking !== null, sheet };
}
