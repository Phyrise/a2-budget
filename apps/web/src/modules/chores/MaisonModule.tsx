/**
 * Module Maison — compose la scène de forêt (fenêtre sur le monde), la liste
 * de tâches compacte, la répartition factuelle et le feedback de complétion.
 *
 * L'ajout de tâche se fait dans une petite sheet (bouton +), pas dans un grand
 * formulaire permanent. Composant autonome : reçoit l'état en props et émet
 * `onToggle` via callback.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  ChoreCompletion,
  ForestState,
  HouseholdTask,
  Person,
  TaskAssignee,
} from '@a2/core';
import { hasCompletion, isActionableToday, localDateKey } from '@a2/core';
import { ForestScene } from './ForestScene';
import { CompletionFeedback } from './CompletionFeedback';
import { TaskList, WeeklyDistribution } from './TaskList';
import './chores.css';

export function MaisonModule({
  tasks,
  completions,
  forest,
  people,
  today,
  onToggle,
  actions,
}: {
  tasks: HouseholdTask[];
  completions: ChoreCompletion[];
  forest: ForestState;
  people: Person[];
  today: Date;
  onToggle: (task: HouseholdTask) => void;
  actions?: ReactNode;
}) {
  const [feedback, setFeedback] = useState<{ assignee: TaskAssignee; trigger: number }>({
    assignee: 'unassigned',
    trigger: 0,
  });
  const [showGuardian, setShowGuardian] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const previousRareEvent = useRef(forest.lastRareEvent);

  useEffect(() => {
    const previous = previousRareEvent.current;
    previousRareEvent.current = forest.lastRareEvent;

    if (forest.lastRareEvent !== 'guardian') {
      setShowGuardian(false);
      return;
    }
    if (previous === 'guardian') return;

    setShowGuardian(true);
    const timer = window.setTimeout(() => setShowGuardian(false), 6000);
    return () => window.clearTimeout(timer);
  }, [forest.lastRareEvent]);

  // Fermer la sheet avec Échap.
  useEffect(() => {
    if (!showAdd) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAdd(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAdd]);

  const isDone = (task: HouseholdTask): boolean => {
    const dueDate = task.recurrence === 'none' ? 'once' : localDateKey(today);
    return hasCompletion(completions, task.id, dueDate);
  };

  const handleToggle = (task: HouseholdTask) => {
    const wasDone = isDone(task);
    if (!wasDone && !isActionableToday(task, today, completions)) return;
    onToggle(task);
    if (!wasDone) {
      setFeedback((prev) => ({ assignee: task.assignee, trigger: prev.trigger + 1 }));
    }
  };

  return (
    <section className="maison-module" aria-label="Maison">
      <ForestScene forest={forest} showGuardian={showGuardian} />
      <CompletionFeedback
        assignee={feedback.assignee}
        names={{ a: people[0]?.name ?? 'A', b: people[1]?.name ?? 'B' }}
        trigger={feedback.trigger}
      />

      <div className="maison-today">
        <h3 className="maison-today__title">Aujourd'hui</h3>
        <button
          type="button"
          className="maison-today__add"
          aria-label="Nouvelle tâche"
          aria-haspopup="dialog"
          onClick={() => setShowAdd(true)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <TaskList
        tasks={tasks}
        people={people}
        completions={completions}
        today={today}
        onToggle={handleToggle}
      />
      <WeeklyDistribution completions={completions} people={people} now={today} />

      {showAdd && (
        <div className="maison-sheet" role="dialog" aria-modal="true" aria-label="Nouvelle tâche">
          <div className="maison-sheet__backdrop" onClick={() => setShowAdd(false)} aria-hidden="true" />
          <div className="maison-sheet__panel">
            <header className="maison-sheet__head">
              <h4 className="maison-sheet__title">Nouvelle tâche</h4>
              <button type="button" className="maison-sheet__close" aria-label="Fermer" onClick={() => setShowAdd(false)}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <div className="maison-sheet__body">{actions}</div>
          </div>
        </div>
      )}
    </section>
  );
}
