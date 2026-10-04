/**
 * « À venir » : prochaines occurrences (sept jours), non cochables.
 * Replié par défaut : un aperçu d'une ligne (« Cette semaine · 14 tâches »,
 * « Demain : Arroser les plantes, +3 ») et une flèche pour tout ouvrir.
 * Ouvert : chaque jour montre trois tâches, puis « +7 autres » dépliable.
 * Toucher une tâche ouvre son édition (modifier, supprimer).
 * Tour à tour : le compagnon alterne d'une occurrence à l'autre, à partir
 * de nextAssignee (et de l'occurrence du jour si elle reste à faire).
 */
import { nextAssignee, parseLocalDateKey, type ChoreCompletion, type HouseholdTask, type TaskAssignee, type UpcomingOccurrence } from '@a2/core';
import { useMemo, useState } from 'react';
import { useShell } from '../../app/ShellContext';
import { Companion, Disclosure, Icon, NBSP, dayMonth, fr, plural, weekdayName } from '../../ui';
import './upcoming.css';

/** Tâches montrées par jour avant « +N autres ». */
const PER_DAY = 3;


interface Item {
  task: HouseholdTask;
  who: TaskAssignee;
  key: string;
}
interface Group {
  date: string;
  days: number;
  items: Item[];
}

function other(who: TaskAssignee): TaskAssignee {
  return who === 'a' ? 'b' : who === 'b' ? 'a' : who;
}

function dayLabel(group: Group): string {
  return group.days === 1 ? 'Demain' : weekdayName(parseLocalDateKey(group.date));
}

/** « Demain : Arroser les plantes, +3 » — la première journée chargée. */
function previewOf(group: Group): string {
  const rest = group.items.length - 1;
  return fr(`${dayLabel(group)} : ${group.items[0]!.task.title}${rest > 0 ? `, +${rest}` : ''}`);
}

function UpcomingDay({ group, onEdit }: { group: Group; onEdit: (task: HouseholdTask) => void }) {
  const [expanded, setExpanded] = useState(false);
  const date = parseLocalDateKey(group.date);
  const hidden = group.items.length - PER_DAY;
  const shown = expanded || hidden <= 0 ? group.items : group.items.slice(0, PER_DAY);
  const label = dayLabel(group);
  return (
    <li className="upcoming__day">
      <p className="upcoming__when">
        <span className="upcoming__weekday">{label}</span>
        <span className="upcoming__date">{dayMonth(date)}</span>
      </p>
      <ul className="upcoming__items">
        {shown.map(({ task, who, key }) => (
          <li key={key} className="upcoming__item">
            <button type="button" className="upcoming__edit" onClick={() => onEdit(task)} aria-label={fr(`Modifier « ${task.title} »`)}>
              <span className="upcoming__who">
                <Companion who={who} size={26} />
              </span>
              <span className="upcoming__title">
                {task.title}
                {task.flexible === true && <span className="upcoming__hint"> · dans la semaine</span>}
              </span>
              <Icon name="chevron-right" size={16} className="upcoming__go" />
            </button>
          </li>
        ))}
        {hidden > 0 && (
          <li className="upcoming__more-row">
            <button
              type="button"
              className="upcoming__more"
              aria-expanded={expanded}
              aria-label={expanded ? `Replier ${label.toLowerCase()}` : `Voir les ${hidden} autres tâches de ${label.toLowerCase()}`}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Replier' : `+${hidden}${NBSP}${hidden === 1 ? 'autre' : 'autres'}`}
              <Icon name="chevron-down" size={16} className="upcoming__more-chevron" />
            </button>
          </li>
        )}
      </ul>
    </li>
  );
}

export function UpcomingList({
  upcoming,
  completions,
  pendingToday,
  onEdit,
}: {
  upcoming: UpcomingOccurrence[];
  completions: ChoreCompletion[];
  /** Ids des tâches encore à faire aujourd'hui (leur tour vient avant). */
  pendingToday: ReadonlySet<string>;
  /** Toucher une tâche à venir : ouvrir son édition. */
  onEdit: (task: HouseholdTask) => void;
}) {
  // Ouvert / replié : préférence d'interface, gardée d'une visite à l'autre.
  const { prefs, updatePrefs } = useShell();
  const open = prefs.upcomingOpen;
  const groups = useMemo(() => {
    const seen = new Map<string, number>();
    const out: Group[] = [];
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
  const toggle = (next: boolean) => updatePrefs({ upcomingOpen: next });

  return (
    <div className="sheet-section upcoming-section">
      <div className="section-head">
        <h2 className="section-title" id="upcoming-title">
          À venir
        </h2>
        <span className="section-head__meta">Cette semaine · {plural(upcoming.length, 'tâche')}</span>
      </div>
      <Disclosure
        open={open}
        onOpenChange={toggle}
        variant="card"
        className="upcoming-fold"
        summary={
          open ? (
            <span className="upcoming-fold__label">Replier la liste</span>
          ) : (
            <span className="upcoming-fold__preview">
              <span className="visually-hidden">{`Voir tout «${NBSP}À venir${NBSP}» — `}</span>
              {previewOf(groups[0]!)}
            </span>
          )
        }
      >
        <ol className="upcoming" aria-labelledby="upcoming-title">
          {groups.map((group) => (
            <UpcomingDay key={group.date} group={group} onEdit={onEdit} />
          ))}
        </ol>
      </Disclosure>
    </div>
  );
}
