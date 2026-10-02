/**
 * Liste de tâches Maison + répartition factuelle de la semaine.
 *
 * Composants autonomes : reçoivent l'état en props et émettent des actions via
 * callbacks. Ne dépendent ni du store ni de la coquille.
 */

import { useId } from 'react';
import type { ChoreCompletion, HouseholdTask, Person } from '@a2/core';
import { actionableTasksToday, hasCompletion, localDateKey, weeklyDistribution } from '@a2/core';
import { PersonDot } from '../../components/PersonDot';
import './chores.css';

/** Libellé de l'assignee (descriptif, non compétitif). */
function assigneeLabel(assignee: HouseholdTask['assignee'], people: Person[]): string {
  // a/b represent household slots; migrated people may keep custom V1 IDs.
  const name = (slot: 'a' | 'b') => people[slot === 'a' ? 0 : 1]?.name ?? (slot === 'a' ? 'AL' : 'AC');
  switch (assignee) {
    case 'a':
      return name('a');
    case 'b':
      return name('b');
    case 'both':
      return `${name('a')} & ${name('b')}`;
    default:
      return 'À répartir';
  }
}

/** Libellé de la récurrence (court). */
function recurrenceLabel(task: HouseholdTask): string {
  switch (task.recurrence) {
    case 'daily':
      return 'chaque jour';
    case 'weekly':
      return 'chaque semaine';
    case 'monthly':
      return 'chaque mois';
    default:
      return 'ponctuel';
  }
}

export function TaskRow({
  task,
  people,
  done,
  disabled = false,
  onToggle,
}: {
  task: HouseholdTask;
  people: Person[];
  done: boolean;
  disabled?: boolean;
  onToggle: (task: HouseholdTask) => void;
}) {
  const metaId = useId();
  return (
    <li className={`task-row ${done ? 'is-done' : ''} ${disabled ? 'is-upcoming' : ''}`}>
      <label className="task-row__check">
        <input
          type="checkbox"
          checked={done}
          disabled={disabled}
          onChange={() => onToggle(task)}
          aria-label={`Marquer « ${task.title} » comme ${done ? 'à refaire' : 'terminé'}`}
          aria-describedby={metaId}
        />
        <span className="task-row__box" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </span>
        <span className="task-row__body">
          <span className="task-row__title">{task.title}</span>
          <span id={metaId} className="task-row__meta">
            {assigneeLabel(task.assignee, people)} · {recurrenceLabel(task)}
            {disabled && ' · Prévue un autre jour'}
          </span>
        </span>
      </label>
      <span className="task-row__who" aria-hidden="true">
        {task.assignee === 'a' && <PersonDot name={people[0]?.name ?? 'A'} tone="a" />}
        {task.assignee === 'b' && <PersonDot name={people[1]?.name ?? 'B'} tone="b" />}
        {task.assignee === 'both' && (
          <>
            <PersonDot name={people[0]?.name ?? 'A'} tone="a" />
            <PersonDot name={people[1]?.name ?? 'B'} tone="b" />
          </>
        )}
      </span>
    </li>
  );
}

export function TaskList({
  tasks,
  people,
  completions,
  today,
  onToggle,
}: {
  tasks: HouseholdTask[];
  people: Person[];
  completions: ChoreCompletion[];
  today: Date;
  onToggle: (task: HouseholdTask) => void;
}) {
  const isDone = (task: HouseholdTask): boolean => {
    const dueDate = task.recurrence === 'none' ? 'once' : localDateKey(today);
    return hasCompletion(completions, task.id, dueDate);
  };
  const dueToday = actionableTasksToday(tasks, today, completions);
  const completed = tasks.filter(isDone);
  const upcoming = tasks.filter((task) => !dueToday.includes(task) && !completed.includes(task));

  return (
    <div className="task-list">
      {dueToday.length > 0 && (
        <>
          <h3 className="task-list__section">Aujourd'hui</h3>
          <ul className="task-list__items">
            {dueToday.map((t) => (
              <TaskRow key={t.id} task={t} people={people} done={isDone(t)} onToggle={onToggle} />
            ))}
          </ul>
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <h3 className="task-list__section">À venir</h3>
          <ul className="task-list__items">
            {upcoming.map((task) => (
              <TaskRow key={task.id} task={task} people={people} done={false} disabled onToggle={onToggle} />
            ))}
          </ul>
        </>
      )}
      {completed.length > 0 && (
        <details className="task-list__completed">
          <summary>Terminées ({completed.length})</summary>
          <ul className="task-list__items">
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} people={people} done onToggle={onToggle} />
            ))}
          </ul>
        </details>
      )}
      {tasks.length === 0 && <p className="task-list__empty">Aucune tâche pour l'instant.</p>}
    </div>
  );
}

/** Répartition factuelle de la semaine (qui a fait quoi). */
export function WeeklyDistribution({
  completions,
  people,
  now,
}: {
  completions: ChoreCompletion[];
  people: Person[];
  now: Date;
}) {
  const dist = weeklyDistribution(completions, now);
  const name = (slot: 'a' | 'b') => people[slot === 'a' ? 0 : 1]?.name ?? (slot === 'a' ? 'AL' : 'AC');
  const rows: { id: string; label: string; value: number; tone?: 'a' | 'b' }[] = [
    { id: 'a', label: name('a'), value: dist.a, tone: 'a' },
    { id: 'b', label: name('b'), value: dist.b, tone: 'b' },
    { id: 'both', label: 'Ensemble', value: dist.both },
    ...(dist.unassigned > 0 ? [{ id: 'unassigned', label: 'À répartir', value: dist.unassigned }] : []),
  ];
  return (
    <div className="weekly-dist" aria-label="Répartition de la semaine">
      <h3 className="weekly-dist__title">Cette semaine</h3>
      <ul className="weekly-dist__rows">
        {rows.map((row) => (
          <li key={row.id} className="weekly-dist__row">
            <span className="weekly-dist__label">
              {row.tone && <PersonDot name={row.label} tone={row.tone} />}
              {row.label}
            </span>
            <span className="weekly-dist__value">{row.value}</span>
          </li>
        ))}
      </ul>
      <p className="weekly-dist__hint">Un simple aperçu, rien à gagner ni à perdre.</p>
    </div>
  );
}
