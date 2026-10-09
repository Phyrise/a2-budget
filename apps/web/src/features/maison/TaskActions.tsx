/**
 * Feuille d'actions d'une tâche (menu ⋯) : « Allumer une lanterne · 10 min »
 * (durée au choix : 5, 10, 15, 25), « Pas aujourd'hui » (sans rattrapage ni
 * compteur), « Modifier ».
 *
 * V5.4 : « qui l'a fait ? » se dit en cochant (WhoDidSheet) ; les anciens
 * « AL l'a fait / C'est AC qui l'a fait » du menu faisaient doublon.
 */
import type { HouseholdTask, TaskAssignee } from '@a2/core';
import { useState } from 'react';
import { RitualGlyph } from '../rituals/RitualGlyph';
import { LANTERN_MINUTES, lastLanternMinutes } from '../rituals/lantern/lanternStore';
import { Icon, Sheet, cx } from '../../ui';
import { ActionItem, ActionList } from '../../ui/ActionList';
import type { Names } from './TaskRow';
import { assigneeName, recurrenceLabel, turnLabel } from './taskText';

export interface TaskActionsProps {
  /** Dernière tâche choisie (gardée pendant l'animation de fermeture). */
  task: HouseholdTask | null;
  open: boolean;
  /** À qui revient l'occurrence du jour (nextAssignee). */
  turn: TaskAssignee;
  names: Names;
  onClose: () => void;
  onSkip: (task: HouseholdTask) => void;
  onEdit: (task: HouseholdTask) => void;
  /** Allumer une lanterne pour cette tâche (minuteur doux). */
  onLantern: (task: HouseholdTask, minutes: number) => void;
  /** Une lanterne brûle déjà : on n'en allume pas une seconde. */
  lanternBusy: boolean;
}

const NB = '\u202f';

/** « Allumer une lanterne · 10 min », et les durées 5 / 10 / 15 / 25 juste dessous. */
function LanternChoice({ task, busy, onLantern }: { task: HouseholdTask; busy: boolean; onLantern: TaskActionsProps['onLantern'] }) {
  const [minutes, setMinutes] = useState(lastLanternMinutes);
  if (busy) {
    return (
      <p className="task-lantern__busy">
        <RitualGlyph name="lantern" size={22} />
        <span>Une lanterne brûle déjà — son bandeau est juste au-dessus de la navigation.</span>
      </p>
    );
  }
  return (
    <div className="task-lantern">
      <ActionItem
        tone="soft"
        icon={<RitualGlyph name="lantern" size={24} />}
        label={`Allumer une lanterne · ${minutes}${NB}min`}
        hint="un minuteur doux, la forêt s’illumine"
        ariaLabel={`Allumer une lanterne de ${minutes} minutes pour ${task.title}`}
        onClick={() => onLantern(task, minutes)}
      />
      <div className="task-lantern__minutes" role="group" aria-label="Durée de la lanterne">
        {LANTERN_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            className={cx('chip', 'ritual-chip', m === minutes && 'is-selected')}
            aria-pressed={m === minutes}
            aria-label={`${m} minutes`}
            onClick={() => setMinutes(m)}
          >
            {m}
            {NB}min
          </button>
        ))}
      </div>
    </div>
  );
}

export function TaskActions({ task, open, turn, names, onClose, onSkip, onEdit, onLantern, lanternBusy }: TaskActionsProps) {
  const week = task?.recurrence === 'weekly' && task.flexible === true;
  const rotating = task?.rotation === true && (turn === 'a' || turn === 'b');
  const description = task
    ? [recurrenceLabel(task), rotating ? turnLabel(names[turn as 'a' | 'b']) : assigneeName(turn, names), task.effort === 3 ? 'corvée' : null]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <Sheet open={open && task !== null} onClose={onClose} title={task?.title ?? ''} description={description} size="auto" className="task-actions">
      {task && (
        <>
          <ActionList label="Actions">
            <LanternChoice key={task.id} task={task} busy={lanternBusy} onLantern={onLantern} />
            {task.groceries !== true && (
              <ActionItem
                tone="soft"
                icon={<Icon name="moon" size={20} />}
                label={week ? 'Pas cette semaine' : 'Pas aujourd’hui'}
                hint={week ? 'elle reviendra la semaine prochaine' : 'sans rattrapage, sans compter'}
                onClick={() => onSkip(task)}
              />
            )}
            <ActionItem
              tone="soft"
              icon={<Icon name="edit" size={20} />}
              label="Modifier"
              hint={task.groceries === true ? 'nom, qui, effort' : 'nom, qui, effort, quand'}
              onClick={() => onEdit(task)}
            />
          </ActionList>
        </>
      )}
    </Sheet>
  );
}
