/**
 * Feuille d'ajout / d'édition d'une tâche Maison : quoi, qui (et « tour à
 * tour »), quel effort (petit geste · tâche · corvée), quand (jour de
 * semaine ou du mois choisi, ou « dans la semaine » pour une hebdomadaire
 * souple), suppression.
 *
 * V4.1 : la feuille tient en entier sur un téléphone (390 × 844) sans
 * défiler ; à l'ouverture le focus va au titre de la feuille, pas dans le
 * champ (le clavier ne s'ouvre pas tout seul : on choisit les options, puis
 * on touche le champ pour écrire) ; « Une fois » par défaut.
 */
import {
  isoWeekday,
  nextAssignee,
  type HouseholdTask,
  type TaskAssignee,
  type TaskEffort,
  type TaskRecurrence,
} from '@a2/core';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useApp } from '../../state/store';
import { Button, Companion, ConfirmDialog, Icon, Segmented, Sheet, TextField, WEEKDAYS, fr, useToast } from '../../ui';
import { Switch } from '../../ui/Switch';
import { EFFORTS, EffortArt } from './EffortArt';

export type TaskSheetState = { mode: 'create' } | { mode: 'edit'; task: HouseholdTask } | null;

const RECURRENCES: ReadonlyArray<{ value: TaskRecurrence; label: string }> = [
  { value: 'none', label: 'Une fois' },
  { value: 'daily', label: 'Chaque jour' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
];

/** Récurrence par défaut d'une nouvelle tâche (V4.1 : « Une fois »). */
const DEFAULT_RECURRENCE: TaskRecurrence = 'none';

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type EffortValue = `${TaskEffort}`;

const EFFORT_OPTIONS = EFFORTS.map((e) => ({
  value: String(e.value) as EffortValue,
  ariaLabel: `${e.label} (${e.hint})`,
  label: (
    <span className="effort-option">
      <EffortArt effort={e.value} size={24} />
      <span className="effort-option__label">{e.label}</span>
    </span>
  ),
}));

const WEEK_MODES = [
  { value: 'fixed' as const, label: 'Un jour précis' },
  { value: 'flexible' as const, label: 'Dans la semaine' },
];

/**
 * Focus initial sur le titre de la feuille (« Nouvelle tâche ») : le lecteur
 * d'écran l'annonce, aucun champ n'est actif, le clavier reste fermé. Le
 * titre appartient à `Sheet` : on le résout à l'ouverture (lecture paresseuse
 * de `current`, appelée par `Sheet` une fois la feuille montée).
 */
function useSheetHeadingRef(): RefObject<HTMLElement | null> {
  return useMemo(
    () => ({
      get current() {
        const heading = document.querySelector<HTMLElement>('.task-sheet .sheet__title');
        if (heading) heading.tabIndex = -1;
        return heading;
      },
    }),
    [],
  );
}

function WhoOption({ who, name, size }: { who: TaskAssignee; name: string; size: number }) {
  return (
    <span className="who-option">
      <Companion who={who} size={size} />
      <span>{name}</span>
    </span>
  );
}

export function TaskSheet({ state, onClose }: { state: TaskSheetState; onClose: () => void }) {
  const { createHomeTask, updateHomeTask, deleteHomeTask, appState, today } = useApp();
  const toast = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const headingRef = useSheetHeadingRef();
  const editing = state?.mode === 'edit' ? state.task : null;

  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<TaskAssignee>('both');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>(DEFAULT_RECURRENCE);
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [effort, setEffort] = useState<TaskEffort>(1);
  const [rotation, setRotation] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (state === null) return;
    const now = new Date();
    const t = state.mode === 'edit' ? state.task : null;
    setTitle(t?.title ?? '');
    setAssignee(t?.assignee ?? 'both');
    setRecurrence(t?.recurrence ?? DEFAULT_RECURRENCE);
    setWeeklyDay(t?.weeklyDay ?? isoWeekday(now));
    setMonthlyDay(t?.monthlyDay ?? now.getDate());
    setEffort(t?.effort ?? 1);
    setRotation(t?.rotation === true);
    setFlexible(t?.flexible === true);
    setError(null);
  }, [state]);

  const names = {
    a: appState?.budget.settings.personA.name ?? 'AL',
    b: appState?.budget.settings.personB.name ?? 'AC',
  };

  const personChosen = assignee === 'a' || assignee === 'b';
  // Valeurs V3 toujours cohérentes : « tour à tour » seulement avec une
  // personne, « souple » seulement en hebdomadaire (false = retiré).
  const care = {
    effort,
    rotation: personChosen && rotation,
    flexible: recurrence === 'weekly' && flexible,
  };

  const completions = appState?.chores.completions ?? [];
  // Dès qu'un historique existe (même si le tour à tour vient d'être coché),
  // c'est lui qui décide du prochain tour : on l'annonce tel quel plutôt que
  // de promettre « en commençant par » un choix qui serait ignoré.
  const nextTurn =
    editing != null && personChosen && rotation && completions.some((c) => c.taskId === editing.id)
      ? nextAssignee({ ...editing, assignee, rotation: true }, completions)
      : null;
  const rotationText =
    nextTurn === 'a' || nextTurn === 'b'
      ? fr(`On alterne à chaque fois. Prochain tour : ${names[nextTurn]}.`)
      : `On alterne à chaque fois, en commençant par ${assignee === 'b' ? names.b : names.a}`;

  const submit = () => {
    const clean = title.replace(/\s+/g, ' ').trim();
    if (clean === '') {
      setError('Donnez un nom à la tâche.');
      titleRef.current?.focus();
      return;
    }
    const fields = {
      title: clean,
      assignee,
      recurrence,
      weeklyDay: recurrence === 'weekly' ? weeklyDay : undefined,
      monthlyDay: recurrence === 'monthly' ? monthlyDay : undefined,
      ...care,
    };
    if (editing) {
      if (!updateHomeTask(editing.id, fields)) {
        setError('Impossible d’enregistrer cette tâche.');
        return;
      }
      onClose();
      return;
    }
    if (createHomeTask(fields) === null) {
      setError('Impossible d’ajouter cette tâche.');
      return;
    }
    onClose();
    const dueToday =
      recurrence === 'none' ||
      recurrence === 'daily' ||
      (recurrence === 'weekly' && (care.flexible || weeklyDay === isoWeekday(today))) ||
      (recurrence === 'monthly' && monthlyDay === today.getDate());
    toast.show({ message: dueToday ? 'Tâche ajoutée à aujourd’hui' : fr('Tâche ajoutée à « À venir »'), icon: 'leaf' });
  };

  const assigneeOptions = [
    { value: 'a' as const, ariaLabel: names.a, label: <WhoOption who="a" name={names.a} size={22} /> },
    { value: 'b' as const, ariaLabel: names.b, label: <WhoOption who="b" name={names.b} size={22} /> },
    { value: 'both' as const, ariaLabel: 'Ensemble', label: <WhoOption who="both" name="Ensemble" size={19} /> },
    { value: 'unassigned' as const, ariaLabel: 'Libre', label: <WhoOption who="unassigned" name="Libre" size={20} /> },
  ];

  return (
    <>
      <Sheet
        open={state !== null}
        onClose={onClose}
        title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'}
        size="auto"
        initialFocusRef={headingRef}
        className="task-sheet"
        footer={
          <>
            {editing && (
              <Button variant="danger-ghost" icon="trash" onClick={() => setConfirmDelete(true)} className="task-sheet__delete">
                Supprimer
              </Button>
            )}
            <Button variant="primary" onClick={submit} icon={editing ? 'check' : 'plus'}>
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </>
        }
      >
        <form
          className="task-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <TextField
            ref={titleRef}
            id="task-title"
            label="Quoi&#8239;?"
            value={title}
            onChange={(value) => {
              setTitle(value);
              if (error) setError(null);
            }}
            placeholder="Ex. Arroser les plantes"
            maxLength={80}
            enterKeyHint="done"
            error={error}
            autoCapitalize="sentences"
          />
          <div className="task-form__group">
            <Segmented name="task-who" legend="Qui&#8239;?" options={assigneeOptions} value={assignee} onChange={setAssignee} columns={4} className="task-form__who" />
            {personChosen && (
              <Switch
                id="task-rotation"
                checked={rotation}
                onChange={setRotation}
                label="Tour à tour"
                description={rotationText}
                icon={<Icon name="repeat" size={19} />}
                className="task-form__rotation"
              />
            )}
          </div>
          <Segmented
            name="task-effort"
            legend="Quel effort&#8239;?"
            options={EFFORT_OPTIONS}
            value={String(effort) as EffortValue}
            onChange={(value) => setEffort(Number(value) as TaskEffort)}
            columns={3}
            className="task-form__effort"
          />
          <div className="task-form__group">
            <Segmented name="task-recurrence" legend="Quand&#8239;?" options={RECURRENCES} value={recurrence} onChange={setRecurrence} columns={4} className="task-form__when" />
            {recurrence === 'weekly' && (
              <Segmented
                name="task-weekmode"
                legend="Un jour précis ou dans la semaine"
                legendVisible={false}
                options={WEEK_MODES}
                value={flexible ? 'flexible' : 'fixed'}
                onChange={(value) => setFlexible(value === 'flexible')}
                columns={2}
                size="sm"
                className="task-form__weekmode"
              />
            )}
            {recurrence === 'weekly' && flexible && (
              <p className="task-form__note">
                <Icon name="leaf" size={16} />
                <span>Une fois, le jour qui vous arrange. Pas de retard.</span>
              </p>
            )}
            {recurrence === 'weekly' && !flexible && (
              <Segmented
                name="task-weekday"
                legend="Quel jour&#8239;?"
                legendVisible={false}
                options={WEEKDAYS.map((d) => ({ value: String(d.iso), label: d.short, ariaLabel: d.long }))}
                value={String(weeklyDay)}
                onChange={(value) => setWeeklyDay(Number(value))}
                columns={7}
                size="sm"
                className="task-form__days"
              />
            )}
            {recurrence === 'monthly' && (
              <div className="field">
                <label className="field__label" htmlFor="task-monthday">
                  Quel jour du mois&#8239;?
                </label>
                <select id="task-monthday" className="select" value={monthlyDay} onChange={(event) => setMonthlyDay(Number(event.target.value))}>
                  {MONTH_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d === 1 ? 'Le 1er' : `Le ${d}`}
                    </option>
                  ))}
                </select>
                {monthlyDay > 28 && <p className="field__hint">Les mois plus courts, ce sera le dernier jour.</p>}
              </div>
            )}
          </div>
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title={fr('Supprimer cette tâche ?')}
        confirmLabel="Supprimer"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (editing && deleteHomeTask(editing.id)) {
            onClose();
            toast.show({ message: fr(`Tâche supprimée : ${editing.title}`), icon: 'trash' });
          }
        }}
      >
        <p>
          «&nbsp;{editing?.title}&nbsp;» disparaîtra de la liste. Les gestes déjà faits restent dans l’historique, et la forêt ne
          perd rien.
        </p>
      </ConfirmDialog>
    </>
  );
}
