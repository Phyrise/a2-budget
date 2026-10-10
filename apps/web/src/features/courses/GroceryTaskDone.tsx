/**
 * Lien Courses ↔ Maison, côté Courses (V5.2 ; V5.3 : tâche permanente ;
 * V5.4 : plus de rappel dans le bandeau, seulement « qui ? » après « Vider
 * le panier ») :
 * - `GroceryLast` : repère de la dernière fois (« hier » + tête), ligne Maison ;
 * - `useGroceryTaskDone` : une complétion de plus à chaque fois (geste de
 *   Maison `toggleHomeTask` : forêt, équilibre, historique) + kompeitō,
 *   luciole et toast « Annuler » : annule CE fait ET le vidage du panier
 *   (V5.8 : les articles reviennent) ; « qui ? » fermé sans choisir →
 *   toast « Panier vidé » annulable.
 * Sans tâche liée : rien n'est affiché, aucune question.
 */
import { addDays, groceryTaskOf, lastGroceryRun, localDateKey, type ChoreDoer, type GroceryRun, type HouseholdTask } from '@a2/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { Companion, dayMonth, fr, useToast, weekdayName } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { WhoDidSheet, likelyDoer } from '../maison/WhoDidSheet';
import './grocery-task.css';

/** D'où part la luciole : le titre du bandeau (le panier vient d'être vidé). */
const ORIGIN_SELECTOR = '#courses-title';
const SHEET_WAIT_MS = 900;

export interface GroceryTaskView {
  task: HouseholdTask | undefined;
  /** La dernière fois (undefined : jamais). */
  last: GroceryRun | undefined;
}

export function useGroceryTask(): GroceryTaskView {
  const { appState } = useApp();
  return useMemo(() => {
    const task = groceryTaskOf(appState?.chores.tasks ?? []);
    if (!task || !appState) return { task: undefined, last: undefined };
    return { task, last: lastGroceryRun(task, appState.chores.completions) };
  }, [appState]);
}

/** « aujourd’hui », « hier », « lundi » (cette semaine), sinon « 3 octobre ». */
export function lastRunLabel(at: string, today: Date): string {
  const day = localDateKey(new Date(at));
  if (day === localDateKey(today)) return 'aujourd’hui';
  if (day === localDateKey(addDays(today, -1))) return 'hier';
  if (day > localDateKey(addDays(today, -7))) return weekdayName(new Date(at)).toLowerCase();
  return dayMonth(new Date(at));
}

/** Repère discret de la dernière fois : « hier » + tête de qui l'a fait. */
export function GroceryLast({ last, size = 16 }: { last: GroceryRun; size?: number }) {
  const { today } = useApp();
  return (
    <span className="grocery-last">
      <span>{lastRunLabel(last.at, today)}</span>
      <Companion who={last.who} size={size} />
    </span>
  );
}

/**
 * Feuille « qui ? » + geste de Maison. `ask(undoClear)` l'ouvre dès qu'une
 * tâche Courses existe (faux sinon) ; `undoClear` annule le vidage du panier.
 */
export function useGroceryTaskDone() {
  const { toggleHomeTask, undoHomeCompletion, me } = useApp();
  const world = useWorld();
  const toast = useToast();
  const view = useGroceryTask();
  const { task } = view;
  const [asking, setAsking] = useState(false);
  const timers = useRef<number[]>([]);
  // Annulation du vidage en attente de la réponse à « qui ? ».
  const undoClearRef = useRef<(() => void) | null>(null);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const canAsk = task !== undefined;
  const ask = useCallback(
    (undoClear: () => void): boolean => {
      if (!canAsk) return false;
      undoClearRef.current = undoClear;
      setAsking(true);
      return true;
    },
    [canAsk],
  );

  const whenSheetsClosed = (fn: () => void, waited = 0) => {
    if (waited >= SHEET_WAIT_MS || document.querySelector('dialog[open]') === null) fn();
    else timers.current.push(window.setTimeout(() => whenSheetsClosed(fn, waited + 40), 40));
  };

  /** Personne n'est choisi : le vidage reste annulable. */
  const emptied = (undoClear: () => void) =>
    toast.show({ message: 'Panier vidé', icon: 'check', action: { label: 'Annuler', onClick: undoClear } });

  const pick = (who: ChoreDoer) => {
    setAsking(false);
    const undoClear = undoClearRef.current ?? (() => undefined);
    undoClearRef.current = null;
    if (!task) return;
    const result = toggleHomeTask(task, { doneBy: who });
    if (!result.completed || result.completionId === null) {
      emptied(undoClear);
      return;
    }
    const completionId = result.completionId;
    playGive(1, 'soin'); // Un kompeitō au bocal du Budget (jamais retiré).
    world.expectPulse(completionId);
    whenSheetsClosed(() => {
      const r = document.querySelector(ORIGIN_SELECTOR)?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? r.top + r.height / 2 : window.innerHeight / 3;
      world.pulse({ id: completionId, who, fromClientX: x, fromClientY: y, ...(task.effort === 3 ? { strong: true } : {}) });
    });
    toast.show({
      message: fr(`Fait : ${task.title}. Une luciole de plus dans la forêt.`),
      icon: 'check',
      action: {
        label: 'Annuler',
        onClick: () => {
          undoHomeCompletion(completionId);
          undoClear();
        },
      },
    });
  };

  const close = () => {
    setAsking(false);
    const undoClear = undoClearRef.current;
    undoClearRef.current = null;
    if (undoClear !== null) emptied(undoClear);
  };

  return {
    view,
    canAsk,
    ask,
    sheet: (
      <WhoDidSheet open={asking} onPick={pick} onClose={close} title={task?.title} suggested={likelyDoer(task?.assignee, me)} />
    ),
  };
}
