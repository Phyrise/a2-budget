/**
 * AmountPad — petite feuille de saisie d'un montant en euros entiers.
 *
 * Montant en très grand, pavé numérique maison à grosses touches (0–9, 00,
 * effacer) — aucun clavier système ne s'ouvre —, pas de −100 / −10 / +10 /
 * +100, raccourcis contextuels (« Salaire habituel », « Comme le mois
 * dernier »…), Annuler / Valider.
 *
 * Accessibilité : dialog modal (Sheet : focus piégé, Échap = Annuler, retour
 * du focus au montant d'origine) ; le montant reçoit le focus et annonce ses
 * changements (aria-live) ; clavier physique : chiffres, Retour arrière,
 * Suppr (tout effacer), Entrée (valider), + / − (pas de 10 €).
 *
 * Rien n'est écrit avant « Valider » ; un montant inchangé n'écrit rien.
 */
import { formatEuros, roundToEuroCents } from '@a2/core';
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { cx } from './format';
import { haptic } from './holdRepeat';
import { padEuros, padInit, padReduce, type PadAction, type PadState } from './amountPadModel';
import { Sheet } from './Sheet';
import './amountPad.css';

export interface AmountShortcut {
  /** « Salaire habituel », « Comme le mois dernier », « Aucun »… */
  label: string;
  cents: number;
}

export interface AmountPadProps {
  open: boolean;
  onClose: () => void;
  /** Titre de la feuille (« Salaire d’AL »). */
  title: string;
  /** Courte précision sous le titre (« Octobre 2026 »). */
  description?: string;
  valueCents: number;
  /** Appelé à « Valider » avec des centimes multiples de 100 (seulement si le montant change, sauf `commitUnchanged`). */
  onCommit: (cents: number) => void;
  /** Valider écrit même un montant inchangé (« Recaler » confirme le solde). */
  commitUnchanged?: boolean;
  /** Libellé du bouton de validation (défaut « Valider »). */
  confirmLabel?: string;
  shortcuts?: readonly AmountShortcut[];
  /** Préfixe des identifiants (`${idPrefix}-pad-…`) pour les tests et l'accessibilité. */
  idPrefix?: string;
  className?: string;
  /** Feuille entièrement refermée (après l'animation, focus rendu). */
  onClosed?: () => void;
}

const STEPS = [-100, -10, 10, 100] as const;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const;

function stepLabel(euros: number): string {
  return `${euros < 0 ? 'Moins' : 'Plus'} ${Math.abs(euros)} €`;
}

function stepText(euros: number): string {
  return `${euros < 0 ? '−' : '+'}${Math.abs(euros)}`;
}

function BackspaceGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false" className="amount-pad__back-icon">
      <path
        d="M9.2 5.5h10.3a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.2a1.5 1.5 0 0 1-1.1-.5L3.4 12l4.7-6a1.5 1.5 0 0 1 1.1-.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AmountPad({
  open,
  onClose,
  title,
  description,
  valueCents,
  onCommit,
  commitUnchanged = false,
  confirmLabel = 'Valider',
  shortcuts = [],
  idPrefix = 'amount',
  className,
  onClosed,
}: AmountPadProps) {
  const [pad, setPad] = useState<PadState>(() => padInit(valueCents));
  const [wasOpen, setWasOpen] = useState(open);
  const displayRef = useRef<HTMLDivElement>(null);
  const padRef = useRef(pad);
  padRef.current = pad;

  // Chaque ouverture repart du montant enregistré.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPad(padInit(valueCents));
  }

  const apply = (action: PadAction) => {
    haptic(4);
    setPad((s) => padReduce(s, action));
  };

  const validate = () => {
    const cents = padEuros(padRef.current) * 100;
    // Montant affiché inchangé (même arrondi à l'euro) : rien à écrire.
    if (commitUnchanged || cents !== roundToEuroCents(valueCents)) onCommit(cents);
    onClose();
  };
  const validateRef = useRef(validate);
  validateRef.current = validate;

  // Clavier physique (chiffres, effacer, Entrée) tant que la feuille est ouverte.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      let action: PadAction | null = null;
      if (/^\d$/u.test(event.key)) action = { type: 'digit', digit: event.key };
      else if (event.key === 'Backspace') action = { type: 'backspace' };
      else if (event.key === 'Delete') action = { type: 'clear' };
      else if (event.key === '+') action = { type: 'step', euros: 10 };
      else if (event.key === '-' || event.key === '−') action = { type: 'step', euros: -10 };
      else if (event.key === 'Enter') {
        // Entrée active normalement Annuler, Fermer ou un raccourci ; ailleurs elle valide.
        const button = target?.closest('button');
        if (button && !button.hasAttribute('data-pad-key')) return;
        event.preventDefault();
        validateRef.current();
        return;
      }
      if (action === null) return;
      event.preventDefault();
      setPad((s) => padReduce(s, action));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const euros = padEuros(pad);
  const shown = formatEuros(euros * 100);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="auto"
      className={cx('amount-pad', className)}
      initialFocusRef={displayRef}
      onClosed={onClosed}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} id={`${idPrefix}-pad-cancel`}>
            Annuler
          </Button>
          <Button variant="primary" icon="check" onClick={validate} id={`${idPrefix}-pad-ok`}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div
        ref={displayRef}
        id={`${idPrefix}-pad-display`}
        className={cx('amount-pad__display amount', pad.fresh && 'is-fresh', pad.digits === '' && 'is-empty')}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="amount-pad-display"
      >
        <span className="amount-pad__value">{shown}</span>
        <span className="amount-pad__caret" aria-hidden="true" />
      </div>
      <p className="amount-pad__hint" aria-hidden="true">
        {pad.fresh ? 'Tapez un montant pour le remplacer' : ' '}
      </p>

      {shortcuts.length > 0 && (
        <div className="amount-pad__shortcuts" role="group" aria-label="Raccourcis">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              className={cx('chip amount-pad__shortcut', s.cents === euros * 100 && 'is-current')}
              onClick={() => apply({ type: 'set', euros: Math.round(s.cents / 100) })}
            >
              <span className="amount-pad__shortcut-label">{s.label}</span>
              <span className="amount-pad__shortcut-value amount">{formatEuros(s.cents)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="amount-pad__steps" role="group" aria-label="Ajuster">
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className={cx('amount-pad__step', step < 0 ? 'is-minus' : 'is-plus')}
            aria-label={stepLabel(step)}
            disabled={step < 0 && euros === 0}
            onClick={() => apply({ type: 'step', euros: step })}
          >
            {stepText(step)}
          </button>
        ))}
      </div>

      <div className="amount-pad__keys" role="group" aria-label="Pavé numérique">
        {KEYS.map((key) =>
          key === 'back' ? (
            <button
              key={key}
              type="button"
              data-pad-key=""
              className="amount-pad__key amount-pad__key--back"
              aria-label="Effacer le dernier chiffre"
              onClick={() => apply({ type: 'backspace' })}
            >
              <BackspaceGlyph />
            </button>
          ) : (
            <button
              key={key}
              type="button"
              data-pad-key=""
              className={cx('amount-pad__key', key === '00' && 'amount-pad__key--zz')}
              aria-label={key === '00' ? 'Deux zéros' : undefined}
              onClick={() => apply(key === '00' ? { type: 'double-zero' } : { type: 'digit', digit: key })}
            >
              {key}
            </button>
          ),
        )}
      </div>
    </Sheet>
  );
}
