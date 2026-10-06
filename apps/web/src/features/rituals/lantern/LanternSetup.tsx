/**
 * Préparer une lanterne : durée, qui, tâche liée (facultative), intention.
 * Le bouton dit simplement ce qui va se passer (« Lancer 10 minutes »).
 */
import { activeLantern, nextAssignee, type ChoreCompletion, type HouseholdTask } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../../state/store';
import { Button, Companion, Segmented, TextField, cx } from '../../../ui';
import { NB, type Names } from '../ritualText';
import { lanternName } from './lanternData';
import { LANTERN_MINUTES, lastLanternMinutes, type LanternConfig, type LanternWho } from './lanternStore';
import { ToroArt } from './ToroArt';

const DURATIONS = LANTERN_MINUTES.map(String) as ReadonlyArray<string>;
type Duration = string;

export function LanternSetup({
  names,
  tasks,
  completions,
  onHelp,
  onStart,
}: {
  names: Names;
  /** Tâches du jour (encore à faire). */
  tasks: HouseholdTask[];
  completions: ChoreCompletion[];
  /** Rouvrir l'explication en trois gestes. */
  onHelp: () => void;
  onStart: (config: LanternConfig) => void;
}) {
  const { appState } = useApp();
  const chosen = activeLantern(appState?.focus);
  const [minutes, setMinutes] = useState<Duration>(() => String(lastLanternMinutes()));
  const [who, setWho] = useState<LanternWho>('both');
  const [taskId, setTaskId] = useState<string>('');
  const [label, setLabel] = useState('');
  const task = tasks.find((t) => t.id === taskId) ?? null;

  const chooseTask = (t: HouseholdTask | null) => {
    setTaskId(t?.id ?? '');
    if (t) {
      const assignee = nextAssignee(t, completions);
      if (assignee !== 'unassigned') setWho(assignee);
    }
  };

  const start = () => {
    onStart({
      minutes: Number(minutes),
      who,
      taskId: task?.id,
      label: label.trim() || task?.title || undefined,
    });
  };

  return (
    <div className="lantern-card lantern-setup">
      <div className="lantern-setup__intro">
        <p className="lantern-setup__lead">
          <ToroArt id={chosen} mode="unlit" height={54} relative={false} />
          <span>
            Un minuteur doux pour s’y mettre. <em>{lanternName(chosen)}</em> s’allumera dans la forêt pendant que vous rangez.
          </span>
        </p>
        <button type="button" className="lantern-setup__help" onClick={onHelp}>
          Comment ça marche{NB}?
        </button>
      </div>

      <Segmented
        name="lantern-minutes"
        legend="Durée"
        value={minutes}
        onChange={setMinutes}
        options={DURATIONS.map((d) => ({ value: d, label: `${d}${NB}min`, ariaLabel: `${d} minutes` }))}
      />

      <Segmented
        name="lantern-who"
        legend="Qui allume la lanterne"
        value={who}
        onChange={setWho}
        options={(['a', 'b', 'both'] as const).map((w) => ({
          value: w,
          ariaLabel: w === 'both' ? 'À deux' : names[w],
          label: (
            <span className="lantern-who">
              <Companion who={w} size={22} />
              <span>{w === 'both' ? 'À deux' : names[w]}</span>
            </span>
          ),
        }))}
      />

      {tasks.length > 0 && (
        <fieldset className="lantern-tasks">
          <legend className="field__label">Pour une tâche du jour (facultatif)</legend>
          <div className="lantern-tasks__list">
            {tasks.slice(0, 8).map((t) => (
              <button
                key={t.id}
                type="button"
                className={cx('chip', 'ritual-chip', taskId === t.id && 'is-selected')}
                aria-pressed={taskId === t.id}
                onClick={() => chooseTask(taskId === t.id ? null : t)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <TextField
        id="lantern-label"
        label="Intention (facultatif)"
        value={label}
        onChange={setLabel}
        maxLength={80}
        placeholder={task ? task.title : 'Ranger le bureau, trier les papiers…'}
        enterKeyHint="go"
        onKeyDown={(e) => {
          if (e.key === 'Enter') start();
        }}
      />

      <Button variant="primary" size="lg" block icon="sparkle" onClick={start}>
        Lancer {minutes}{NB}minutes
      </Button>
    </div>
  );
}
