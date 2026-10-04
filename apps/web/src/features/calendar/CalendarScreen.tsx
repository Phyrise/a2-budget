/**
 * Calendrier commun (V3.2) : les moments partagés du couple — un dîner
 * prévu, un repas chez des amis, un anniversaire…
 *
 * - Bandeau : « Ensemble », mois affiché, ‹ › et « Aujourd’hui ».
 * - Saisie rapide (« dîner chez Léa samedi 20h ») qui pré-remplit la feuille.
 * - Grille mensuelle (lundi d'abord, navigable au clavier) ; toucher un jour
 *   montre ses événements dessous. Après un changement de mois, on montre
 *   tout le mois.
 * - « À venir » : prochains événements (nextEvents), groupés par jour.
 * - Ajout / édition dans une feuille ; suppression annulable (toast).
 * Occurrences, tris et répétitions annuelles : @a2/core uniquement.
 */
import { eventsBetween, eventsOn, localDateKey, nextEvents, type CalendarEvent, type CalendarOccurrence } from '@a2/core';
import { useEffect, useMemo, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { IconButton, fr, shiftMonthKey, useToast } from '../../ui';
import { CalendarBanner } from './CalendarBanner';
import { CalendarEmpty, DayEmpty } from './CalendarEmpty';
import { dayHeading, displayTitle, eventsCount, monthKeyOf, monthLabel, monthWeeks } from './calendarText';
import { DayEvents, UpcomingEvents } from './EventList';
import { EventSheet } from './EventSheet';
import type { EventSheetState } from './eventForm';
import { MonthGrid } from './MonthGrid';
import { QuickAdd } from './QuickAdd';
import './calendar.css';

const UPCOMING_COUNT = 8;

/** Heure courante, rafraîchie chaque minute (« À venir » retire ce qui est fini). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Jour à montrer après un enregistrement : la prochaine occurrence d'un annuel. */
function landingDate(event: CalendarEvent, todayKey: string): string {
  if (!event.yearly) return event.date;
  const md = event.date.slice(5);
  const year = Number(todayKey.slice(0, 4));
  const fix = (y: number) => {
    const key = `${y}-${md}`;
    return md === '02-29' && new Date(y, 1, 29).getMonth() !== 1 ? `${y}-02-28` : key;
  };
  const thisYear = fix(Math.max(year, Number(event.date.slice(0, 4))));
  return thisYear >= todayKey ? thisYear : fix(year + 1);
}

function groupByDay(occurrences: CalendarOccurrence[]): Map<string, CalendarOccurrence[]> {
  const map = new Map<string, CalendarOccurrence[]>();
  for (const o of occurrences) {
    const list = map.get(o.date);
    if (list) list.push(o);
    else map.set(o.date, [o]);
  }
  return map;
}

export function CalendarScreen() {
  const { appState, today, removeCalendarEvent, restoreCalendarEvent } = useApp();
  const { setForegroundSheet } = useShell();
  const toast = useToast();
  const now = useNow();
  const todayKey = localDateKey(today);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(today));
  const [selected, setSelected] = useState<string | null>(todayKey);
  const [sheet, setSheet] = useState<EventSheetState>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    setForegroundSheet(sheet !== null);
    return () => setForegroundSheet(false);
  }, [sheet, setForegroundSheet]);

  useEffect(() => {
    if (highlightId === null) return;
    const t = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const events = appState?.calendar?.events ?? [];
  const names = {
    a: appState?.budget.settings.personA.name ?? 'AL',
    b: appState?.budget.settings.personB.name ?? 'AC',
  };

  const weeks = useMemo(() => monthWeeks(monthKey), [monthKey]);
  const byDay = useMemo(() => {
    const last = weeks[weeks.length - 1]!;
    return groupByDay(eventsBetween(events, weeks[0]![0]!, last[last.length - 1]!));
  }, [events, weeks]);
  const upcoming = useMemo(() => nextEvents(events, now, UPCOMING_COUNT), [events, now]);
  const dayOccurrences = useMemo(() => (selected ? eventsOn(events, selected) : []), [events, selected]);
  const monthOccurrences = useMemo(() => {
    const last = weeks[weeks.length - 1]!;
    return eventsBetween(events, `${monthKey}-01`, last[6]!).filter((o) => o.date.startsWith(monthKey));
  }, [events, weeks, monthKey]);

  const selectDay = (key: string) => {
    setSelected(key);
    const month = key.slice(0, 7);
    if (month !== monthKey) setMonthKey(month);
  };

  const showMonth = (delta: number) => {
    setMonthKey((key) => shiftMonthKey(key, delta));
    setSelected(null);
  };

  const backToToday = () => {
    setMonthKey(monthKeyOf(today));
    setSelected(todayKey);
  };

  const openCreate = (prefill: Partial<{ title: string; date: string; time: string; endTime: string; kind: CalendarEvent['kind'] }> = {}) => {
    setSheet({ mode: 'create', prefill: { ...prefill, date: prefill.date ?? selected ?? (monthKey === todayKey.slice(0, 7) ? todayKey : `${monthKey}-01`) } });
  };

  const openEdit = (o: CalendarOccurrence) => setSheet({ mode: 'edit', event: o.event, occurrenceDate: o.date });

  const onSaved = (event: CalendarEvent, created: boolean) => {
    setSheet(null);
    selectDay(landingDate(event, todayKey));
    setHighlightId(event.id);
    toast.show({
      message: created ? fr(`Ajouté au calendrier : ${displayTitle(event)}`) : 'Événement mis à jour',
      icon: created ? 'calendar' : 'check',
    });
  };

  const remove = (event: CalendarEvent) => {
    setSheet(null);
    const removed = removeCalendarEvent(event.id);
    if (removed === null) return;
    toast.show({
      message: fr(`Retiré du calendrier : ${displayTitle(event)}`),
      icon: 'trash',
      action: { label: 'Annuler', onClick: () => restoreCalendarEvent(removed) },
    });
  };

  const isCurrentMonth = monthKey === todayKey.slice(0, 7);
  const away = !isCurrentMonth || selected !== todayKey;
  const { month } = monthLabel(monthKey);
  const selectedInMonth = selected !== null && selected.startsWith(monthKey);

  return (
    <>
      <CalendarBanner monthKey={monthKey} away={away} onPrev={() => showMonth(-1)} onNext={() => showMonth(1)} onToday={backToToday} />

      <section className="screen-sheet calendar" aria-labelledby="calendar-title">
        <ShellNotices />

        <QuickAdd now={now} onSubmit={openCreate} />

        <div className="cal-month">
          <p id="cal-grid-label" className="visually-hidden">
            {`${month} ${monthKey.slice(0, 4)}`}
          </p>
          <MonthGrid monthKey={monthKey} selected={selected ?? ''} todayKey={todayKey} byDay={byDay} onSelect={selectDay} labelledBy="cal-grid-label" />
        </div>

        <section className="sheet-section cal-day-panel" aria-labelledby="cal-day-title">
          <div className="section-head">
            <h2 id="cal-day-title" className="section-title">
              {selectedInMonth ? dayHeading(selected, today) : `En ${month.toLowerCase()}`}
            </h2>
            {!selectedInMonth && monthOccurrences.length > 0 && <span className="section-head__meta">{eventsCount(monthOccurrences.length)}</span>}
            <IconButton
              icon="plus"
              label={selectedInMonth ? `Ajouter un événement le ${dayHeading(selected, today).toLowerCase()}` : 'Ajouter un événement'}
              variant="accent"
              size="sm"
              onClick={() => openCreate()}
            />
          </div>
          {selectedInMonth ? (
            dayOccurrences.length > 0 ? (
              <DayEvents occurrences={dayOccurrences} names={names} highlightId={highlightId} onOpen={openEdit} />
            ) : (
              <DayEmpty onAdd={() => openCreate()} />
            )
          ) : monthOccurrences.length > 0 ? (
            <UpcomingEvents occurrences={monthOccurrences} today={today} names={names} highlightId={highlightId} onOpen={openEdit} />
          ) : (
            <DayEmpty month onAdd={() => openCreate()} />
          )}
        </section>

        <section className="sheet-section cal-upcoming-section" aria-labelledby="cal-upcoming-title">
          <div className="section-head">
            <h2 id="cal-upcoming-title" className="section-title">
              À venir
            </h2>
          </div>
          {upcoming.length > 0 ? (
            <UpcomingEvents occurrences={upcoming} today={today} names={names} highlightId={highlightId} onOpen={openEdit} />
          ) : (
            <CalendarEmpty hasPast={events.length > 0} onAdd={() => openCreate()} />
          )}
        </section>
      </section>

      <EventSheet state={sheet} onClose={() => setSheet(null)} onSaved={onSaved} onRemove={remove} />
    </>
  );
}
