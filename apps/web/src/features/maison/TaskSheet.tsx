/**
 * Feuille d'ajout / d'édition d'une tâche Maison : quoi, qui, quand (jour
 * de semaine ou du mois choisi, pas imposé à aujourd'hui), suppression.
 */
import { isoWeekday, type HouseholdTask, type TaskAssignee, type TaskRecurrence } from '@a2/core';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { Button, Companion, ConfirmDialog, Segmented, Sheet, TextField, WEEKDAYS, fr, useToast } from '../../ui';

export type TaskSheetState = { mode: 'create' } | { mode: 'edit'; task: HouseholdTask } | null;

const RECURRENCES: ReadonlyArray<{ value: TaskRecurrence; label: string }> = [
  { value: 'none', label: 'Une fois' },
  { value: 'daily', label: 'Chaque jour' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function TaskSheet({ state, onClose }: { state: TaskSheetState; onClose: () => void }) {
  const { createHomeTask, updateHomeTask, deleteHomeTask, appState, today } = useApp();
  const toast = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const editing = state?.mode === 'edit' ? state.task : null;

  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<TaskAssignee>('both');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('weekly');
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (state === null) return;
    const now = new Date();
    if (state.mode === 'edit') {
      const t = state.task;
      setTitle(t.title);
      setAssignee(t.assignee);
      setRecurrence(t.recurrence);
      setWeeklyDay(t.weeklyDay ?? isoWeekday(now));
      setMonthlyDay(t.monthlyDay ?? now.getDate());
    } else {
      setTitle('');
      setAssignee('both');
      setRecurrence('weekly');
      setWeeklyDay(isoWeekday(now));
      setMonthlyDay(now.getDate());
    }
    setError(null);
  }, [state]);

  const names = {
    a: appState?.budget.settings.personA.name ?? 'AL',
    b: appState?.budget.settings.personB.name ?? 'AC',
  };

  const submit = () => {
    const clean = title.replace(/\s+/g, ' ').trim();
    if (clean === '') {
      setError('Donnez un nom à la tâche.');
      titleRef.current?.focus();
      return;
    }
    if (editing) {
      const ok = updateHomeTask(editing.id, {
        title: clean,
        assignee,
        recurrence,
        weeklyDay: recurrence === 'weekly' ? weeklyDay : undefined,
        monthlyDay: recurrence === 'monthly' ? monthlyDay : undefined,
      });
      if (!ok) {
        setError('Impossible d’enregistrer cette tâche.');
        return;
      }
      onClose();
      return;
    }
    const created = createHomeTask({
      title: clean,
      assignee,
      recurrence,
      weeklyDay: recurrence === 'weekly' ? weeklyDay : undefined,
      monthlyDay: recurrence === 'monthly' ? monthlyDay : undefined,
    });
    if (created === null) {
      setError('Impossible d’ajouter cette tâche.');
      return;
    }
    onClose();
    const dueToday =
      recurrence === 'none' ||
      recurrence === 'daily' ||
      (recurrence === 'weekly' && weeklyDay === isoWeekday(today)) ||
      (recurrence === 'monthly' && monthlyDay === today.getDate());
    toast.show({ message: dueToday ? 'Tâche ajoutée à aujourd’hui' : fr('Tâche ajoutée à « À venir »'), icon: 'leaf' });
  };

  const assigneeOptions = [
    {
      value: 'a' as const,
      ariaLabel: names.a,
      label: (
        <span className="who-option">
          <Companion who="a" size={26} />
          <span>{names.a}</span>
        </span>
      ),
    },
    {
      value: 'b' as const,
      ariaLabel: names.b,
      label: (
        <span className="who-option">
          <Companion who="b" size={26} />
          <span>{names.b}</span>
        </span>
      ),
    },
    {
      value: 'both' as const,
      ariaLabel: 'Ensemble',
      label: (
        <span className="who-option">
          <Companion who="both" size={22} />
          <span>Ensemble</span>
        </span>
      ),
    },
    {
      value: 'unassigned' as const,
      ariaLabel: 'Libre',
      label: (
        <span className="who-option">
          <Companion who="unassigned" size={24} />
          <span>Libre</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <Sheet
        open={state !== null}
        onClose={onClose}
        title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'}
        size="auto"
        initialFocusRef={editing ? undefined : titleRef}
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
          <Segmented name="task-who" legend="Qui&#8239;?" options={assigneeOptions} value={assignee} onChange={setAssignee} columns={4} className="task-form__who" />
          <Segmented name="task-recurrence" legend="Quand&#8239;?" options={RECURRENCES} value={recurrence} onChange={setRecurrence} columns={2} />
          {recurrence === 'weekly' && (
            <Segmented
              name="task-weekday"
              legend="Quel jour&#8239;?"
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
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title={'Supprimer cette tâche ?'}
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
