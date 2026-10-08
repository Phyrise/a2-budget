/**
 * V5.2 — lien Courses ↔ Maison, côté Courses :
 * - `GroceryTaskPill` : rappel discret de la tâche courses (« Cette semaine »,
 *   « Samedi »…) ; quand elle est à faire, le toucher demande « qui ? » ;
 * - `WhoDidSheet` : Jiji, Calcifer ou les deux, sans phrase ;
 * - `useGroceryTaskDone` : complète l'occurrence en cours avec le geste de
 *   Maison (`toggleHomeTask` : forêt, équilibre, calendrier) + kompeitō,
 *   luciole et toast annulable, comme depuis le Calendrier.
 * Sans tâche liée : rien n'est affiché, aucune question.
 */
import { findOccurrenceCompletion, groceryTaskOf, groceryTaskStatus, parseLocalDateKey, type ChoreDoer, type GroceryTaskStatus, type HouseholdTask } from '@a2/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { coursesTheme } from '../../themes/manifest';
import { Companion, Icon, Sheet, fr, relativeDayLabel, useToast, weekdayName } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import './grocery-task.css';

const PILL_ID = 'grocery-task-pill';
const SHEET_WAIT_MS = 900;

export interface GroceryTaskView {
  task: HouseholdTask | undefined;
  status: GroceryTaskStatus;
  /** L'occurrence en cours est déjà faite. */
  doneNow: boolean;
}

export function useGroceryTask(): GroceryTaskView {
  const { appState, today } = useApp();
  return useMemo(() => {
    const task = groceryTaskOf(appState?.chores.tasks ?? []);
    if (!task || !appState) return { task: undefined, status: { kind: 'none' } as const, doneNow: false };
    const { completions, skips } = appState.chores;
    return {
      task,
      status: groceryTaskStatus(task, completions, skips, today),
      doneNow: findOccurrenceCompletion(task, completions, today) !== undefined,
    };
  }, [appState, today]);
}

function whenLabel(task: HouseholdTask, status: GroceryTaskStatus, today: Date): string | null {
  const week = task.recurrence === 'weekly' && task.flexible === true;
  if (status.kind === 'open') return week ? 'Cette semaine' : 'Aujourd’hui';
  if (status.kind === 'none') return null;
  if (week) return status.daysFromNow <= 7 ? 'La semaine prochaine' : relativeDayLabel(status.date, today);
  return status.daysFromNow <= 6 && status.daysFromNow > 1 ? weekdayName(parseLocalDateKey(status.date)) : relativeDayLabel(status.date, today);
}

function Broom() {
  return <img className="grocery-task-pill__broom" src={coursesTheme.broom} alt="" aria-hidden="true" draggable={false} />;
}

export function GroceryTaskPill({ view, onAsk }: { view: GroceryTaskView; onAsk: () => void }) {
  const { task, status, doneNow } = view;
  const { today } = useApp();
  if (!task) return null;
  const when = whenLabel(task, status, today);
  if (when === null) return null;
  if (status.kind === 'open') {
    return (
      <button type="button" id={PILL_ID} className="grocery-task-pill is-open" onClick={onAsk} aria-label={fr(`${task.title} : ${when.toLowerCase()}. Courses faites ?`)}>
        <Broom />
        <span>{when}</span>
        <Icon name="check" size={15} strokeWidth={2.2} />
      </button>
    );
  }
  return (
    <p id={PILL_ID} className="grocery-task-pill">
      <Broom />
      {doneNow && <Icon name="check" size={14} strokeWidth={2.2} />}
      <span className="visually-hidden">{fr(`${task.title}${doneNow ? ' faites' : ''}, prochaine fois : `)}</span>
      <span>{when}</span>
    </p>
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

/** Feuille « qui ? » + geste de Maison. `ask()` l'ouvre si une occurrence est à faire. */
export function useGroceryTaskDone() {
  const { toggleHomeTask } = useApp();
  const world = useWorld();
  const toast = useToast();
  const view = useGroceryTask();
  const { task, status } = view;
  const [asking, setAsking] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const canAsk = task !== undefined && status.kind === 'open';
  const ask = useCallback(() => {
    if (canAsk) setAsking(true);
  }, [canAsk]);

  const whenSheetsClosed = (fn: () => void, waited = 0) => {
    if (waited >= SHEET_WAIT_MS || document.querySelector('dialog[open]') === null) fn();
    else timers.current.push(window.setTimeout(() => whenSheetsClosed(fn, waited + 40), 40));
  };

  const pick = (who: ChoreDoer) => {
    setAsking(false);
    if (!task || status.kind !== 'open') return;
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
      action: { label: 'Annuler', onClick: () => toggleHomeTask(task) },
    });
  };

  return { view, canAsk, ask, sheet: <WhoDidSheet open={asking} onPick={pick} onClose={() => setAsking(false)} /> };
}
