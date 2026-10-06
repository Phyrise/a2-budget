/**
 * Grille mensuelle compacte (lundi d'abord). Chaque jour porte des pastilles
 * colorées selon la nature de ses événements, puis — plus discret — un
 * petit anneau de mousse s'il y a des tâches de la maison (plein quand
 * elles sont toutes faites) ; aujourd'hui est cerclé d'ambre, le jour
 * choisi est éclairé.
 *
 * Clavier (motif « grille » ARIA, tabindex itinérant) : flèches = jour
 * voisin / même jour de la semaine voisine, Début / Fin = début / fin de
 * semaine, Page préc. / suiv. = mois voisin. Franchir le bord du mois change
 * de mois. Le jour atteint est sélectionné (ses événements s'affichent
 * sous la grille).
 */
import { addDays, localDateKey, parseLocalDateKey, type CalendarOccurrence } from '@a2/core';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { WEEKDAYS, cx, fr, longDate } from '../../ui';
import { displayTitle, eventsCount, monthWeeks } from './calendarText';
import { kindStyle } from './kinds';
import { tasksCount, type TaskItem } from './taskAgenda';

/** Pastilles montrées par jour avant « + ». */
const MAX_DOTS = 3;

function shiftMonthKeepingDay(key: string, delta: number): string {
  const d = parseLocalDateKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return localDateKey(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)));
}

function dayLabel(key: string, todayKey: string, occurrences: CalendarOccurrence[], tasks: TaskItem[]): string {
  const parts = [longDate(parseLocalDateKey(key))];
  if (key === todayKey) parts.push('aujourd’hui');
  if (occurrences.length === 0 && tasks.length === 0) parts.push('rien de prévu');
  if (occurrences.length > 0) parts.push(fr(`${eventsCount(occurrences.length)} : ${occurrences.map((o) => displayTitle(o.event)).join(', ')}`));
  if (tasks.length > 0) {
    const done = tasks.filter((t) => t.done).length;
    parts.push(fr(`${tasksCount(tasks.length)} de la maison${done > 0 ? ` (${done === tasks.length ? 'faites' : `${done} faite${done > 1 ? 's' : ''}`})` : ''}`));
  }
  return parts.join(', ');
}

const NO_TASKS: TaskItem[] = [];

export function MonthGrid({
  monthKey,
  selected,
  todayKey,
  byDay,
  tasksByDay,
  onSelect,
  labelledBy,
}: {
  monthKey: string;
  /** Jour choisi « YYYY-MM-DD », ou '' (aperçu du mois). */
  selected: string;
  todayKey: string;
  byDay: ReadonlyMap<string, CalendarOccurrence[]>;
  /** Tâches de la maison par jour (vide si « Afficher les tâches » est coupé). */
  tasksByDay: ReadonlyMap<string, TaskItem[]>;
  /** Choisit un jour (le parent change de mois s'il le faut). */
  onSelect: (dateKey: string) => void;
  labelledBy: string;
}) {
  const weeks = monthWeeks(monthKey);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantsFocus = useRef(false);
  // Le jour focalisable : le jour choisi s'il est dans ce mois, sinon
  // aujourd'hui s'il y est, sinon le 1er.
  const focusKey = selected.startsWith(monthKey) ? selected : todayKey.startsWith(monthKey) ? todayKey : `${monthKey}-01`;

  useLayoutEffect(() => {
    if (!wantsFocus.current) return;
    wantsFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`)?.focus();
  }, [focusKey, monthKey]);

  const move = (to: string) => {
    wantsFocus.current = true;
    onSelect(to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    const date = parseLocalDateKey(key);
    const weekday = (date.getDay() + 6) % 7; // 0 = lundi
    let to: string | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        to = localDateKey(addDays(date, -1));
        break;
      case 'ArrowRight':
        to = localDateKey(addDays(date, 1));
        break;
      case 'ArrowUp':
        to = localDateKey(addDays(date, -7));
        break;
      case 'ArrowDown':
        to = localDateKey(addDays(date, 7));
        break;
      case 'Home':
        to = localDateKey(addDays(date, -weekday));
        break;
      case 'End':
        to = localDateKey(addDays(date, 6 - weekday));
        break;
      case 'PageUp':
        to = shiftMonthKeepingDay(key, -1);
        break;
      case 'PageDown':
        to = shiftMonthKeepingDay(key, 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    move(to);
  };

  return (
    <div ref={gridRef} className="cal-grid" role="grid" aria-labelledby={labelledBy}>
      <div className="cal-grid__row cal-grid__row--head" role="row">
        {WEEKDAYS.map((d) => (
          <span key={d.iso} className="cal-grid__weekday" role="columnheader" aria-label={d.long}>
            <span aria-hidden="true">{d.short}</span>
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="cal-grid__row" role="row">
          {week.map((key) => {
            const occurrences = byDay.get(key) ?? [];
            const tasks = tasksByDay.get(key) ?? NO_TASKS;
            const tasksDone = tasks.length > 0 && tasks.every((t) => t.done);
            const outside = key.slice(0, 7) !== monthKey;
            const isSelected = key === selected;
            const isToday = key === todayKey;
            const birthday = occurrences.some((o) => o.event.kind === 'anniversaire');
            return (
              <div key={key} role="gridcell" aria-selected={isSelected} className="cal-grid__cell">
                <button
                  type="button"
                  data-date={key}
                  tabIndex={key === focusKey ? 0 : -1}
                  className={cx(
                    'cal-day',
                    outside && 'is-outside',
                    isSelected && 'is-selected',
                    isToday && 'is-today',
                    occurrences.length > 0 && 'has-events',
                    tasks.length > 0 && 'has-tasks',
                    birthday && 'has-birthday',
                  )}
                  aria-label={dayLabel(key, todayKey, occurrences, tasks)}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => onSelect(key)}
                  onKeyDown={(event) => onKeyDown(event, key)}
                >
                  <span className="cal-day__num num" aria-hidden="true">
                    {Number(key.slice(8))}
                  </span>
                  <span className="cal-day__dots" aria-hidden="true">
                    {occurrences.slice(0, MAX_DOTS).map((o) => (
                      <span key={`${o.event.id}-${o.date}`} className="cal-day__dot" style={kindStyle(o.event.kind)} />
                    ))}
                    {occurrences.length > MAX_DOTS && <span className="cal-day__more">+</span>}
                    {tasks.length > 0 && <span className={cx('cal-day__task', tasksDone && 'is-done')} />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
