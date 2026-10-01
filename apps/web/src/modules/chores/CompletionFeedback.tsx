/**
 * Feedback de complétion — positif, non compétitif, bref.
 *
 * Quand une tâche est terminée, un petit compagnon réagit (Jiji pour AL,
 * Calcifer pour AC, les deux pour « ensemble »), quelques feuilles s'envolent
 * et une phrase chaleureuse s'affiche ~1,6 s. Aucune note, aucun score, aucune
 * comparaison. Respecte `prefers-reduced-motion`.
 *
 * Composant autonome : reçoit l'assignee et une clé de re-déclenchement.
 */

import jiji from '../../assets/jiji-avatar-small.png';
import calcifer from '../../assets/calcifer-avatar-small.png';
import type { TaskAssignee } from '@a2/core';
import './chores.css';

function sentenceFor(assignee: TaskAssignee, names: { a: string; b: string }): string {
  switch (assignee) {
    case 'a':
      return `Un petit pas pour la maison, ${names.a}.`;
    case 'b':
      return `Merci pour la maison, ${names.b}.`;
    case 'both':
      return 'Bien joué à vous deux.';
    default:
      return 'La maison vous dit merci.';
  }
}

export function CompletionFeedback({
  assignee,
  names,
  trigger,
}: {
  assignee: TaskAssignee;
  names: { a: string; b: string };
  /** Change à chaque complétion pour re-déclencher l'animation. */
  trigger: number;
}) {
  if (trigger === 0) return null;
  const showA = assignee === 'a' || assignee === 'both';
  const showB = assignee === 'b' || assignee === 'both';

  return (
    <div className="completion-feedback" key={trigger} role="status" aria-live="polite">
      <div className="completion-feedback__companions" aria-hidden="true">
        {showA && <img className="completion-feedback__companion" src={jiji} alt="" />}
        {showB && <img className="completion-feedback__companion" src={calcifer} alt="" />}
      </div>
      <div className="completion-feedback__leaves" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <p className="completion-feedback__text">{sentenceFor(assignee, names)}</p>
    </div>
  );
}
