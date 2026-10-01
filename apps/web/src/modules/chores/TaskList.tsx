/**
 * Liste de tâches Maison + répartition factuelle de la semaine.
 *
 * Composants autonomes : reçoivent l'état en props et émettent des actions via
 * callbacks. Ne dépendent ni du store ni de la coquille.
 */

import type { ChoreCompletion, HouseholdTask, Person } from '@a2/core';
import { weeklyDistribution } from '@a2/core';
import { PersonDot } from '../../components/PersonDot';
import './chores.css';

/** Libellé de l'assignee (descriptif, non compétitif). */
function assigneeLabel(assignee: HouseholdTask['assignee'], people: Person[]): string {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
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
  onToggle,
}: {
  task: HouseholdTask;
  people: Person[];
  done: boolean;
  onToggle: (task: HouseholdTask) => void;
}) {
  return (
    <li className={`task-row ${done ? 'is-done' : ''}`}>
      <label className="task-row__check">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(task)}
          aria-label={`Marquer « ${task.title} » comme ${done ? 'à refaire' : 'terminé'}`}
        />
        <span className="task-row__box" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </span>
      </label>
      <div className="task-row__body">
        <span className="task-row__title">{task.title}</span>
        <span className="task-row__meta">
          {assigneeLabel(task.assignee, people)} · {recurrenceLabel(task)}
        </span>
      </div>
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
    const dueDate = task.recurrence === 'none' ? 'once' : localKey(today);
    return completions.some((c) => c.taskId === task.id && c.dueDate === dueDate);
  };
  const dueToday = tasks.filter((t) => {
    if (t.recurrence === 'none') return !isDone(t);
    // dueOn est calculé via la date locale
    return isDueToday(t, today) && !isDone(t);
  });
  const rest = tasks.filter((t) => !dueToday.includes(t));

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
      {rest.length > 0 && (
        <>
          <h3 className="task-list__section">Autres tâches</h3>
          <ul className="task-list__items">
            {rest.map((t) => (
              <TaskRow key={t.id} task={t} people={people} done={isDone(t)} onToggle={onToggle} />
            ))}
          </ul>
        </>
      )}
      {tasks.length === 0 && <p className="task-list__empty">Aucune tâche pour l'instant.</p>}
    </div>
  );
}

/** Clé locale YYYY-MM-DD (copie légère pour éviter l'import dans ce fichier). */
function localKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Une occurrence est-elle due aujourd'hui ? (récurrence locale). */
function isDueToday(task: HouseholdTask, today: Date): boolean {
  switch (task.recurrence) {
    case 'daily':
      return true;
    case 'weekly': {
      const js = today.getDay();
      const iso = js === 0 ? 7 : js;
      return iso === task.weeklyDay;
    }
    case 'monthly': {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const target = Math.min(task.monthlyDay ?? 1, daysInMonth);
      return today.getDate() === target;
    }
    default:
      return false;
  }
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
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const rows: { label: string; value: number; tone?: 'a' | 'b' }[] = [
    { label: name('a'), value: dist.a, tone: 'a' },
    { label: name('b'), value: dist.b, tone: 'b' },
    { label: 'Ensemble', value: dist.both },
  ];
  return (
    <div className="weekly-dist" aria-label="Répartition de la semaine">
      <h3 className="weekly-dist__title">Cette semaine</h3>
      <ul className="weekly-dist__rows">
        {rows.map((row) => (
          <li key={row.label} className="weekly-dist__row">
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
