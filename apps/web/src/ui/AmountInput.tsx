import { formatEuros, parseEurosInput } from '@a2/core';
import type { KeyboardEvent } from 'react';
import { useDraftField } from './draftField';
import { centsToPlain, cx } from './format';

/**
 * Champ de montant en EUROS ENTIERS (V4 : plus aucun centime).
 *
 * - Clavier numérique mobile (`inputmode="numeric"`).
 * - La chaîne d'édition est locale ; `parseEurosInput` (@a2/core) tranche :
 *   valide → commit (centimes = euros × 100) ; invalide → message local,
 *   aucun changement d'état ; vide ≠ 0 ; « 0 » valide ; centimes refusés.
 * - Hors édition, le montant est formaté sans centimes (`formatEuros`).
 */

export const EURO_ERROR_MESSAGES: Record<string, string> = {
  'not-integer': 'En euros entiers, sans centimes.',
  'out-of-range': 'Montant trop élevé.',
  invalid: 'Montant illisible (ex. 1 234).',
};

export interface AmountInputProps {
  id: string;
  label: string;
  /** false → libellé masqué visuellement (un libellé visible externe le remplace). */
  labelVisible?: boolean;
  valueCents: number;
  onCommit: (cents: number) => void;
  /** Permet à un formulaire de refuser une saisie vide ou invalide. */
  onValidityChange?: (valid: boolean) => void;
  /** Apparence : champ encadré (défaut), grand (salaires), ou en ligne (listes). */
  appearance?: 'field' | 'large' | 'inline';
  className?: string;
  hint?: string;
  onEnter?: () => void;
}

export function AmountInput({
  id,
  label,
  labelVisible = true,
  valueCents,
  onCommit,
  onValidityChange,
  appearance = 'field',
  className,
  hint,
  onEnter,
}: AmountInputProps) {
  const field = useDraftField({
    plainValue: centsToPlain(valueCents),
    displayValue: formatEuros(valueCents),
    onValidityChange,
    parse: (raw, final) => {
      const result = parseEurosInput(raw);
      if (result.ok) return { ok: true, commit: () => onCommit(result.cents) };
      if (result.reason === 'empty') return { ok: false, kind: 'empty' };
      // État transitoire pendant la frappe (« 1 2 ») : pas d'erreur.
      if (!final && /[,.\s]$/.test(raw)) return { ok: false, kind: 'transient' };
      return { ok: false, kind: 'error', message: EURO_ERROR_MESSAGES[result.reason] ?? 'Montant illisible.' };
    },
  });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && field.dirty) {
      event.preventDefault();
      event.stopPropagation();
      field.cancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (onEnter) {
        event.currentTarget.blur();
        onEnter();
      } else {
        event.currentTarget.blur();
      }
    }
  };

  const describedBy = [field.error !== null ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cx('amount-input', `amount-input--${appearance}`, field.error !== null && 'is-invalid', className)}>
      <label className={labelVisible ? 'field__label' : 'visually-hidden'} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="amount-input__field amount"
        type="text"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={field.value}
        onFocus={(event) => {
          field.onFocus();
          // Sélection du texte pour une saisie directe (après la mise à jour du brouillon).
          const input = event.currentTarget;
          requestAnimationFrame(() => {
            if (document.activeElement === input) input.select();
          });
        }}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={field.onBlur}
        onKeyDown={onKeyDown}
        aria-invalid={field.error !== null}
        aria-describedby={describedBy || undefined}
      />
      {hint && field.error === null && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {field.error !== null && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {field.error}
          {/* Hors formulaire, la dernière valeur valide reste affichée et enregistrée. */}
          {!field.editing && onValidityChange === undefined && ' Le montant précédent est conservé.'}
        </p>
      )}
    </div>
  );
}
