/**
 * Module Maison — compose la scène de forêt, la liste de tâches, la
 * répartition factuelle et le feedback de complétion.
 *
 * Composant autonome : reçoit l'état (tâches, faits, forêt, personnes) en
 * props et émet une action (`onToggle`) via callback. Ne dépend ni du store ni
 * de la coquille — le lead/CODEX l'intègre dans la navigation.
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

  const isDone = (task: HouseholdTask): boolean => {
    const dueDate = task.recurrence === 'none' ? 'once' : localDateKey(today);
    return hasCompletion(completions, task.id, dueDate);
  };

  const handleToggle = (task: HouseholdTask) => {
    const wasDone = isDone(task);
    // Upcoming occurrences cannot be completed or receive celebratory feedback.
    if (!wasDone && !isActionableToday(task, today, completions)) return;
    onToggle(task);
    // Feedback positif uniquement à la complétion (pas à l'annulation).
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
      {actions}
      <TaskList
        tasks={tasks}
        people={people}
        completions={completions}
        today={today}
        onToggle={handleToggle}
      />
      <WeeklyDistribution completions={completions} people={people} now={today} />
    </section>
  );
}
