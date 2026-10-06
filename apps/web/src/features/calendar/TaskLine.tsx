/**
 * Une tâche de la maison dans le Calendrier : ligne légère, sans carte (les
 * événements, eux, sont des cartes teintées) — petite case, titre, rythme,
 * compagnon de qui s'en charge. Faite : barrée, jamais retirée. Seule
 * l'occurrence du jour (ou une ponctuelle) se coche ici ; les autres jours
 * montrent un simple rond, en lecture.
 */
import { Checkbox, Companion, Icon, cx, fr } from '../../ui';
import { assigneeName, recurrenceLabel } from '../maison/taskText';
import type { Names } from './EventList';
import type { TaskItem } from './taskAgenda';
import './tasks.css';

export type TaskToggle = (item: TaskItem, origin: { x: number; y: number }) => void;

function statusWords(item: TaskItem): string {
  if (item.done) return 'faite';
  if (item.skipped) return 'pas cette fois';
  return 'à faire';
}

export function TaskLine({
  item,
  names,
  celebrating = false,
  onToggle,
}: {
  item: TaskItem;
  names: Names;
  celebrating?: boolean;
  onToggle: TaskToggle;
}) {
  const { task, who } = item;
  const person = assigneeName(who, names);
  const label = fr(`${task.title} (tâche, ${recurrenceLabel(task).toLowerCase()}, ${person})`);
  return (
    <li
      className={cx('cal-task', item.done && 'is-done', item.skipped && 'is-skipped', celebrating && 'is-celebrating')}
      data-task-id={task.id}
      data-date={item.date}
    >
      {item.checkable ? (
        <Checkbox checked={item.done} label={label} tone={item.done ? 'neutral' : who} size="sm" onToggle={(origin) => onToggle(item, origin)} />
      ) : (
        <span className="cal-task__mark" aria-hidden="true">
          {item.done && <Icon name="check" size={13} strokeWidth={2.4} />}
        </span>
      )}
      <span className="cal-task__body">
        <span className="cal-task__title">
          {task.title}
          {!item.checkable && <span className="visually-hidden">{`, ${statusWords(item)}`}</span>}
        </span>
        <span className="cal-task__meta">
          <Icon name="leaf" size={12} strokeWidth={1.8} className="cal-task__leaf" />
          <span>{recurrenceLabel(task)}</span>
          {item.skipped && (
            <>
              <span aria-hidden="true">·</span>
              <span>pas cette fois</span>
            </>
          )}
        </span>
      </span>
      <span className="cal-task__who" title={person}>
        <Companion who={who} size={who === 'both' ? 20 : 22} />
      </span>
      {celebrating && <span className="cal-task__glow" aria-hidden="true" />}
    </li>
  );
}

export function TaskLines({
  items,
  names,
  celebratingKey,
  onToggle,
}: {
  items: TaskItem[];
  names: Names;
  celebratingKey: string | null;
  onToggle: TaskToggle;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="cal-tasks" aria-label="Tâches de la maison">
      {items.map((item) => (
        <TaskLine key={item.key} item={item} names={names} celebrating={item.key === celebratingKey} onToggle={onToggle} />
      ))}
    </ul>
  );
}
