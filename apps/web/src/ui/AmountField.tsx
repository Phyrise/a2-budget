/**
 * Montant en euros entiers affiché en grand et net ; un toucher ouvre
 * l'AmountPad. Aucun curseur, aucun champ texte : faire défiler la page ne
 * peut rien changer, et le clavier du téléphone ne s'ouvre jamais.
 *
 * Identifiants : `${id}` (conteneur), `${id}-value` (bouton du montant),
 * `${id}-pad-…` (feuille : display, ok, cancel).
 */
import { formatEuros, roundToEuroCents } from '@a2/core';
import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { AmountPad, type AmountShortcut } from './AmountPad';
import { cx } from './format';

export interface AmountFieldProps {
  id: string;
  /** Libellé visible (facultatif : « Salaire du mois »). */
  label?: ReactNode;
  /** Nom accessible du montant et titre de la feuille (« Salaire d’AL »). */
  accessibleLabel: string;
  valueCents: number;
  onCommit: (cents: number) => void;
  shortcuts?: readonly AmountShortcut[];
  /** Précision sous le titre de la feuille (« Octobre 2026 »). */
  padDescription?: string;
  /** Petite aide sous le montant. */
  hint?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  /** Disposition : libellé au-dessus (`stack`) ou à gauche du montant (`row`). */
  layout?: 'stack' | 'row' | 'bare';
  className?: string;
  /** Appelé une fois la feuille refermée (validée ou non), focus rendu au montant. */
  onPadClosed?: () => void;
}

export interface AmountFieldHandle {
  /** Ouvre la feuille (le focus revient ensuite sur le montant). */
  open: () => void;
}

export const AmountField = forwardRef<AmountFieldHandle, AmountFieldProps>(function AmountField(
  {
    id,
    label,
    accessibleLabel,
    valueCents,
    onCommit,
    shortcuts,
    padDescription,
    hint,
    size = 'md',
    layout = 'stack',
    className,
    onPadClosed,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const shown = formatEuros(roundToEuroCents(valueCents));

  useImperativeHandle(ref, () => ({
    open: () => {
      // Le focus part du montant (jamais d'un champ texte) : il y revient à la fermeture.
      buttonRef.current?.focus({ preventScroll: true });
      setOpen(true);
    },
  }));

  return (
    <div id={id} className={cx('amount-field', `amount-field--${size}`, `amount-field--${layout}`, className)}>
      {label !== undefined && (
        <span className="amount-field__label" id={`${id}-label`} aria-hidden="true">
          {label}
        </span>
      )}
      <button
        ref={buttonRef}
        id={`${id}-value`}
        type="button"
        className={cx('amount-field__button amount', open && 'is-open')}
        aria-haspopup="dialog"
        aria-label={`${accessibleLabel} : ${shown}, modifier`}
        onClick={() => setOpen(true)}
      >
        {shown}
      </button>
      {hint && <span className="amount-field__hint">{hint}</span>}
      <AmountPad
        open={open}
        onClose={() => setOpen(false)}
        onClosed={onPadClosed}
        title={accessibleLabel}
        description={padDescription}
        valueCents={valueCents}
        onCommit={onCommit}
        shortcuts={shortcuts}
        idPrefix={id}
      />
    </div>
  );
});
