/**
 * Calendrier commun : les moments partagés du couple — un dîner prévu, un
 * repas chez des amis, un anniversaire… — et, depuis la V4, les tâches de
 * la maison à date fixe.
 *
 * - Bandeau : « Ensemble », mois affiché, ‹ › et « Aujourd’hui ».
 * - Grille mensuelle (lundi d'abord, navigable au clavier) : icônes peintes
 *   des événements, petit anneau de mousse pour les tâches ; toucher un jour
 *   montre ses événements puis ses tâches dessous. Après un changement de
 *   mois, on montre tout le mois.
 * - Un SEUL « + » (en tête du jour choisi) ouvre la feuille d'ajout, qui
 *   commence par la saisie en une phrase (« dîner chez Léa samedi 20h »).
 * - « À venir » : prochains événements (nextEvents) et tâches de la semaine,
 *   groupés par jour. « Afficher les tâches » est mémorisé.
 * - Tâches : hebdomadaires / mensuelles à jour fixe et ponctuelles
 *   (taskOccurrencesBetween) ; faites = barrées ; seule l'occurrence du jour
 *   (ou une ponctuelle) se coche ici, comme dans Maison.
 * - Univers Totoro (calendarTheme) : Totoro endormi ou sous la pluie dans
 *   les états vides, Totoro au paquet-feuille pour les anniversaires, le
 *   Chatbus traverse quand on ajoute un moment.
 * - V4.3 : les anniversaires d'AL et d'AC (Réglages) s'ajoutent en annuels
 *   virtuels (jamais écrits ; les toucher ouvre les Réglages), annoncés dans
 *   « À venir » un mois avant ; le jour de l'anniversaire du couple porte un
 *   petit lampion dans la grille.
 * Occurrences, tris et répétitions : @a2/core uniquement.
 */
import {
  addDays,
  coupleDaysBetween,
  eventsBetween,
  eventsOn,
  isAnniversaryEventId,
  localDateKey,
  nextEvents,
  withAnniversaryEvents,
  type CalendarEvent,
  type CalendarOccurrence,
} from '@a2/core';
import { useEffect, useMemo, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { IconButton, fr, shiftMonthKey, useToast } from '../../ui';
import { QuestSpot } from '../quests/QuestSpot';
import { CalendarBanner } from './CalendarBanner';
import { CalendarEmpty, DayEmpty } from './CalendarEmpty';
import { dayHeading, dayPhrase, displayTitle, eventsCount, monthKeyOf, monthLabel, monthWeeks } from './calendarText';
import { CatbusRun } from './Catbus';
import { AgendaList, DayAgenda } from './EventList';
import { EventSheet } from './EventSheet';
import type { EventPrefill, EventSheetState } from './eventForm';
import { MonthGrid } from './MonthGrid';
import { SootStage } from '../../creatures/soot';
import { useShowTasks } from './calendarPrefs';
import { TasksFilter } from './TasksFilter';
import { agendaDays, byDate, taskItemsBetween, tasksCount, type TaskItem } from './taskAgenda';
import { useTaskToggle } from './useTaskToggle';
import './calendar.css';

const UPCOMING_COUNT = 8;
/** « À venir » montre les tâches des sept prochains jours. */
const UPCOMING_TASK_DAYS = 7;
/** « À venir » annonce un anniversaire d'AL ou d'AC un mois avant (V4.3). */
const BIRTHDAY_SOON_DAYS = 30;
const NO_TASKS: TaskItem[] = [];
const NO_EVENTS: CalendarEvent[] = [];

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
  const { setForegroundSheet, openSheet, prefs } = useShell();
  const toast = useToast();
  const now = useNow();
  const todayKey = localDateKey(today);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(today));
  const [selected, setSelected] = useState<string | null>(todayKey);
  const [sheet, setSheet] = useState<EventSheetState>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [catbus, setCatbus] = useState(0);
  const [showTasks, setShowTasks] = useShowTasks();
  const { celebratingKey, toggle: toggleTask } = useTaskToggle();

  useEffect(() => {
    setForegroundSheet(sheet !== null);
    return () => setForegroundSheet(false);
  }, [sheet, setForegroundSheet]);

  useEffect(() => {
    if (highlightId === null) return;
    const t = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const nameA = appState?.budget.settings.personA.name ?? 'AL';
  const nameB = appState?.budget.settings.personB.name ?? 'AC';
  const names = useMemo(() => ({ a: nameA, b: nameB }), [nameA, nameB]);
  const anniversaries = appState?.anniversaries;
  const stored = appState?.calendar?.events ?? NO_EVENTS;
  const events = useMemo(() => withAnniversaryEvents(stored, anniversaries, names), [stored, anniversaries, names]);

  const weeks = useMemo(() => monthWeeks(monthKey), [monthKey]);
  const gridFrom = weeks[0]![0]!;
  const lastWeek = weeks[weeks.length - 1]!;
  const gridTo = lastWeek[lastWeek.length - 1]!;
  const byDay = useMemo(() => groupByDay(eventsBetween(events, gridFrom, gridTo)), [events, gridFrom, gridTo]);
  const coupleDays = useMemo(() => new Set(coupleDaysBetween(anniversaries, gridFrom, gridTo)), [anniversaries, gridFrom, gridTo]);

  // Tâches de la maison : la grille affichée, plus la semaine à venir.
  const upcomingTo = localDateKey(addDays(today, UPCOMING_TASK_DAYS));
  const taskFrom = gridFrom < todayKey ? gridFrom : todayKey;
  const taskTo = gridTo > upcomingTo ? gridTo : upcomingTo;
  const taskItems = useMemo(
    () => (showTasks ? taskItemsBetween(appState, taskFrom, taskTo, todayKey) : NO_TASKS),
    [showTasks, appState, taskFrom, taskTo, todayKey],
  );
  const tasksByDay = useMemo(() => byDate(taskItems), [taskItems]);

  // Quand le jour présent est montré juste au-dessus, « À venir » commence après lui.
  const hideToday = selected === todayKey;
  const birthdaysTo = localDateKey(addDays(today, BIRTHDAY_SOON_DAYS));
  const upcoming = useMemo(() => {
    const todayCount = hideToday ? eventsOn(events, todayKey).length : 0;
    const next = nextEvents(events, now, UPCOMING_COUNT + todayCount + 2);
    // Anniversaires d'AL et d'AC (virtuels) : s'ils approchent, ou parmi les moments déjà annoncés.
    const lastReal = next.filter((o) => !isAnniversaryEventId(o.event.id)).at(-1)?.date ?? '';
    const horizon = lastReal > birthdaysTo ? lastReal : birthdaysTo;
    const shown = next
      .filter((o) => !(isAnniversaryEventId(o.event.id) && o.date > horizon))
      .filter((o) => !(hideToday && o.date === todayKey))
      .slice(0, UPCOMING_COUNT);
    const tasks = taskItems.filter((t) => t.date >= todayKey && t.date <= upcomingTo && !(hideToday && t.date === todayKey));
    return agendaDays(shown, tasks);
  }, [events, now, hideToday, todayKey, taskItems, upcomingTo, birthdaysTo]);
  const dayOccurrences = useMemo(() => (selected ? eventsOn(events, selected) : []), [events, selected]);
  const dayTasks = selected ? (tasksByDay.get(selected) ?? NO_TASKS) : NO_TASKS;
  const monthDays = useMemo(() => {
    const occurrences = eventsBetween(events, `${monthKey}-01`, gridTo).filter((o) => o.date.startsWith(monthKey));
    return agendaDays(occurrences, taskItems.filter((t) => t.date.startsWith(monthKey)));
  }, [events, monthKey, gridTo, taskItems]);
  const monthEventCount = monthDays.reduce((n, d) => n + d.events.length, 0);
  const monthTaskCount = monthDays.reduce((n, d) => n + d.tasks.length, 0);

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

  const openCreate = (prefill: Partial<EventPrefill> = {}) => {
    setSheet({ mode: 'create', prefill: { ...prefill, date: prefill.date ?? selected ?? (monthKey === todayKey.slice(0, 7) ? todayKey : `${monthKey}-01`) } });
  };

  // Anniversaire d'AL ou d'AC (virtuel) : il se règle dans les Réglages.
  const openEdit = (o: CalendarOccurrence) =>
    isAnniversaryEventId(o.event.id) ? openSheet('settings') : setSheet({ mode: 'edit', event: o.event, occurrenceDate: o.date });

  const onSaved = (event: CalendarEvent, created: boolean) => {
    setSheet(null);
    selectDay(landingDate(event, todayKey));
    setHighlightId(event.id);
    if (created) setCatbus((n) => n + 1);
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
  const agenda = { names, highlightId, celebratingKey, onOpen: openEdit, onToggleTask: toggleTask };
  const monthMeta = [monthEventCount > 0 ? eventsCount(monthEventCount) : null, monthTaskCount > 0 ? tasksCount(monthTaskCount) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <CalendarBanner monthKey={monthKey} away={away} onPrev={() => showMonth(-1)} onNext={() => showMonth(1)} onToday={backToToday} />

      <section className="screen-sheet calendar" aria-labelledby="calendar-title">
        <QuestSpot tab="calendar" />
        <ShellNotices />
        <SootStage screen="calendar" />

        <div className="cal-month">
          <p id="cal-grid-label" className="visually-hidden">
            {`${month} ${monthKey.slice(0, 4)}`}
          </p>
          <MonthGrid
            monthKey={monthKey}
            selected={selected ?? ''}
            todayKey={todayKey}
            byDay={byDay}
            tasksByDay={tasksByDay}
            coupleDays={coupleDays}
            still={prefs.forestMotion === 'still'}
            onSelect={selectDay}
            labelledBy="cal-grid-label"
          />
        </div>
        <TasksFilter show={showTasks} onChange={setShowTasks} />

        <section className="sheet-section cal-day-panel" aria-labelledby="cal-day-title">
          <div className="section-head">
            <h2 id="cal-day-title" className="section-title">
              {selectedInMonth ? dayHeading(selected, today) : `En ${month.toLowerCase()}`}
            </h2>
            {!selectedInMonth && monthMeta !== '' && <span className="section-head__meta">{monthMeta}</span>}
            <IconButton
              icon="plus"
              label={selectedInMonth ? `Ajouter un événement ${dayPhrase(selected, today)}` : 'Ajouter un événement'}
              variant="accent"
              className="cal-add"
              onClick={() => openCreate()}
            />
          </div>
          {selectedInMonth ? (
            dayOccurrences.length > 0 || dayTasks.length > 0 ? (
              <DayAgenda events={dayOccurrences} tasks={dayTasks} {...agenda} />
            ) : (
              <DayEmpty />
            )
          ) : monthDays.length > 0 ? (
            <AgendaList days={monthDays} today={today} {...agenda} />
          ) : (
            <DayEmpty month />
          )}
        </section>

        <section className="sheet-section cal-upcoming-section" aria-labelledby="cal-upcoming-title">
          <div className="section-head">
            <h2 id="cal-upcoming-title" className="section-title">
              À venir
            </h2>
          </div>
          {upcoming.length > 0 ? <AgendaList days={upcoming} today={today} {...agenda} /> : <CalendarEmpty hasPast={stored.length > 0} />}
        </section>
      </section>

      <EventSheet state={sheet} onClose={() => setSheet(null)} onSaved={onSaved} onRemove={remove} />
      <CatbusRun run={catbus} />
    </>
  );
}
