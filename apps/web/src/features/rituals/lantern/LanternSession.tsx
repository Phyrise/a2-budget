/**
 * Lanterne en cours (anneau, temps restant, pause / arrêter, ambiance) et
 * fin de lanterne (floraison, mot du compagnon, « Cocher “tâche” ? »).
 */
import { isActionableToday, type HouseholdTask } from '@a2/core';
import { useEffect, useState } from 'react';
import { useApp } from '../../../state/store';
import { Button, Companion, Icon, Segmented } from '../../../ui';
import { useWorld } from '../../../world/WorldContext';
import { NB, clock, durationWords, remainingWords, whoLabel, type Names } from '../ritualText';
import { lanternDoneLine } from '../voices';
import { ambience } from './ambience';
import { LanternRing } from './LanternRing';
import { lantern, progressOf, remainingMs, useLantern, type LanternSound } from './lanternStore';

/** Rafraîchit l'affichage 4×/s (le temps vient toujours de l'horloge). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

const SOUNDS: ReadonlyArray<{ value: LanternSound; label: string }> = [
  { value: 'off', label: 'Silence' },
  { value: 'rain', label: 'Pluie' },
  { value: 'stream', label: 'Ruisseau' },
];

export function LanternRunning({ names, onHide }: { names: Names; onHide: () => void }) {
  const s = useLantern();
  const now = useNow(s.phase === 'running');
  const remaining = remainingMs(s, now);
  const minuteLeft = Math.ceil(remaining / 60000);
  const config = s.config!;
  const paused = s.phase === 'paused';

  return (
    <div className="lantern-stage">
      <div className="lantern-stage__ring">
        <LanternRing progress={progressOf(s, now)} who={config.who} burning={!paused} />
      </div>
      <p className="lantern-stage__time display num" aria-hidden="true">
        {clock(remaining)}
      </p>
      <p className="visually-hidden" aria-live="polite">
        {paused ? 'Lanterne en pause, ' : ''}
        {remainingWords(minuteLeft * 60000)}
      </p>
      <p className="lantern-stage__label">
        <Companion who={config.who} size={22} />
        <span>
          {paused ? 'En pause' : whoLabel(config.who, names)}
          {config.label ? (
            <>
              {' · '}
              <em>{config.label}</em>
            </>
          ) : null}
        </span>
      </p>

      <div className="lantern-card lantern-controls">
        <div className="lantern-controls__row">
          {paused ? (
            <Button variant="primary" icon="sun" onClick={() => lantern.resume()}>
              Reprendre
            </Button>
          ) : (
            <Button variant="ghost" icon="moon" onClick={() => lantern.pause()}>
              Pause
            </Button>
          )}
          <Button variant="quiet" icon="close" onClick={() => lantern.stop()}>
            Arrêter
          </Button>
        </div>
        {ambience.supported() && (
          <Segmented
            name="lantern-sound"
            legend="Ambiance sonore"
            size="sm"
            value={s.sound}
            onChange={(v) => {
              ambience.unlock();
              lantern.setSound(v);
            }}
            options={SOUNDS}
          />
        )}
        <button type="button" className="lantern-controls__hide" onClick={onHide}>
          Retourner à la maison — la lanterne continue de brûler
        </button>
      </div>
    </div>
  );
}

export function LanternDone({ names, onAgain, onClose }: { names: Names; onAgain: () => void; onClose: () => void }) {
  const s = useLantern();
  const { appState, today, toggleHomeTask } = useApp();
  const { pulse } = useWorld();
  const [checked, setChecked] = useState<'no' | 'done' | 'dismissed'>('no');
  const config = s.config!;
  const tasks = appState?.chores.tasks ?? [];
  const task: HouseholdTask | null = config.taskId ? tasks.find((t) => t.id === config.taskId) ?? null : null;
  const canCheck =
    task !== null && checked === 'no' && isActionableToday(task, today, appState?.chores.completions ?? [], appState?.chores.skips);
  const line = lanternDoneLine(config.who, s.minutesSpent, s.completed, s.sessionId ?? '');

  const check = (origin: HTMLElement) => {
    if (!task) return;
    const result = toggleHomeTask(task, { doneBy: config.who });
    if (result.completed && result.completionId) {
      const r = origin.getBoundingClientRect();
      pulse({
        id: result.completionId,
        who: config.who,
        fromClientX: r.left + r.width / 2,
        fromClientY: r.top + r.height / 2,
        strong: task.effort === 3,
      });
    }
    setChecked('done');
  };

  return (
    <div className="lantern-stage lantern-stage--done">
      <div className="lantern-stage__ring">
        <LanternRing progress={s.completed ? 1 : progressOf(s)} who={config.who} burning={false} bloom={s.completed} />
      </div>
      <h3 className="lantern-stage__title display">
        {s.completed ? 'La lanterne a fleuri' : 'La lanterne s’est éteinte doucement'}
      </h3>
      <p className="lantern-stage__sub">
        {s.minutesSpent >= 1
          ? `${durationWords(s.minutesSpent).replace(/^./, (c) => c.toUpperCase())} de calme${config.who === 'both' ? ' à deux' : ''}${config.label ? ` pour «${NB}${config.label}${NB}»` : ''}.`
          : 'Rien n’est perdu : la forêt garde la lumière pour la prochaine fois.'}
      </p>

      <div className="ritual-bubble" role="status">
        <Companion who={config.who} size={44} mood="proud" reactKey={s.sessionId ?? 'done'} />
        <p className="ritual-bubble__text">{line}</p>
      </div>

      <div className="lantern-card lantern-controls">
        {canCheck && task && (
          <div className="lantern-offer">
            <p className="lantern-offer__q">
              Cocher «{NB}{task.title}{NB}»{NB}?
            </p>
            <div className="lantern-controls__row">
              <Button variant="primary" icon="check" onClick={(e) => check(e.currentTarget)}>
                Cocher
              </Button>
              <Button variant="quiet" onClick={() => setChecked('dismissed')}>
                Pas maintenant
              </Button>
            </div>
          </div>
        )}
        {checked === 'done' && (
          <p className="lantern-offer__done">
            <Icon name="check" size={18} /> C’est fait — une lumière de plus dans la forêt.
          </p>
        )}
        <div className="lantern-controls__row">
          <Button variant="ghost" icon="sparkle" onClick={onAgain}>
            Rallumer
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
