import { parseAmountInput, formatCents } from '@a2/core';
import type { KeyboardEvent } from 'react';
import { useDraftField } from './draftField';
import { centsToPlain, cx } from './format';

/**
 * Champ de montant (centimes entiers).
 *
 * - Clavier décimal mobile (`inputmode="decimal"`), virgule ou point.
 * - La chaîne d'édition est locale ; `parseAmountInput` (@a2/core) tranche :
 *   valide → commit ; invalide → message local, aucun changement d'état ;
 *   vide ≠ 0 ; « 0 » valide ; ambiguïtés (« 1,234 ») rejetées.
 * - Hors édition, le montant est formaté fr-FR (`formatCents`).
 */

const ERROR_MESSAGES: Record<string, string> = {
  'too-many-decimals': 'Deux décimales au maximum.',
  'out-of-range': 'Montant trop élevé.',
  invalid: 'Montant illisible (ex. 1 234,56).',
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
    displayValue: formatCents(valueCents),
    onValidityChange,
    parse: (raw, final) => {
      const result = parseAmountInput(raw);
      if (result.ok) return { ok: true, commit: () => onCommit(result.cents) };
      if (result.reason === 'empty') return { ok: false, kind: 'empty' };
      // État transitoire pendant la frappe (« 12, ») : pas d'erreur.
      if (!final && /[,.\s]$/.test(raw)) return { ok: false, kind: 'transient' };
      return { ok: false, kind: 'error', message: ERROR_MESSAGES[result.reason] ?? 'Montant illisible.' };
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
        inputMode="decimal"
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
        </p>
      )}
    </div>
  );
}
