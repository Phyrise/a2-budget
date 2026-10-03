import { MAX_RATE_BPS } from '@a2/core';
import type { KeyboardEvent } from 'react';
import { useDraftField } from './draftField';
import { bpsToPlain, cx, percent } from './format';

/**
 * Champ de taux saisi en pourcentage (0–100, deux décimales au plus) et
 * converti en points de base entiers (40 % → 4000, 33,33 % → 3333).
 * Analyse déterministe de la saisie (core n'expose pas de parseur de taux) :
 * rejet sans troncature (ambigu, > 2 décimales, hors plage).
 */

type RateParse =
  | { ok: true; bps: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'too-many-decimals' | 'out-of-range' };

export function parseRatePercent(raw: string): RateParse {
  const s = raw.replace(/[\s  ]+/g, '').replace(/%$/, '');
  if (s === '') return { ok: false, reason: 'empty' };
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(s);
  if (match === null) return { ok: false, reason: 'invalid' };
  const whole = match[1] ?? '';
  const decimals = match[2] ?? '';
  if (decimals.length > 2) return { ok: false, reason: 'too-many-decimals' };
  // Arithmétique entière exacte : « 33,33 » → 33 × 100 + 33 = 3333.
  const bps = Number(whole) * 100 + (decimals === '' ? 0 : Number(decimals) * 10 ** (2 - decimals.length));
  if (!Number.isSafeInteger(bps) || bps > MAX_RATE_BPS) return { ok: false, reason: 'out-of-range' };
  return { ok: true, bps };
}

const ERROR_MESSAGES: Record<string, string> = {
  'too-many-decimals': 'Deux décimales au maximum.',
  'out-of-range': 'Entre 0 et 100 %.',
  invalid: 'Taux illisible (ex. 40 ou 33,33).',
};

export function RateInput({
  id,
  label,
  valueBps,
  onCommit,
  className,
  labelVisible = true,
}: {
  id: string;
  label: string;
  valueBps: number;
  onCommit: (bps: number) => void;
  className?: string;
  labelVisible?: boolean;
}) {
  const field = useDraftField({
    plainValue: bpsToPlain(valueBps),
    displayValue: percent(valueBps),
    parse: (raw, final) => {
      const result = parseRatePercent(raw);
      if (result.ok) return { ok: true, commit: () => onCommit(result.bps) };
      if (result.reason === 'empty') return { ok: false, kind: 'empty' };
      if (!final && /[,.\s]$/.test(raw)) return { ok: false, kind: 'transient' };
      return { ok: false, kind: 'error', message: ERROR_MESSAGES[result.reason] ?? 'Taux illisible.' };
    },
  });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && field.dirty) {
      event.preventDefault();
      event.stopPropagation();
      field.cancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <div className={cx('amount-input', 'amount-input--field', 'rate-input', field.error !== null && 'is-invalid', className)}>
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
          const input = event.currentTarget;
          requestAnimationFrame(() => {
            if (document.activeElement === input) input.select();
          });
        }}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={field.onBlur}
        onKeyDown={onKeyDown}
        aria-invalid={field.error !== null}
        aria-describedby={field.error !== null ? `${id}-error` : undefined}
      />
      {field.error !== null && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {field.error}
        </p>
      )}
    </div>
  );
}
