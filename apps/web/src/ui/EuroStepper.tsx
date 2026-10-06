/**
 * Montant en euros entiers réglé par − / + (dépenses) : pas de 1 €, appui
 * long qui accélère (10 €, puis 50 €), toucher le montant pour le saisir.
 * Pas de curseur : les dépenses vont de quelques euros au loyer.
 *
 * Identifiants : `${id}-value` / `${id}-edit` (montant), `${id}-minus`,
 * `${id}-plus` (boutons).
 */
import { roundToEuroCents } from '@a2/core';
import { useRef, useState } from 'react';
import { EuroValue } from './EuroValue';
import { cx } from './format';
import { haptic, nextEuros, useHoldRepeat } from './holdRepeat';
import { Icon } from './Icon';
import './euroControls.css';

export interface EuroStepperProps {
  id: string;
  /** Nom accessible (« Montant de Loyer »). */
  label: string;
  valueCents: number;
  onCommit: (cents: number) => void;
  className?: string;
}

export function EuroStepper({ id, label, valueCents, onCommit, className }: EuroStepperProps) {
  const [draft, setDraft] = useState<number | null>(null); // euros
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const valueRef = useRef(valueCents);
  valueRef.current = valueCents;
  const shown = draft ?? roundToEuroCents(valueCents) / 100;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const pending = useRef<number | null>(null);

  const step = (direction: 1 | -1) => (size: number) => {
    const next = Math.max(0, nextEuros(shownRef.current, direction, size));
    if (next === shownRef.current) return false;
    haptic(4);
    pending.current = next;
    shownRef.current = next;
    setDraft(next);
    return true;
  };

  const release = () => {
    const value = pending.current;
    pending.current = null;
    setDraft(null);
    // Revenu à la valeur affichée de départ (+ puis −) : rien à écrire.
    if (value !== null && value * 100 !== roundToEuroCents(valueRef.current)) commitRef.current(value * 100);
  };

  const minus = useHoldRepeat(step(-1), release);
  const plus = useHoldRepeat(step(1), release);

  return (
    <div className={cx('euro-stepper', draft !== null && 'is-active', className)}>
      <button
        id={`${id}-minus`}
        type="button"
        className="euro-stepper__btn"
        aria-label={`${label} : moins 1 €`}
        disabled={shown <= 0}
        {...minus}
      >
        <Icon name="minus" size={17} strokeWidth={2.1} />
      </button>
      <EuroValue id={id} label={label} valueCents={shown * 100} active={draft !== null} onCommit={(cents) => commitRef.current(cents)} />
      <button id={`${id}-plus`} type="button" className="euro-stepper__btn" aria-label={`${label} : plus 1 €`} {...plus}>
        <Icon name="plus" size={17} strokeWidth={2.1} />
      </button>
    </div>
  );
}
