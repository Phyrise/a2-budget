/**
 * « Qui l'a fait ? » (V5.3 Courses, V5.4 toutes les tâches) : Jiji,
 * Calcifer ou les deux, un seul toucher. La personne la plus probable
 * (prévue, sinon soi) est mise en avant et reçoit le focus. Fermer sans
 * choisir : rien n'est coché.
 */
import type { ChoreDoer, TaskAssignee } from '@a2/core';
import { useRef } from 'react';
import { useApp } from '../../state/store';
import { Companion, Sheet, cx, fr } from '../../ui';
import './who-did.css';

/** La personne mise en avant : la personne prévue, sinon soi (connecté). */
export function likelyDoer(planned: TaskAssignee | undefined, me: 'a' | 'b' | null): ChoreDoer | undefined {
  if (planned === 'a' || planned === 'b' || planned === 'both') return planned;
  return me ?? undefined;
}

export function WhoDidSheet({
  open,
  onPick,
  onClose,
  title,
  suggested,
}: {
  open: boolean;
  onPick: (who: ChoreDoer) => void;
  onClose: () => void;
  /** La tâche (petite ligne sous « Qui ? »). */
  title?: string;
  suggested?: ChoreDoer;
}) {
  const { appState } = useApp();
  const focusRef = useRef<HTMLButtonElement>(null);
  const names = { a: appState?.budget.settings.personA.name ?? 'AL', b: appState?.budget.settings.personB.name ?? 'AC' };
  const choices: Array<{ who: ChoreDoer; label: string; size: number }> = [
    { who: 'a', label: names.a, size: 56 },
    { who: 'b', label: names.b, size: 56 },
    { who: 'both', label: 'Ensemble', size: 46 },
  ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={fr('Qui ?')}
      description={title}
      size="auto"
      className="who-did"
      initialFocusRef={suggested !== undefined ? focusRef : undefined}
    >
      <div className="who-did__choices" role="group" aria-label={fr(title ? `Qui a fait : ${title} ?` : 'Qui l’a fait ?')}>
        {choices.map((c) => (
          <button
            key={c.who}
            ref={c.who === suggested ? focusRef : undefined}
            type="button"
            className={cx('who-did__choice', c.who === suggested && 'is-suggested')}
            data-who={c.who}
            onClick={() => onPick(c.who)}
            aria-label={c.label}
          >
            <Companion who={c.who} size={c.size} mood={c.who === suggested ? 'happy' : 'idle'} />
            <span className="who-did__name" aria-hidden="true">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
