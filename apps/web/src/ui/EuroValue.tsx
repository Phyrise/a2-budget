/**
 * Montant en euros entiers « toucher pour saisir » : affiché comme un
 * chiffre (bouton) ; un toucher le transforme en champ numérique,
 * Entrée ou perte du focus valident, Échap annule.
 *
 * - `parseEurosInput` (@a2/core) tranche ; une saisie invalide affiche un
 *   message local et ne change rien (la valeur précédente reste).
 * - Les valeurs au-delà des bornes d'un curseur sont acceptées (le curseur
 *   se cale au maximum) : seule la plage sûre de core s'applique.
 * - Identifiants : `${id}-value` (bouton) et `${id}-edit` (champ).
 */
import { formatEuros, parseEurosInput } from '@a2/core';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EURO_ERROR_MESSAGES } from './AmountInput';
import { centsToPlain, cx } from './format';

export interface EuroValueProps {
  id: string;
  /** Nom accessible complet (ex. « Salaire de AL »). */
  label: string;
  /** Montant affiché (brouillon compris), en centimes. */
  valueCents: number;
  onCommit: (cents: number) => void;
  className?: string;
  /** Le chiffre s'illumine (geste en cours). */
  active?: boolean;
}

export function EuroValue({ id, label, valueCents, onCommit, className, active = false }: EuroValueProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (draft !== null) {
      const input = inputRef.current;
      input?.focus();
      input?.select();
    } else if (refocus.current) {
      refocus.current = false;
      buttonRef.current?.focus();
    }
  }, [draft !== null]);

  const finish = (raw: string | null, keepFocus: boolean) => {
    if (raw === null) return;
    refocus.current = keepFocus;
    const result = parseEurosInput(raw);
    if (result.ok) {
      setError(null);
      if (result.cents !== valueCents) onCommit(result.cents);
    } else if (result.reason !== 'empty') {
      setError(EURO_ERROR_MESSAGES[result.reason] ?? 'Montant illisible.');
    }
    setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(draft, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      refocus.current = true;
      setError(null);
      setDraft(null);
    }
  };

  const errorId = `${id}-error`;
  return (
    <span className={cx('euro-value', draft !== null && 'is-editing', active && 'is-active', error !== null && 'is-invalid', className)}>
      {draft === null ? (
        <button
          ref={buttonRef}
          id={`${id}-value`}
          type="button"
          className="euro-value__button amount"
          aria-label={`${label} : ${formatEuros(valueCents)}. Toucher pour saisir`}
          aria-describedby={error !== null ? errorId : undefined}
          onClick={() => {
            setError(null);
            setDraft(centsToPlain(valueCents));
          }}
        >
          {formatEuros(valueCents)}
        </button>
      ) : (
        <span className="euro-value__field">
          <input
            ref={inputRef}
            id={`${id}-edit`}
            className="euro-value__input amount"
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`${label}, en euros`}
            aria-invalid={error !== null}
            aria-describedby={error !== null ? errorId : undefined}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error !== null) setError(null);
            }}
            onBlur={() => finish(draft, false)}
            onKeyDown={onKeyDown}
          />
          <span className="euro-value__unit" aria-hidden="true">
            €
          </span>
        </span>
      )}
      {error !== null && (
        <span className="euro-value__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
