import { useId, useRef, useState, type FormEvent } from 'react';
import type { Person, TaskAssignee, TaskRecurrence } from '@a2/core';
import './maisonactions.css';

export interface MaisonActionsProps {
  people: Person[];
  paused: boolean;
  onCreate: (title: string, assignee: TaskAssignee, recurrence: TaskRecurrence) => void;
  onPauseToggle: () => void;
}

/** Quick task creation and a gentle pause control; persistence belongs to the caller. */
export function MaisonActions({ people, paused, onCreate, onPauseToggle }: MaisonActionsProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<TaskAssignee>('unassigned');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [notice, setNotice] = useState('');
  const nameA = people[0]?.name ?? 'AL';
  const nameB = people[1]?.name ?? 'AC';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onCreate(trimmedTitle, assignee, recurrence);
    setTitle('');
    setNotice(`« ${trimmedTitle} » ajoutée.`);
    titleRef.current?.focus();
  };

  return (
    <section className="maison-actions" aria-label="Ajouter une tâche et mettre la maison en pause">
      <form className="maison-actions__form" onSubmit={handleSubmit}>
        <label className="maison-actions__title-label" htmlFor={`${id}-title`}>Une tâche pour la maison</label>
        <div className="maison-actions__quick-row">
          <input
            ref={titleRef}
            id={`${id}-title`}
            className="maison-actions__input"
            type="text"
            value={title}
            onChange={(event) => { setTitle(event.target.value); setNotice(''); }}
            placeholder="Une tâche, ex. Aspirateur"
            autoComplete="off"
            required
          />
          <button className="maison-actions__create" type="submit" disabled={!title.trim()} aria-label="Ajouter la tâche"><span aria-hidden="true">+</span></button>
        </div>
        <details className="maison-actions__disclosure">
          <summary>
            <span>Répartition et fréquence</span>
            <span className="maison-actions__selection">{assignee === 'a' ? nameA : assignee === 'b' ? nameB : assignee === 'both' ? 'Ensemble' : 'À répartir'} · {recurrence === 'none' ? 'Une fois' : recurrence === 'daily' ? 'Chaque jour' : recurrence === 'weekly' ? 'Chaque semaine' : 'Chaque mois'}</span>
          </summary>
          <div className="maison-actions__options">
          <div>
            <label className="maison-actions__label" htmlFor={`${id}-assignee`}>Qui s’en occupe ?</label>
            <select
              id={`${id}-assignee`}
              className="maison-actions__input"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value as TaskAssignee)}
            >
              <option value="unassigned">À répartir</option>
              <option value="a">{nameA}</option>
              <option value="b">{nameB}</option>
              <option value="both">Ensemble</option>
            </select>
          </div>
          <div>
            <label className="maison-actions__label" htmlFor={`${id}-recurrence`}>À quelle fréquence ?</label>
            <select
              id={`${id}-recurrence`}
              className="maison-actions__input"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as TaskRecurrence)}
            >
              <option value="none">Une fois</option>
              <option value="daily">Chaque jour</option>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
            </select>
          </div>
          </div>
          {(recurrence === 'weekly' || recurrence === 'monthly') && (
            <p className="maison-actions__hint">À partir d’aujourd’hui, puis {recurrence === 'weekly' ? 'chaque semaine' : 'chaque mois'}.</p>
          )}
        </details>
        <p className="maison-actions__notice" role="status" aria-live="polite">{notice}</p>
      </form>
      <footer className="maison-actions__footer">
      <button
        className="maison-actions__pause"
        type="button"
        aria-pressed={paused}
        onClick={onPauseToggle}
      >
        {paused ? 'Réveiller la maison' : 'Mettre la maison en pause'}
      </button>
      {paused && <p className="maison-actions__hint">La forêt se repose. Tout ce qui a grandi reste avec vous.</p>}
      </footer>
    </section>
  );
}
