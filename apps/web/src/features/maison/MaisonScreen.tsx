/**
 * Maison — la clairière. Hero vivant, phrase d'humeur, tâches du jour.
 * Cocher = coche instantanée + lumière qui monte de la case vers la forêt
 * (useWorld().pulse, plus forte pour une corvée) + réaction et réplique du
 * compagnon. Menu ⋯ : qui s'en charge, « pas aujourd'hui », modifier.
 * Les tâches restantes ne sont jamais représentées dans la forêt ; aucun
 * score, aucune compétition : l'équilibre se lit dans une carte qualitative.
 */
import {
  ONCE,
  actionableTasksToday,
  findOccurrenceCompletion,
  isDueOn,
  isSkipped,
  localDateKey,
  nextAssignee,
  upcomingOccurrences,
  type ChoreCompletion,
  type ChoreDoer,
  type HouseholdTask,
  type TaskAssignee,
} from '@a2/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Button, Companion, Disclosure, EmptyState, Icon, IconButton, cx, longDate } from '../../ui';
import { CompanionBubble } from '../../ui/CompanionBubble';
import type { CompanionMood } from '../../world/types';
import { useWorld } from '../../world/WorldContext';
import { RitualsBar } from '../rituals/RitualsBar';
import { BalanceCard } from './BalanceCard';
import { TaskActions } from './TaskActions';
import { DoneRow, SkippedList, TaskRow } from './TaskRow';
import { TaskSheet, type TaskSheetState } from './TaskSheet';
import { UpcomingList } from './UpcomingList';
import { moodPhrase } from './taskText';
import { useInView } from './useCompanionVoice';
import { useMaisonActions } from './useMaisonActions';
import './maison.css';
import './maison-v3.css';

const SHEET_SWAP_MS = 240;

function checkCenter(taskId: string): { x: number; y: number } {
  const el = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"] .check`);
  const rect = el?.getBoundingClientRect();
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

export function MaisonScreen() {
  const { appState, today } = useApp();
  const world = useWorld();
  const { prefs, updatePrefs, setForegroundSheet } = useShell();
  const [sheet, setSheet] = useState<TaskSheetState>(null);
  const [menu, setMenu] = useState<{ task: HouseholdTask; open: boolean; turn: TaskAssignee } | null>(null);
  const perchRef = useRef<HTMLDivElement>(null);
  const perchVisible = useInView(perchRef);

  useEffect(() => {
    setForegroundSheet(sheet !== null || menu?.open === true);
    return () => setForegroundSheet(false);
  }, [sheet, menu, setForegroundSheet]);

  // Gardien : joué une seule fois quand forest.lastRareEvent devient « guardian ».
  const lastRare = appState?.forest.lastRareEvent ?? null;
  const guardianPlayed = useRef(false);
  useEffect(() => {
    if (lastRare !== 'guardian' || prefs.guardianSeen || guardianPlayed.current) return;
    guardianPlayed.current = true;
    updatePrefs({ guardianSeen: true });
    window.setTimeout(() => world.playGuardian(), 700);
  }, [lastRare, prefs.guardianSeen, updatePrefs, world]);

  const nameA = appState?.budget.settings.personA.name ?? 'AL';
  const nameB = appState?.budget.settings.personB.name ?? 'AC';
  const names = useMemo(() => ({ a: nameA, b: nameB }), [nameA, nameB]);

  const todayKey = localDateKey(today);
  const tasks = appState?.chores.tasks ?? [];
  const completions = appState?.chores.completions ?? [];
  const skips = appState?.chores.skips;
  const paused = appState?.forest.paused ?? false;

  const actionable = useMemo(() => actionableTasksToday(tasks, today, completions, skips), [tasks, today, completions, skips]);
  const actionableIds = useMemo(() => new Set(actionable.map((t) => t.id)), [actionable]);
  const skippedToday = useMemo(
    () =>
      tasks.filter(
        (t) => (t.recurrence === 'none' || isDueOn(t, today)) && isSkipped(t, skips, today) && findOccurrenceCompletion(t, completions, today) === undefined,
      ),
    [tasks, today, completions, skips],
  );
  const completedToday = useMemo(
    () => completions.filter((c) => localDateKey(new Date(c.completedAt)) === todayKey),
    [completions, todayKey],
  );

  const actions = useMaisonActions(names, { actionable, completions, doneTodayCount: completedToday.length, paused });
  const { lingering, reaction, bubble } = actions;

  const todayList = tasks.filter((t) => actionableIds.has(t.id) || lingering[t.id] !== undefined);
  const doneToday = useMemo(
    () => completedToday.filter((c) => lingering[c.taskId] !== c.id).sort((x, y) => y.completedAt.localeCompare(x.completedAt)),
    [completedToday, lingering],
  );
  const upcoming = useMemo(
    () => upcomingOccurrences(tasks, completions, today, 7, { includeDaily: false, skips }),
    [tasks, completions, today, skips],
  );

  const findUndoable = (c: ChoreCompletion): HouseholdTask | null => {
    const task = tasks.find((t) => t.id === c.taskId);
    if (!task) return null;
    if (task.recurrence === 'none') return c.dueDate === ONCE ? task : null;
    return findOccurrenceCompletion(task, completions, today)?.id === c.id ? task : null;
  };

  // Menu ⋯ : la feuille se ferme avant l'action suivante (focus et animation propres).
  const closeMenu = () => setMenu((m) => (m ? { ...m, open: false } : m));
  const focusTitleIfLost = () =>
    window.setTimeout(() => {
      if (document.activeElement === document.body) document.getElementById('maison-title')?.focus({ preventScroll: true });
    }, SHEET_SWAP_MS + 40);
  const onMenuDone = (task: HouseholdTask, doneBy: ChoreDoer) => {
    closeMenu();
    actions.toggle(task, checkCenter(task.id), doneBy);
    focusTitleIfLost();
  };
  const onMenuSkip = (task: HouseholdTask) => {
    closeMenu();
    actions.skip(task);
    focusTitleIfLost();
  };
  const onMenuEdit = (task: HouseholdTask) => {
    closeMenu();
    window.setTimeout(() => setSheet({ mode: 'edit', task }), SHEET_SWAP_MS);
  };

  // Humeur des compagnons perchés sur la feuille.
  const allDone = tasks.length > 0 && actionable.length === 0 && doneToday.length > 0;
  const baseMood: CompanionMood = paused ? 'sleepy' : sheet !== null || menu?.open ? 'curious' : allDone ? 'proud' : 'idle';
  const reacts = (who: 'a' | 'b') => reaction !== null && (reaction.who === who || reaction.who === 'both');
  const perchedMood = (who: 'a' | 'b'): CompanionMood => (reacts(who) ? reaction!.mood : baseMood);
  const perchedKey = (who: 'a' | 'b') => (reacts(who) ? `r${reaction!.key}` : baseMood);

  const mood = world.state?.mood ?? 'peaceful';


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
            <Button variant="primary" icon="sun" onClick={actions.togglePause} className="pause-card__action">
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
              {todayList.map((task) => {
                const celebrating = lingering[task.id] !== undefined;
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    turn={nextAssignee(task, celebrating ? completions.filter((c) => c.id !== lingering[task.id]) : completions)}
                    checked={celebrating}
                    celebrating={celebrating}
                    names={names}
                    mood={celebrating ? (task.effort === 3 ? 'proud' : 'happy') : 'idle'}
                    onToggle={actions.toggle}
                    onMenu={(t) => setMenu({ task: t, open: true, turn: nextAssignee(t, completions) })}
                  />
                );
              })}
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
              {doneToday.length > 0
                ? 'La forêt garde vos lumières jusqu’au soir.'
                : skippedToday.length > 0
                  ? 'Le reste attendra. Profitez du calme de la clairière.'
                  : 'Profitez du calme de la clairière.'}
            </EmptyState>
          )}

          <SkippedList tasks={skippedToday} onRestore={actions.restore} />

          {doneToday.length > 0 && (
            <Disclosure summary="Fait aujourd’hui" meta={doneToday.length} variant="card" className="done-today">
              <ul className="task-list task-list--done">
                {doneToday.map((c) => (
                  <DoneRow key={c.id} completion={c} task={findUndoable(c)} names={names} onUndo={actions.toggle} />
                ))}
              </ul>
            </Disclosure>
          )}
        </div>

        <UpcomingList upcoming={upcoming} completions={completions} pendingToday={actionableIds} />

        <RitualsBar />

        <div className="sheet-section maison__footer">
          <BalanceCard names={names} />
          {!paused && (
            <Button variant="ghost" icon="moon" onClick={actions.togglePause} className="maison__pause">
              Mettre la maison en pause
            </Button>
          )}
        </div>
        <div className="perch" ref={perchRef}>
          <span className="perch__figures" aria-hidden="true">
            <Companion who="a" size={60} mood={perchedMood('a')} reactKey={perchedKey('a')} perched />
            <Companion who="b" size={56} mood={perchedMood('b')} reactKey={perchedKey('b')} perched />
          </span>
          {perchVisible && <CompanionBubble bubble={bubble} variant="perch" className={bubble ? `is-${bubble.who}` : undefined} />}
        </div>
      </section>
      {!perchVisible && <CompanionBubble bubble={bubble} variant="floating" />}

      <TaskActions
        task={menu?.task ?? null}
        open={menu?.open === true}
        turn={menu?.turn ?? "both"}
        names={names}
        onClose={closeMenu}
        onDone={onMenuDone}
        onSkip={onMenuSkip}
        onEdit={onMenuEdit}
      />
      <TaskSheet state={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
