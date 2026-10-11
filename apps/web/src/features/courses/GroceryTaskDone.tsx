/**
 * Lien Courses ↔ Maison, côté Courses (V5.2 ; V5.3 : tâche permanente ;
 * V5.4 : plus de rappel dans le bandeau ; V5.10 : plus de feuille « qui ? »,
 * un toast pour corriger) :
 * - `GroceryLast` : repère de la dernière fois (« hier » + tête), ligne Maison ;
 * - `useGroceryTaskDone` : une complétion de plus à chaque fois (geste de
 *   Maison `toggleHomeTask` : forêt, équilibre, historique) + kompeitō,
 *   luciole et toast « Courses faites par toi » : corriger qui (soin gardé)
 *   ou « Annuler » : CE fait ET le vidage du panier (V5.8 : les articles
 *   reviennent).
 * Sans tâche liée : rien n'est affiché, aucune question.
 */
import { addDays, expectedDoer, groceryTaskOf, lastGroceryRun, localDateKey, type ChoreDoer, type GroceryRun, type HouseholdTask } from '@a2/core';
import { useCallback, useMemo } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { Companion, dayMonth, useToast, weekdayName } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { useDoneToast } from '../maison/useDoneToast';
import './grocery-task.css';

/** D'où part la luciole : le titre du bandeau (le panier vient d'être vidé). */
const ORIGIN_SELECTOR = '#courses-title';

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
 * Geste de Maison après « Vider le panier ». `done(undoClear)` coche la
 * tâche Courses dès qu'elle existe (faux sinon) : attribuée tout de suite à
 * la personne prévue (V5.10), toast « Courses faites par toi » avec
 * « C'était AC », « Ensemble » et « Annuler » (= CE fait ET le vidage).
 */
export function useGroceryTaskDone() {
  const { toggleHomeTask, undoHomeCompletion, me } = useApp();
  const world = useWorld();
  const toast = useToast();
  const doneToast = useDoneToast();
  const view = useGroceryTask();
  const { task } = view;

  const done = useCallback(
    (undoClear: () => void): boolean => {
      if (!task) return false;
      const planned = expectedDoer(task.assignee, me);
      const result = toggleHomeTask(task, { doneBy: planned });
      if (!result.completed || result.completionId === null) {
        toast.show({ message: 'Panier vidé', icon: 'check', action: { label: 'Annuler', onClick: undoClear } });
        return true;
      }
      const completionId = result.completionId;
      const who: ChoreDoer = result.doneBy === 'a' || result.doneBy === 'b' || result.doneBy === 'both' ? result.doneBy : planned;
      playGive(1, 'soin'); // Un kompeitō au bocal du Budget (jamais retiré).
      const r = document.querySelector(ORIGIN_SELECTOR)?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? r.top + r.height / 2 : window.innerHeight / 3;
      world.pulse({ id: completionId, who, fromClientX: x, fromClientY: y, ...(task.effort === 3 ? { strong: true } : {}) });
      doneToast({
        completionId,
        who,
        subject: 'groceries',
        undo: () => {
          undoHomeCompletion(completionId);
          undoClear();
        },
      });
      return true;
    },
    [task, me, toggleHomeTask, undoHomeCompletion, world, toast, doneToast],
  );

  return { view, done };
}
