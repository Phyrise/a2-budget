/**
 * Fin de lanterne, dans le bandeau : floraison (ou extinction douce, sans
 * reproche), le mot du compagnon, « Cocher “tâche” ? » pour la tâche liée,
 * et l'annonce « Nouvelle lanterne débloquée » quand la collection grandit
 * (la poser dans la forêt, ou la voir dans le carnet).
 */
import { isActionableToday, type HouseholdTask } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../../state/store';
import { Button, Companion, Icon, IconButton, fr } from '../../../ui';
import { useCompanionIds } from '../../../ui/companions';
import { useWorld } from '../../../world/WorldContext';
import { NB, capitalizeFirst, durationWords, type Names } from '../ritualText';
import { lanternDoneLine } from '../voices';
import { lanternName } from './lanternData';
import { lantern, useLantern } from './lanternStore';
import { ToroArt } from './ToroArt';

function Unlocked({ id, onOpenCarnet }: { id: string; onOpenCarnet: () => void }) {
  const { appState, selectLantern } = useApp();
  const placed = appState?.focus?.selectedLantern === id;
  return (
    <div className="lantern-bar__unlock" role="status">
      <ToroArt id={id} mode="lit" height={50} relative={false} />
      <p className="lantern-bar__unlock-text">
        <span className="lantern-bar__kicker">Nouvelle lanterne débloquée</span>
        <strong className="display">{lanternName(id)}</strong>
      </p>
      <div className="lantern-bar__unlock-actions">
        {placed ? (
          <span className="lantern-bar__placed">
            <Icon name="check" size={14} /> Dans la forêt
          </span>
        ) : (
          <Button size="sm" variant="primary" onClick={() => selectLantern(id)}>
            La poser
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={onOpenCarnet}>
          Le carnet
        </Button>
      </div>
    </div>
  );
}

export function LanternBarDone({ names, lanternId, onOpenCarnet }: { names: Names; lanternId: string; onOpenCarnet: () => void }) {
  const s = useLantern();
  const { appState, today, toggleHomeTask } = useApp();
  const { pulse } = useWorld();
  const [checked, setChecked] = useState<{ session: string | null; state: 'no' | 'done' | 'dismissed' }>({ session: null, state: 'no' });
  const config = s.config!;
  const state = checked.session === s.sessionId ? checked.state : 'no';
  const tasks = appState?.chores.tasks ?? [];
  const task: HouseholdTask | null = config.taskId ? tasks.find((t) => t.id === config.taskId) ?? null : null;
  const canCheck =
    task !== null && state === 'no' && isActionableToday(task, today, appState?.chores.completions ?? [], appState?.chores.skips);
  const companions = useCompanionIds();
  const line = lanternDoneLine(config.who, s.minutesSpent, s.completed, s.sessionId ?? '', companions);
  const mark = (next: 'done' | 'dismissed') => setChecked({ session: s.sessionId, state: next });

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
        ...(task.effort === 3 ? { strong: true } : {}),
      });
    }
    mark('done');
  };

  const sub =
    s.minutesSpent >= 1
      ? `${capitalizeFirst(durationWords(s.minutesSpent))} de calme${config.who === 'both' ? ' à deux' : ''}${config.label ? ` pour «${NB}${config.label}${NB}»` : ''}.`
      : `Rien n’est perdu${NB}: la forêt garde la lumière pour la prochaine fois.`;

  return (
    <div className="lantern-bar__done">
      <div className="lantern-bar__head">
        <span className={s.completed ? 'lantern-bar__bloom' : undefined}>
          <ToroArt id={lanternId} mode={s.completed ? 'lit' : 'unlit'} height={52} relative={false} />
        </span>
        <div className="lantern-bar__text">
          <p className="lantern-bar__title display">{s.completed ? 'La lanterne a fleuri' : 'La lanterne s’est éteinte doucement'}</p>
          <p className="lantern-bar__sub">{fr(sub)}</p>
        </div>
        <IconButton icon="close" label="Fermer" size="sm" variant="ghost" onClick={() => lantern.reset()} />
      </div>

      <p className="lantern-bar__voice">
        <Companion who={config.who} size={26} mood="proud" reactKey={s.sessionId ?? 'done'} />
        <span>{line}</span>
      </p>

      {s.unlocked && <Unlocked id={s.unlocked} onOpenCarnet={onOpenCarnet} />}

      {canCheck && task && (
        <div className="lantern-bar__offer">
          <p className="lantern-bar__q">
            Cocher «{NB}{task.title}{NB}»{NB}?
          </p>
          <Button size="sm" variant="primary" icon="check" onClick={(e) => check(e.currentTarget)}>
            Cocher
          </Button>
          <Button size="sm" variant="quiet" onClick={() => mark('dismissed')}>
            Pas maintenant
          </Button>
        </div>
      )}
      {state === 'done' && (
        <p className="lantern-bar__checked">
          <Icon name="check" size={16} /> C’est fait — une lumière de plus dans la forêt.
        </p>
      )}
    </div>
  );
}
