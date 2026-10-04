/**
 * Historique contextuel du Calendrier : les derniers événements passés
 * (douze derniers mois, anniversaires annuels compris), du plus récent au
 * plus ancien, groupés par jour. Lecture seule.
 */
import { addDays, eventsBetween, localDateKey, type CalendarEvent, type CalendarOccurrence } from '@a2/core';
import { useMemo, type ReactNode } from 'react';
import { useApp } from '../state/store';
import { displayTitle, timeRangeLabel } from '../features/calendar/calendarText';
import { Companion, EmptyState, relativeDayLabel } from '../ui';
import '../features/history/history.css';

/** Au plus autant d'événements montrés (les plus récents). */
const MAX_SHOWN = 60;

const KIND_LABELS: Record<CalendarEvent['kind'], string> = {
  repas: 'Repas',
  sortie: 'Sortie',
  anniversaire: 'Anniversaire',
  rdv: 'Rendez-vous',
  voyage: 'Voyage',
  maison: 'Maison',
  autre: 'Événement',
};

function timeLabel(o: CalendarOccurrence): string | null {
  const { event } = o;
  if (event.allDay || event.time === undefined) return null;
  const start = event.time.replace(':', ' h ');
  return event.endTime ? `${start} – ${event.endTime.replace(':', ' h ')}` : start;
}

function meta(o: CalendarOccurrence, names: { a: string; b: string }): ReactNode {
  const parts = [KIND_LABELS[o.event.kind]];
  // Mêmes heures que l'écran Calendrier (« 20 h », « 9 h 30 – 11 h »).
  if (!o.event.allDay && o.event.time !== undefined) parts.push(timeRangeLabel(o.event));
  if (o.event.place) parts.push(o.event.place);
  if (o.event.who !== 'both') parts.push(o.event.who === 'a' ? names.a : names.b);
  return parts.join(' · ');
}

export function CalendarHistory() {
  const { appState, today } = useApp();
  const events = appState?.calendar?.events;
  const names = {
    a: appState?.budget.settings.personA.name ?? 'AL',
    b: appState?.budget.settings.personB.name ?? 'AC',
  };
  const groups = useMemo(() => {
    if (!events || events.length === 0) return [];
    const to = localDateKey(addDays(today, -1));
    const from = localDateKey(addDays(today, -365));
    const past = eventsBetween(events, from, to).reverse().slice(0, MAX_SHOWN);
    const out: Array<{ day: string; items: CalendarOccurrence[] }> = [];
    for (const o of past) {
      const last = out[out.length - 1];
      if (last && last.day === o.date) last.items.push(o);
      else out.push({ day: o.date, items: [o] });
    }
    // Dans une journée : l'ordre du jour (journée entière, puis par heure).
    for (const g of out) g.items.reverse();
    return out;
  }, [events, today]);

  if (groups.length === 0) {
    return (
      <EmptyState title="Aucun événement passé" art="leaf">
        Les dîners, sorties et anniversaires déjà vécus apparaîtront ici.
      </EmptyState>
    );
  }

  return (
    <ol className="history-days">
      {groups.map((g) => (
        <li key={g.day} className="history-day">
          <h3 className="history-day__label">{relativeDayLabel(g.day, today)}</h3>
          <ul className="history-day__list">
            {g.items.map((o) => (
              <li key={`${o.event.id}-${o.date}`} className="history-entry">
                <Companion who={o.event.who} size={30} />
                <span className="history-entry__text">
                  <span className="history-entry__title">{displayTitle(o.event)}</span>
                  <span className="history-entry__meta">{meta(o, names)}</span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
