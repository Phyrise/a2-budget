/**
 * Maison — la clairière. Hero vivant, phrase d'humeur, tâches du jour.
 * Cocher = coche instantanée + lumière qui monte de la case vers la forêt
 * (useWorld().pulse) + réaction du compagnon. Les tâches restantes ne sont
 * jamais représentées dans la forêt ; aucun score, aucune compétition.
 */
import {
  ONCE,
  actionableTasksToday,
  localDateKey,
  parseLocalDateKey,
  upcomingOccurrences,
  weeklyDistribution,
  type ChoreCompletion,
  type HouseholdTask,
} from '@a2/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import {
  Button,
  Checkbox,
  Companion,
  Disclosure,
  EmptyState,
  Icon,
  IconButton,
  clockTime,
  cx,
  dayMonth,
  longDate,
  weekdayName,
} from '../../ui';
import type { CompanionMood, Who } from '../../world/types';
import { useWorld } from '../../world/WorldContext';
import { RitualsBar } from '../rituals/RitualsBar';
import { TaskSheet, type TaskSheetState } from './TaskSheet';
import { assigneeName, moodPhrase, recurrenceLabel } from './taskText';
import './maison.css';

const LINGER_MS = 1300;

interface Reaction {
  who: Who;
  mood: CompanionMood;
  key: number;
}

function TaskRow({
  task,
  checked,
  celebrating,
  names,
  onToggle,
  onEdit,
}: {
  task: HouseholdTask;
  checked: boolean;
  celebrating: boolean;
  names: { a: string; b: string };
  onToggle: (task: HouseholdTask, origin: { x: number; y: number }) => void;
  onEdit: (task: HouseholdTask) => void;
}) {
  return (
    <li className={cx('task-row', checked && 'is-done', celebrating && 'is-leaving')}>
      <Checkbox
        checked={checked}
        label={task.title}
        tone={task.assignee}
        onToggle={(origin) => onToggle(task, origin)}
        className={celebrating ? 'is-celebrating' : undefined}
      />
      <button type="button" className="task-row__body" onClick={() => onEdit(task)} aria-label={`Modifier ${task.title}`}>
        <span className="task-row__title">{task.title}</span>
        <span className="task-row__meta">
          {recurrenceLabel(task)} · {assigneeName(task.assignee, names)}
        </span>
      </button>
      <Companion who={task.assignee} size={34} mood={celebrating ? 'happy' : 'idle'} reactKey={celebrating ? 'go' : 'rest'} />
    </li>
  );
}

function DoneRow({
  completion,
  task,
  names,
  onUndo,
}: {
  completion: ChoreCompletion;
  task: HouseholdTask | null;
  names: { a: string; b: string };
  onUndo: (task: HouseholdTask, origin: { x: number; y: number }) => void;
}) {
  return (
    <li className="task-row task-row--done">
      {task ? (
        <Checkbox checked label={`${completion.taskTitle} (annuler)`} tone={completion.assignee} onToggle={(origin) => onUndo(task, origin)} size="sm" />
      ) : (
        <span className="task-row__spacer" aria-hidden="true">
          <Icon name="check" size={18} />
        </span>
      )}
      <span className="task-row__body task-row__body--static">
        <span className="task-row__title">{completion.taskTitle}</span>
        <span className="task-row__meta">
          {assigneeName(completion.assignee, names)} · {clockTime(new Date(completion.completedAt))}
        </span>
      </span>
      <Companion who={completion.assignee} size={28} />
    </li>
  );
}

export function MaisonScreen() {
  const { appState, today, toggleHomeTask, toggleHomePause } = useApp();
  const world = useWorld();
  const { prefs, updatePrefs, setForegroundSheet } = useShell();
  const [sheet, setSheet] = useState<TaskSheetState>(null);
  const [lingering, setLingering] = useState<Record<string, string>>({});
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const reactionKey = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    setForegroundSheet(sheet !== null);
    return () => setForegroundSheet(false);
  }, [sheet, setForegroundSheet]);

  // Gardien : joué une seule fois quand forest.lastRareEvent devient « guardian ».
  const lastRare = appState?.forest.lastRareEvent ?? null;
  const guardianPlayed = useRef(false);
  useEffect(() => {
    if (lastRare !== 'guardian' || prefs.guardianSeen || guardianPlayed.current) return;
    guardianPlayed.current = true;
    updatePrefs({ guardianSeen: true });
    window.setTimeout(() => world.playGuardian(), 700);
  }, [lastRare, prefs.guardianSeen, updatePrefs, world]);

  const react = useCallback((who: Who, mood: CompanionMood) => {
    reactionKey.current += 1;
    const key = reactionKey.current;
    setReaction({ who, mood, key });
    timers.current.push(
      window.setTimeout(() => setReaction((r) => (r?.key === key ? null : r)), 1600),
    );
  }, []);

  const names = {
    a: appState?.budget.settings.personA.name ?? 'AL',
    b: appState?.budget.settings.personB.name ?? 'AC',
  };

  const todayKey = localDateKey(today);
  const tasks = appState?.chores.tasks ?? [];
  const completions = appState?.chores.completions ?? [];
  const paused = appState?.forest.paused ?? false;

  const actionable = useMemo(() => actionableTasksToday(tasks, today, completions), [tasks, today, completions]);
  const actionableIds = useMemo(() => new Set(actionable.map((t) => t.id)), [actionable]);
  const todayList = tasks.filter((t) => actionableIds.has(t.id) || lingering[t.id] !== undefined);

  const doneToday = useMemo(
    () =>
      completions
        .filter((c) => localDateKey(new Date(c.completedAt)) === todayKey && lingering[c.taskId] !== c.id)
        .sort((x, y) => y.completedAt.localeCompare(x.completedAt)),
    [completions, todayKey, lingering],
  );

  const upcoming = useMemo(() => upcomingOccurrences(tasks, completions, today, 7, { includeDaily: false }), [tasks, completions, today]);
  const upcomingByDay = useMemo(() => {
    const groups: Array<{ date: string; days: number; items: typeof upcoming }> = [];
    for (const occ of upcoming) {
      const last = groups[groups.length - 1];
      if (last && last.date === occ.date) last.items.push(occ);
      else groups.push({ date: occ.date, days: occ.daysFromNow, items: [occ] });
    }
    return groups;
  }, [upcoming]);

  const week = useMemo(() => weeklyDistribution(completions, today), [completions, today]);

  const toggle = (task: HouseholdTask, origin: { x: number; y: number }) => {
    const result = toggleHomeTask(task);
    if (result.completionId === null) return;
    const completionId = result.completionId;
    if (result.completed) {
      world.pulse({ id: completionId, who: task.assignee, fromClientX: origin.x, fromClientY: origin.y });
      setLingering((m) => ({ ...m, [task.id]: completionId }));
      timers.current.push(
        window.setTimeout(() => {
          setLingering((m) => {
            if (m[task.id] !== completionId) return m;
            const next = { ...m };
            delete next[task.id];
            return next;
          });
        }, LINGER_MS),
      );
      const remaining = actionable.filter((t) => t.id !== task.id).length;
      react(task.assignee, remaining === 0 ? 'proud' : 'happy');
    } else {
      setLingering((m) => {
        if (m[task.id] === undefined) return m;
        const next = { ...m };
        delete next[task.id];
        return next;
      });
    }
  };

  const findUndoable = (c: ChoreCompletion): HouseholdTask | null => {
    const task = tasks.find((t) => t.id === c.taskId);
    if (!task) return null;
    const due = task.recurrence === 'none' ? ONCE : todayKey;
    return c.dueDate === due ? task : null;
  };

  // Humeur des compagnons perchés sur la feuille.
  const allDone = tasks.length > 0 && actionable.length === 0 && doneToday.length > 0;
  const baseMood: CompanionMood = paused ? 'sleepy' : sheet !== null ? 'curious' : allDone ? 'proud' : 'idle';
  const perchedMood = (who: 'a' | 'b'): CompanionMood => {
    if (reaction && (reaction.who === who || reaction.who === 'both' || reaction.mood === 'proud')) return reaction.mood;
    return baseMood;
  };
  const perchedKey = (who: 'a' | 'b') =>
    reaction && (reaction.who === who || reaction.who === 'both' || reaction.mood === 'proud') ? `r${reaction.key}` : baseMood;

  const mood = world.state?.mood ?? 'peaceful';
  const weekParts = [
    `${names.a} ${week.a}`,
    `${names.b} ${week.b}`,
    `ensemble ${week.both}`,
    ...(week.unassigned > 0 ? [`libre ${week.unassigned}`] : []),
  ];
  const weekTotal = week.a + week.b + week.both + week.unassigned;

  return (
    <>
      <div className="world-window maison-hero">
        <p className="maison-hero__date">{longDate(today)}</p>
        <p className="maison-hero__mood display">{moodPhrase(mood, paused, today)}</p>
      </div>

      <section className={cx('screen-sheet', 'maison', paused && 'maison--paused')} aria-labelledby="maison-title">
        <ShellNotices />

        {paused && (
          <div className="pause-card">
            <span className="pause-card__icon">
              <Icon name="moon" size={22} />
            </span>
            <div className="pause-card__text">
              <p className="pause-card__title">La maison est en pause</p>
              <p className="pause-card__body">La forêt dort. Rien ne se perd pendant la pause&nbsp;: elle reprendra où vous l’avez laissée.</p>
            </div>
            <Button variant="primary" icon="sun" onClick={toggleHomePause} className="pause-card__action">
              Réveiller la forêt
            </Button>
          </div>
        )}

        <div className="sheet-section">
          <div className="section-head maison__head">
            <h1 id="maison-title" tabIndex={-1} className="section-title maison__title">
              <span className="visually-hidden">Maison, </span>Aujourd’hui
            </h1>
            {actionable.length > 0 && <span className="section-head__meta">{actionable.length} à faire</span>}
            <IconButton icon="plus" label="Ajouter une tâche" variant="accent" onClick={() => setSheet({ mode: 'create' })} />
          </div>

          {todayList.length > 0 ? (
            <ul className="task-list" aria-label="Tâches d’aujourd’hui">
              {todayList.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  checked={lingering[task.id] !== undefined}
                  celebrating={lingering[task.id] !== undefined}
                  names={names}
                  onToggle={toggle}
                  onEdit={(t) => setSheet({ mode: 'edit', task: t })}
                />
              ))}
            </ul>
          ) : tasks.length === 0 ? (
            <EmptyState
              title="La clairière vous attend"
              action={
                <Button variant="primary" icon="plus" onClick={() => setSheet({ mode: 'create' })}>
                  Ajouter une première tâche
                </Button>
              }
            >
              Arroser les plantes, sortir les poubelles, changer les draps… Chaque geste posera une lumière dans la forêt.
            </EmptyState>
          ) : (
            <EmptyState compact title={doneToday.length > 0 ? 'Tout est fait pour aujourd’hui' : 'Rien de prévu aujourd’hui'}>
              {doneToday.length > 0 ? 'La forêt garde vos lumières jusqu’au soir.' : 'Profitez du calme de la clairière.'}
            </EmptyState>
          )}

          {doneToday.length > 0 && (
            <Disclosure summary="Fait aujourd’hui" meta={doneToday.length} variant="card" className="done-today">
              <ul className="task-list task-list--done">
                {doneToday.map((c) => (
                  <DoneRow key={c.id} completion={c} task={findUndoable(c)} names={names} onUndo={toggle} />
                ))}
              </ul>
            </Disclosure>
          )}
        </div>

        {upcomingByDay.length > 0 && (
          <div className="sheet-section">
            <div className="section-head">
              <h2 className="section-title">À venir</h2>
            </div>
            <ol className="upcoming">
              {upcomingByDay.map((group) => {
                const date = parseLocalDateKey(group.date);
                return (
                  <li key={group.date} className="upcoming__day">
                    <p className="upcoming__when">
                      <span className="upcoming__weekday">{group.days === 1 ? 'Demain' : weekdayName(date)}</span>
                      <span className="upcoming__date">{dayMonth(date)}</span>
                    </p>
                    <ul className="upcoming__items">
                      {group.items.map((occ) => (
                        <li key={`${occ.task.id}-${occ.date}`} className="upcoming__item">
                          <span className="upcoming__who">
                            <Companion who={occ.task.assignee} size={26} />
                          </span>
                          <span className="upcoming__title">{occ.task.title}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <RitualsBar />

        <div className="sheet-section maison__footer">
          <p className="week-line">
            <Icon name="leaf" size={16} />
            <span>
              {weekTotal === 0 ? (
                'Cette semaine commence tout juste.'
              ) : (
                <>
                  Cette semaine&nbsp;: <span className="num">{weekParts.join(' · ')}</span>
                </>
              )}
            </span>
          </p>
          {!paused && (
            <Button variant="ghost" icon="moon" onClick={toggleHomePause} className="maison__pause">
              Mettre la maison en pause
            </Button>
          )}
        </div>
        <div className="perch" aria-hidden="true">
          <Companion who="a" size={60} mood={perchedMood('a')} reactKey={perchedKey('a')} perched />
          <Companion who="b" size={56} mood={perchedMood('b')} reactKey={perchedKey('b')} perched />
        </div>
      </section>

      <TaskSheet state={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
