/**
 * « À venir » : prochaines occurrences (cette semaine), non cochables.
 * Tour à tour : le compagnon alterne d'une occurrence à l'autre, à partir
 * de nextAssignee (et de l'occurrence du jour si elle reste à faire).
 */
import { nextAssignee, parseLocalDateKey, type ChoreCompletion, type HouseholdTask, type TaskAssignee, type UpcomingOccurrence } from '@a2/core';
import { useMemo } from 'react';
import { Companion, dayMonth, weekdayName } from '../../ui';

function other(who: TaskAssignee): TaskAssignee {
  return who === 'a' ? 'b' : who === 'b' ? 'a' : who;
}

export function UpcomingList({
  upcoming,
  completions,
  pendingToday,
}: {
  upcoming: UpcomingOccurrence[];
  completions: ChoreCompletion[];
  /** Ids des tâches encore à faire aujourd'hui (leur tour vient avant). */
  pendingToday: ReadonlySet<string>;
}) {
  const groups = useMemo(() => {
    const seen = new Map<string, number>();
    const out: Array<{ date: string; days: number; items: Array<{ task: HouseholdTask; who: TaskAssignee; key: string }> }> = [];
    for (const occ of upcoming) {
      const n = seen.get(occ.task.id) ?? (pendingToday.has(occ.task.id) ? 1 : 0);
      seen.set(occ.task.id, n + 1);
      let who = nextAssignee(occ.task, completions);
      if (occ.task.rotation === true && n % 2 === 1) who = other(who);
      const item = { task: occ.task, who, key: `${occ.task.id}-${occ.date}` };
      const last = out[out.length - 1];
      if (last && last.date === occ.date) last.items.push(item);
      else out.push({ date: occ.date, days: occ.daysFromNow, items: [item] });
    }
    return out;
  }, [upcoming, completions, pendingToday]);

  if (groups.length === 0) return null;
  return (
    <div className="sheet-section">
      <div className="section-head">
        <h2 className="section-title">À venir</h2>
      </div>
      <ol className="upcoming">
        {groups.map((group) => {
          const date = parseLocalDateKey(group.date);
          return (
            <li key={group.date} className="upcoming__day">
              <p className="upcoming__when">
                <span className="upcoming__weekday">{group.days === 1 ? 'Demain' : weekdayName(date)}</span>
                <span className="upcoming__date">{dayMonth(date)}</span>
              </p>
              <ul className="upcoming__items">
                {group.items.map(({ task, who, key }) => (
                  <li key={key} className="upcoming__item">
                    <span className="upcoming__who">
                      <Companion who={who} size={26} />
                    </span>
                    <span className="upcoming__title">
                      {task.title}
                      {task.flexible === true && <span className="upcoming__hint"> · dans la semaine</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
