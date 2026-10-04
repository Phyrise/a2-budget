/**
 * Lignes d'événements : un événement (nature, titre, heure, lieu, pour qui),
 * la liste d'un jour, et « À venir » groupé par jour (« Demain »,
 * « Samedi 10 octobre »). Toucher un événement ouvre son édition.
 * Les anniversaires sont mis en valeur (« Anniversaire de Léa », âge
 * seulement si l'année est connue).
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
import './events.css';

export interface Names {
  a: string;
  b: string;
}

function spokenLabel(o: CalendarOccurrence, names: Names, withDay: string | null): string {
  const e = o.event;
  const years = yearsLabel(o);
  const parts = [
    `Modifier « ${displayTitle(e)} »`,
    years,
    withDay,
    timeRangeSpoken(e),
    e.place ? `lieu : ${e.place}` : null,
    whoLabel(e.who, names).toLowerCase(),
    kindMeta(e.kind).label.toLowerCase(),
    e.yearly ? 'tous les ans' : null,
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
        </span>
        <span className="cal-event__who" title={whoLabel(e.who, names)}>
          <Companion who={e.who} size={e.who === 'both' ? 28 : 30} />
        </span>
      </button>
    </li>
  );
}

export function DayEvents({
  occurrences,
  names,
  highlightId,
  onOpen,
}: {
  occurrences: CalendarOccurrence[];
  names: Names;
  highlightId: string | null;
  onOpen: (occurrence: CalendarOccurrence) => void;
}) {
  return (
    <ul className="cal-events">
      {occurrences.map((o) => (
        <EventRow key={`${o.event.id}-${o.date}`} occurrence={o} names={names} highlight={o.event.id === highlightId} onOpen={onOpen} />
      ))}
    </ul>
  );
}

interface DayGroup {
  date: string;
  items: CalendarOccurrence[];
}

function groupByDay(occurrences: CalendarOccurrence[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const o of occurrences) {
    const last = groups[groups.length - 1];
    if (last && last.date === o.date) last.items.push(o);
    else groups.push({ date: o.date, items: [o] });
  }
  return groups;
}

export function UpcomingEvents({
  occurrences,
  today,
  names,
  highlightId,
  onOpen,
}: {
  occurrences: CalendarOccurrence[];
  today: Date;
  names: Names;
  highlightId: string | null;
  onOpen: (occurrence: CalendarOccurrence) => void;
}) {
  return (
    <ol className="cal-upcoming">
      {groupByDay(occurrences).map((group) => {
        const heading = dayHeading(group.date, today);
        const relative = heading === 'Aujourd’hui' || heading === 'Demain';
        return (
          <li key={group.date} className="cal-upcoming__day">
            <h3 className="cal-upcoming__when">
              <span className="cal-upcoming__heading">{heading}</span>
              {relative && <span className="cal-upcoming__date">{dayMonth(parseLocalDateKey(group.date))}</span>}
            </h3>
            <ul className="cal-events">
              {group.items.map((o) => (
                <EventRow
                  key={`${o.event.id}-${o.date}`}
                  occurrence={o}
                  names={names}
                  highlight={o.event.id === highlightId}
                  dayForSpeech={heading.toLowerCase()}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
