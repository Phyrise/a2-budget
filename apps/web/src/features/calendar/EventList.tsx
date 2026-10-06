/**
 * Lignes d'événements : un événement (nature, titre, heure, lieu, pour qui,
 * première ligne de la note), la liste d'un jour, et « À venir » groupé par
 * jour (« Demain », « Samedi 10 octobre »). Toucher un événement ouvre son
 * édition. Les anniversaires sont mis en valeur (« Anniversaire de Léa »,
 * âge seulement si l'année est connue). V4 : les tâches de la maison du
 * jour suivent les événements, en lignes légères (TaskLine).
 */
import { parseLocalDateKey, type CalendarOccurrence } from '@a2/core';
import { Companion, Icon, cx, dayMonth, fr } from '../../ui';
import {
  dayHeading,
  displayTitle,
  timeRangeLabel,
  timeRangeSpoken,
  whoLabel,
  yearsLabel,
} from './calendarText';
import { KindBadge, kindMeta } from './kinds';
import type { AgendaDay, TaskItem } from './taskAgenda';
import { TaskLines, type TaskToggle } from './TaskLine';
import './events.css';

export interface Names {
  a: string;
  b: string;
}

/** Première ligne non vide de la note (affichée en petit sous l'événement). */
export function noteFirstLine(note: string | undefined): string | null {
  if (!note) return null;
  const line = note
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '');
  return line ?? null;
}

function spokenLabel(o: CalendarOccurrence, names: Names, withDay: string | null): string {
  const e = o.event;
  const years = yearsLabel(o);
  const note = noteFirstLine(e.note);
  const parts = [
    `Modifier « ${displayTitle(e)} »`,
    years,
    withDay,
    timeRangeSpoken(e),
    e.place ? `lieu : ${e.place}` : null,
    whoLabel(e.who, names).toLowerCase(),
    kindMeta(e.kind).label.toLowerCase(),
    e.yearly ? 'tous les ans' : null,
    note ? `note : ${note}` : null,
  ];
  return fr(parts.filter(Boolean).join(', '));
}

export function EventRow({
  occurrence,
  names,
  highlight = false,
  dayForSpeech = null,
  onOpen,
}: {
  occurrence: CalendarOccurrence;
  names: Names;
  highlight?: boolean;
  /** Jour lu par le lecteur d'écran (listes « À venir »). */
  dayForSpeech?: string | null;
  onOpen: (occurrence: CalendarOccurrence) => void;
}) {
  const e = occurrence.event;
  const birthday = e.kind === 'anniversaire';
  const years = yearsLabel(occurrence);
  const time = timeRangeLabel(e);
  const note = noteFirstLine(e.note);
  return (
    <li className={cx('cal-event', birthday && 'cal-event--birthday', highlight && 'is-new')}>
      <button type="button" className="cal-event__open" onClick={() => onOpen(occurrence)} aria-label={spokenLabel(occurrence, names, dayForSpeech)}>
        <KindBadge kind={e.kind} size={40} />
        <span className="cal-event__body">
          <span className="cal-event__title">
            {displayTitle(e)}
            {years && <span className="cal-event__age">{years}</span>}
          </span>
          <span className="cal-event__meta">
            <span className={cx('cal-event__time', e.allDay && 'is-allday')}>{time}</span>
            {e.place && (
              <>
                <span className="cal-event__sep" aria-hidden="true">
                  ·
                </span>
                <span className="cal-event__place">{e.place}</span>
              </>
            )}
            {e.yearly && !birthday && <Icon name="repeat" size={14} className="cal-event__yearly" />}
          </span>
          {note && (
            <span className="cal-event__note">
              <Icon name="feather" size={13} strokeWidth={1.7} className="cal-event__note-icon" />
              <span className="cal-event__note-text">{note}</span>
            </span>
          )}
        </span>
        <span className="cal-event__who" title={whoLabel(e.who, names)}>
          <Companion who={e.who} size={e.who === 'both' ? 28 : 30} />
        </span>
      </button>
    </li>
  );
}

interface AgendaProps {
  names: Names;
  highlightId: string | null;
  celebratingKey: string | null;
  onOpen: (occurrence: CalendarOccurrence) => void;
  onToggleTask: TaskToggle;
}

/** Un jour : ses événements, puis ses tâches de la maison. */
export function DayAgenda({
  events,
  tasks,
  dayForSpeech = null,
  names,
  highlightId,
  celebratingKey,
  onOpen,
  onToggleTask,
}: AgendaProps & { events: CalendarOccurrence[]; tasks: TaskItem[]; dayForSpeech?: string | null }) {
  return (
    <>
      {events.length > 0 && (
        <ul className="cal-events">
          {events.map((o) => (
            <EventRow
              key={`${o.event.id}-${o.date}`}
              occurrence={o}
              names={names}
              highlight={o.event.id === highlightId}
              dayForSpeech={dayForSpeech}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
      <TaskLines items={tasks} names={names} celebratingKey={celebratingKey} onToggle={onToggleTask} />
    </>
  );
}

/** Plusieurs jours (« À venir », aperçu du mois), chacun sous son titre. */
export function AgendaList({ days, today, ...rest }: AgendaProps & { days: AgendaDay[]; today: Date }) {
  return (
    <ol className="cal-upcoming">
      {days.map((day) => {
        const heading = dayHeading(day.date, today);
        const relative = heading === 'Aujourd’hui' || heading === 'Demain';
        return (
          <li key={day.date} className="cal-upcoming__day">
            <h3 className="cal-upcoming__when">
              <span className="cal-upcoming__heading">{heading}</span>
              {relative && <span className="cal-upcoming__date">{dayMonth(parseLocalDateKey(day.date))}</span>}
            </h3>
            <DayAgenda events={day.events} tasks={day.tasks} dayForSpeech={heading.toLowerCase()} {...rest} />
          </li>
        );
      })}
    </ol>
  );
}
