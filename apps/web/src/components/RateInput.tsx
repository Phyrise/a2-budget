import { useDraftField } from './draftField';
import { bpsToPlain, formatRateBps } from './format';

/**
 * Champ de taux, saisi en pourcentage (0–100, deux décimales maximum) et
 * converti en points de base entiers (40 % → 4000, 33,33 % → 3333).
 *
 * Le contrat @a2/core n'expose pas de parseur de taux (parseAmountInput
 * concerne les montants) : l'analyse de la saisie est donc locale à l'UI,
 * déterministe, et rejette sans tronquer (ambigu, > 2 décimales, hors plage).
 */

type RateParse =
  | { ok: true; bps: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'too-many-decimals' | 'out-of-range' };

function parseRatePercent(raw: string): RateParse {
  const s = raw.replace(/\s+/g, '');
  if (s === '') {
    return { ok: false, reason: 'empty' };
  }
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(s);
  if (match === null) {
    return { ok: false, reason: 'invalid' };
  }
  const whole = match[1] ?? '';
  const decimals = match[2] ?? '';
  if (decimals.length > 2) {
    return { ok: false, reason: 'too-many-decimals' };
  }
  // Arithmétique entière exacte : « 33,33 » → 33*100 + 33 = 3333.
  const bps = Number(whole) * 100 + (decimals === '' ? 0 : Number(decimals) * 10 ** (2 - decimals.length));
  if (bps > 10_000) {
    return { ok: false, reason: 'out-of-range' };
  }
  return { ok: true, bps };
}

const ERROR_MESSAGES: Record<string, string> = {
  'too-many-decimals': 'Taux invalide : deux décimales maximum.',
  'out-of-range': 'Taux invalide : entre 0 et 100 %.',
  invalid: 'Taux invalide.',
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
    displayValue: `${formatRateBps(valueBps)} %`,
    parse: (raw, final) => {
      const result = parseRatePercent(raw);
      if (result.ok) {
        return { ok: true, commit: () => onCommit(result.bps) };
      }
      if (result.reason === 'empty') {
        return { ok: false, kind: 'empty' };
      }
      if (!final && /[,.\s]$/.test(raw)) {
        return { ok: false, kind: 'transient' };
      }
      return {
        ok: false,
        kind: 'error',
        message: ERROR_MESSAGES[result.reason] ?? 'Taux invalide.',
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
