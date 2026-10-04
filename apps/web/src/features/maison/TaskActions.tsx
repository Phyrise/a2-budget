/**
 * Feuille d'actions d'une tâche (menu ⋯) : marquer comme fait, par qui
 * (« AL l'a fait », « C'est AC qui l'a fait », « Fait ensemble »), « Pas
 * aujourd'hui » (sans rattrapage ni compteur), « Modifier ».
 *
 * L'app ne sait pas qui tient le téléphone : « je m'en occupe » s'écrit
 * donc avec le prénom de la personne. Choisir quelqu'un coche la tâche :
 * les libellés sont au passé pour le dire clairement.
 */
import type { ChoreDoer, HouseholdTask, TaskAssignee } from '@a2/core';
import { Companion, Icon, Sheet } from '../../ui';
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
  onDone: (task: HouseholdTask, doneBy: ChoreDoer) => void;
  onSkip: (task: HouseholdTask) => void;
  onEdit: (task: HouseholdTask) => void;
}

interface Choice {
  doneBy: ChoreDoer;
  label: string;
  hint: string;
}

export function doneChoices(task: HouseholdTask, turn: TaskAssignee, names: Names): Choice[] {
  if (turn === 'a' || turn === 'b') {
    const other = turn === 'a' ? 'b' : 'a';
    return [
      {
        doneBy: turn,
        label: `${names[turn]} l’a fait`,
        hint: task.rotation === true ? 'c’était son tour' : 'comme prévu',
      },
      { doneBy: other, label: `C’est ${names[other]} qui l’a fait`, hint: 'un coup de main' },
    ];
  }
  const people: Choice[] = (['a', 'b'] as const).map((p) => ({
    doneBy: p,
    label: `${names[p]} l’a fait`,
    hint: turn === 'both' ? 'pour cette fois, en solo' : 'merci de l’avoir prise',
  }));
  return turn === 'both' ? [{ doneBy: 'both', label: 'Fait ensemble', hint: 'comme prévu' }, ...people] : people;
}

export function TaskActions({ task, open, turn, names, onClose, onDone, onSkip, onEdit }: TaskActionsProps) {
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
          <ActionList label="Marquer comme fait, par qui&#8239;?" labelVisible>
            {doneChoices(task, turn, names).map((choice) => (
              <ActionItem
                key={choice.doneBy}
                tone={choice.doneBy}
                icon={<Companion who={choice.doneBy} size={choice.doneBy === 'both' ? 22 : 30} />}
                label={choice.label}
                hint={choice.hint}
                onClick={() => onDone(task, choice.doneBy)}
              />
            ))}
          </ActionList>
          <ActionList label="Autres actions">
            <ActionItem
              tone="soft"
              icon={<Icon name="moon" size={20} />}
              label={week ? 'Pas cette semaine' : 'Pas aujourd’hui'}
              hint={week ? 'elle reviendra la semaine prochaine' : 'sans rattrapage, sans compter'}
              onClick={() => onSkip(task)}
            />
            <ActionItem
              tone="soft"
              icon={<Icon name="edit" size={20} />}
              label="Modifier"
              hint="nom, qui, effort, quand"
              onClick={() => onEdit(task)}
            />
          </ActionList>
        </>
      )}
    </Sheet>
  );
}
