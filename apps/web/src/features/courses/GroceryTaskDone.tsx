/**
 * Lien Courses ↔ Maison, côté Courses (V5.2 ; V5.3 : tâche permanente) :
 * - `GroceryTaskPill` : dans le bandeau, toujours là tant qu'une tâche
 *   Courses existe — balai, repère de la dernière fois (« hier » + tête du
 *   compagnon), coche ; le toucher demande « qui ? » ;
 * - `GroceryLast` : ce repère, partagé avec la ligne Maison ;
 * - `WhoDidSheet` : Jiji, Calcifer ou les deux, sans phrase ;
 * - `useGroceryTaskDone` : une complétion de plus à chaque fois (geste de
 *   Maison `toggleHomeTask` : forêt, équilibre, historique) + kompeitō,
 *   luciole et toast « Annuler » (annule CE fait seulement).
 * Sans tâche liée : rien n'est affiché, aucune question.
 */
import { addDays, groceryTaskOf, lastGroceryRun, localDateKey, type ChoreDoer, type GroceryRun, type HouseholdTask } from '@a2/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { coursesTheme } from '../../themes/manifest';
import { Companion, Icon, Sheet, dayMonth, fr, useToast, weekdayName } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import './grocery-task.css';

const PILL_ID = 'grocery-task-pill';
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

function Broom() {
  return <img className="grocery-task-pill__broom" src={coursesTheme.broom} alt="" aria-hidden="true" draggable={false} />;
}

export function GroceryTaskPill({ view, onAsk }: { view: GroceryTaskView; onAsk: () => void }) {
  const { task, last } = view;
  const { today } = useApp();
  if (!task) return null;
  const lastText = last ? `, dernière fois : ${lastRunLabel(last.at, today)}` : '';
  return (
    <button type="button" id={PILL_ID} className="grocery-task-pill is-open" onClick={onAsk} aria-label={fr(`${task.title} faites ?${lastText}`)}>
      <Broom />
      {last && <GroceryLast last={last} />}
      <Icon name="check" size={15} strokeWidth={2.2} />
    </button>
  );
}

export function WhoDidSheet({ open, onPick, onClose }: { open: boolean; onPick: (who: ChoreDoer) => void; onClose: () => void }) {
  const { appState } = useApp();
  const names = { a: appState?.budget.settings.personA.name ?? 'AL', b: appState?.budget.settings.personB.name ?? 'AC' };
  const choices: Array<{ who: ChoreDoer; label: string; size: number }> = [
    { who: 'a', label: names.a, size: 56 },
    { who: 'b', label: names.b, size: 56 },
    { who: 'both', label: 'Ensemble', size: 46 },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={fr('Qui ?')} size="auto" className="who-did">
      <div className="who-did__choices" role="group" aria-label={fr('Qui a fait les courses ?')}>
        {choices.map((c) => (
          <button key={c.who} type="button" className="who-did__choice" data-who={c.who} onClick={() => onPick(c.who)} aria-label={c.label}>
            <Companion who={c.who} size={c.size} />
            <span className="who-did__name" aria-hidden="true">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Feuille « qui ? » + geste de Maison. `ask()` l'ouvre dès qu'une tâche Courses existe. */
export function useGroceryTaskDone() {
  const { toggleHomeTask, undoHomeCompletion } = useApp();
  const world = useWorld();
  const toast = useToast();
  const view = useGroceryTask();
  const { task } = view;
  const [asking, setAsking] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const canAsk = task !== undefined;
  const ask = useCallback(() => {
    if (canAsk) setAsking(true);
  }, [canAsk]);

  const whenSheetsClosed = (fn: () => void, waited = 0) => {
    if (waited >= SHEET_WAIT_MS || document.querySelector('dialog[open]') === null) fn();
    else timers.current.push(window.setTimeout(() => whenSheetsClosed(fn, waited + 40), 40));
  };

  const pick = (who: ChoreDoer) => {
    setAsking(false);
    if (!task) return;
    const result = toggleHomeTask(task, { doneBy: who });
    if (!result.completed || result.completionId === null) return;
    const completionId = result.completionId;
    playGive(1, 'soin'); // Un kompeitō au bocal du Budget (jamais retiré).
    world.expectPulse(completionId);
    whenSheetsClosed(() => {
      const r = document.getElementById(PILL_ID)?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? r.top + r.height / 2 : window.innerHeight / 3;
      world.pulse({ id: completionId, who, fromClientX: x, fromClientY: y, ...(task.effort === 3 ? { strong: true } : {}) });
    });
    toast.show({
      message: fr(`Fait : ${task.title}. Une luciole de plus dans la forêt.`),
      icon: 'check',
      action: { label: 'Annuler', onClick: () => undoHomeCompletion(completionId) },
    });
  };

  return { view, canAsk, ask, sheet: <WhoDidSheet open={asking} onPick={pick} onClose={() => setAsking(false)} /> };
}
