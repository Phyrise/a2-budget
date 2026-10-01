import { parseAmountInput, formatCents } from '@a2/core';
import { useDraftField } from './draftField';
import { centsToPlain } from './format';

/**
 * Champ de montant (centimes).
 *
 * - Clavier décimal mobile (`inputmode="decimal"`).
 * - La chaîne en cours d'édition est locale au composant ; `parseAmountInput`
 *   (@a2/core) tranche : valide → commit ; invalide → message local, aucun
 *   changement d'état ; vide ≠ 0 ; « 0 » valide.
 * - Hors édition, le montant est formaté fr-FR/EUR (`formatCents`).
 */

const ERROR_MESSAGES: Record<string, string> = {
  'too-many-decimals': 'Montant invalide : deux décimales maximum.',
  'out-of-range': 'Montant invalide : valeur trop élevée.',
  invalid: 'Montant invalide.',
};

export function AmountInput({
  id,
  label,
  labelVisible = true,
  valueCents,
  onCommit,
  onValidityChange,
  className,
}: {
  id: string;
  label: string;
  /** false → label masqué visuellement (un label visible externe le remplace). */
  labelVisible?: boolean;
  valueCents: number;
  onCommit: (cents: number) => void;
  /** Permet à un formulaire de refuser une saisie vide ou invalide. */
  onValidityChange?: (valid: boolean) => void;
  className?: string;
}) {
  const field = useDraftField({
    plainValue: centsToPlain(valueCents),
    displayValue: formatCents(valueCents),
    onValidityChange,
    parse: (raw, final) => {
      const result = parseAmountInput(raw);
      if (result.ok) {
        return { ok: true, commit: () => onCommit(result.cents) };
      }
      if (result.reason === 'empty') {
        return { ok: false, kind: 'empty' };
      }
      // État transitoire pendant la frappe (« 12, ») : pas d'erreur.
      if (!final && /[,.\s]$/.test(raw)) {
        return { ok: false, kind: 'transient' };
      }
      return {
        ok: false,
        kind: 'error',
        message: ERROR_MESSAGES[result.reason] ?? 'Montant invalide.',
      };
    },
  });

  return (
    <div className={className ? `amount-input ${className}` : 'amount-input'}>
      <label className={labelVisible ? 'field__label' : 'visually-hidden'} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="amount-input__field amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={field.value}
        onFocus={field.onFocus}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={field.onBlur}
        aria-invalid={field.error !== null}
        aria-describedby={field.error !== null ? `${id}-error` : undefined}
      />
      {field.error !== null && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {field.error}
        </p>
      )}
    </div>
  );
}
