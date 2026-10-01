/**
 * Module Maison — compose la scène de forêt, la liste de tâches, la
 * répartition factuelle et le feedback de complétion.
 *
 * Composant autonome : reçoit l'état (tâches, faits, forêt, personnes) en
 * props et émet une action (`onToggle`) via callback. Ne dépend ni du store ni
 * de la coquille — le lead/CODEX l'intègre dans la navigation.
 */

import { useState } from 'react';
import type {
  ChoreCompletion,
  ForestState,
  HouseholdTask,
  Person,
  TaskAssignee,
} from '@a2/core';
import { ForestScene } from './ForestScene';
import { CompletionFeedback } from './CompletionFeedback';
import { TaskList, WeeklyDistribution } from './TaskList';
import './chores.css';

function localKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function MaisonModule({
  tasks,
  completions,
  forest,
  people,
  today,
  onToggle,
}: {
  tasks: HouseholdTask[];
  completions: ChoreCompletion[];
  forest: ForestState;
  people: Person[];
  today: Date;
  onToggle: (task: HouseholdTask) => void;
}) {
  const [feedback, setFeedback] = useState<{ assignee: TaskAssignee; trigger: number }>({
    assignee: 'unassigned',
    trigger: 0,
  });

  const isDone = (task: HouseholdTask): boolean => {
    const dueDate = task.recurrence === 'none' ? 'once' : localKey(today);
    return completions.some((c) => c.taskId === task.id && c.dueDate === dueDate);
  };

  const handleToggle = (task: HouseholdTask) => {
    const wasDone = isDone(task);
    onToggle(task);
    // Feedback positif uniquement à la complétion (pas à l'annulation).
    if (!wasDone) {
      setFeedback((prev) => ({ assignee: task.assignee, trigger: prev.trigger + 1 }));
    }
  };

  return (
    <section className="maison-module" aria-label="Maison">
      <ForestScene forest={forest} />
      <CompletionFeedback
        assignee={feedback.assignee}
        names={{ a: people[0]?.name ?? 'A', b: people[1]?.name ?? 'B' }}
        trigger={feedback.trigger}
      />
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
