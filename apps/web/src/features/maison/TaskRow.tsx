/**
 * Lignes de la liste Maison : tâche du jour (case + options ⋯), geste fait
 * aujourd'hui (annulable), tâche laissée « pas aujourd'hui » (repliée,
 * annulable). Qui s'en charge = nextAssignee (« Tour d’AL » en tour à tour).
 */
import type { ChoreCompletion, HouseholdTask, TaskAssignee } from '@a2/core';
import { useId } from 'react';
import { Checkbox, Companion, Icon, clockTime, cx } from '../../ui';
import type { CompanionMood } from '../../world/types';
import { CairnMark } from './EffortArt';
import { assigneeName, recurrenceLabel, turnLabel } from './taskText';

export type Names = { a: string; b: string };
export type Origin = { x: number; y: number };

export function TaskMeta({ task, turn, names, id }: { task: HouseholdTask; turn: TaskAssignee; names: Names; id?: string }) {
  const rotating = task.rotation === true && (turn === 'a' || turn === 'b');
  return (
    <span className="task-row__meta" id={id}>
      <span>{recurrenceLabel(task)}</span>
      <span className="task-row__dot" aria-hidden="true">
        ·
      </span>
      <span className="visually-hidden">, </span>
      {rotating ? (
        <span className="task-row__turn">
          <Icon name="repeat" size={13} strokeWidth={1.8} />
          {turnLabel(names[turn])}
        </span>
      ) : (
        <span>{assigneeName(turn, names)}</span>
      )}
      {task.effort === 3 && <span className="visually-hidden">, </span>}
      {task.effort === 3 && (
        <span className="chore-badge">
          <CairnMark size={12} />
          corvée
        </span>
      )}
    </span>
  );
}

export function TaskRow({
  task,
  turn,
  checked,
  celebrating,
  names,
  mood,
  onToggle,
  onMenu,
}: {
  task: HouseholdTask;
  /** À qui revient cette occurrence (nextAssignee). */
  turn: TaskAssignee;
  checked: boolean;
  celebrating: boolean;
  names: Names;
  mood: CompanionMood;
  onToggle: (task: HouseholdTask, origin: Origin) => void;
  onMenu: (task: HouseholdTask) => void;
}) {
  const uid = useId();
  const metaId = `${uid}-meta`;
  return (
    <li
      className={cx('task-row', checked && 'is-done', celebrating && 'is-leaving', task.effort === 3 && 'is-chore')}
      data-task-id={task.id}
    >
      <Checkbox
        checked={checked}
        label={task.title}
        tone={turn}
        onToggle={(origin) => onToggle(task, origin)}
        className={celebrating ? 'is-celebrating' : undefined}
        describedBy={metaId}
      />
      <button
        type="button"
        className="task-row__body"
        onClick={() => onMenu(task)}
        aria-labelledby={`${uid}-opt ${uid}-title`}
        aria-describedby={metaId}
        aria-haspopup="dialog"
      >
        <span id={`${uid}-opt`} className="visually-hidden">
          Options :
        </span>
        <span className="task-row__text">
          <span id={`${uid}-title`} className="task-row__title">
            {task.title}
          </span>
          <TaskMeta task={task} turn={turn} names={names} id={metaId} />
        </span>
        <Companion who={turn} size={34} mood={mood} reactKey={celebrating ? 'go' : 'rest'} />
        <span className="task-row__more" aria-hidden="true">
          <Icon name="more" size={20} />
        </span>
      </button>
    </li>
  );
}

export function DoneRow({
  completion,
  task,
  names,
  onUndo,
}: {
  completion: ChoreCompletion;
  task: HouseholdTask | null;
  names: Names;
  onUndo: (task: HouseholdTask, origin: Origin) => void;
}) {
  const who = completion.doneBy ?? completion.assignee;
  const helped =
    completion.doneBy !== undefined &&
    (completion.assignee === 'a' || completion.assignee === 'b') &&
    completion.doneBy !== completion.assignee &&
    completion.doneBy !== 'both';
  return (
    <li className="task-row task-row--done">
      {task ? (
        <Checkbox checked label={`${completion.taskTitle} (annuler)`} tone={who} onToggle={(origin) => onUndo(task, origin)} size="sm" />
      ) : (
        <span className="task-row__spacer" aria-hidden="true">
          <Icon name="check" size={18} />
        </span>
      )}
      <span className="task-row__body task-row__body--static">
        <span className="task-row__text">
          <span className="task-row__title">{completion.taskTitle}</span>
          <span className="task-row__meta">
            <span>{assigneeName(who, names)}</span>
            <span className="task-row__dot" aria-hidden="true">
              ·
            </span>
            <span>{clockTime(new Date(completion.completedAt))}</span>
            {helped && <span className="help-badge">coup de main</span>}
          </span>
        </span>
      </span>
      <Companion who={who} size={28} />
    </li>
  );
}

export function SkippedList({
  tasks,
  onRestore,
}: {
  tasks: HouseholdTask[];
  onRestore: (task: HouseholdTask) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <ul className="skipped" aria-label="Laissé pour plus tard">
      {tasks.map((task) => {
        const week = task.recurrence === 'weekly' && task.flexible === true;
        return (
          <li key={task.id} className="skipped__row">
            <Icon name="moon" size={15} className="skipped__icon" />
            <span className="skipped__text">
              <span className="skipped__title">{task.title}</span>
              <span className="skipped__when">{week ? 'pas cette semaine' : 'pas aujourd’hui'}</span>
            </span>
            <button
              type="button"
              className="skipped__restore"
              onClick={() => onRestore(task)}
              aria-label={`Remettre ${task.title} ${week ? 'cette semaine' : 'aujourd’hui'}`}
            >
              Remettre
            </button>
          </li>
        );
      })}
    </ul>
  );
}
