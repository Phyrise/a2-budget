import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './format';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  id: string;
  label: string;
  labelVisible?: boolean;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
  /** Élément accolé à droite du champ (ex. bouton « Ajouter »). */
  trailing?: ReactNode;
  appearance?: 'field' | 'inline' | 'large';
}

/** Champ texte contrôlé (formulaires). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, labelVisible = true, value, onChange, hint, error, trailing, appearance = 'field', className, ...rest },
  ref,
) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return (
    <div className={cx('field', `field--${appearance}`, error && 'is-invalid', className)}>
      <label className={labelVisible ? 'field__label' : 'visually-hidden'} htmlFor={id}>
        {label}
      </label>
      <div className="field__row">
        <input
          ref={ref}
          id={id}
          className="field__input"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...rest}
        />
        {trailing}
      </div>
      {hint && !error && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

/**
 * Texte modifiable en place (renommer une dépense, un nom) : brouillon local,
 * validé au blur ou à Entrée, Échap rétablit. Une saisie vide est refusée
 * (la valeur précédente revient).
 */
export function InlineTextField({
  id,
  label,
  labelVisible = false,
  value,
  onCommit,
  maxLength = 80,
  className,
  placeholder,
  appearance = 'inline',
}: {
  id: string;
  label: string;
  labelVisible?: boolean;
  value: string;
  onCommit: (value: string) => void;
  maxLength?: number;
  className?: string;
  placeholder?: string;
  appearance?: 'field' | 'inline' | 'large';
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const clean = draft.replace(/\s+/g, ' ').trim();
    if (clean !== '' && clean !== value) onCommit(clean);
    setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape' && draft !== null && draft !== value) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(value);
    }
  };

  return (
    <div className={cx('field', `field--${appearance}`, className)}>
      <label className={labelVisible ? 'field__label' : 'visually-hidden'} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        type="text"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={maxLength}
        placeholder={placeholder}
        value={draft ?? value}
        onFocus={() => setDraft(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
