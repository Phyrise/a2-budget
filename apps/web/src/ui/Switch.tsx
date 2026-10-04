/**
 * Interrupteur (role="switch") avec libellé et description facultative.
 * Toute la ligne est cliquable (zone tactile ≥ 44 px) ; Espace / Entrée
 * basculent (bouton natif).
 */
import { useId, type ReactNode } from 'react';
import { cx } from './format';
import './switch.css';

export function Switch({
  checked,
  onChange,
  label,
  description,
  icon,
  disabled,
  className,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  /** Illustration à gauche du libellé (décorative). */
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const auto = useId();
  const labelId = `${id ?? auto}-label`;
  const descId = `${id ?? auto}-desc`;
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('switch-row', checked && 'is-on', className)}
    >
      {icon && (
        <span className="switch-row__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="switch-row__text">
        <span id={labelId} className="switch-row__label">
          {label}
        </span>
        {description && (
          <span id={descId} className="switch-row__desc">
            {description}
          </span>
        )}
      </span>
      <span className="switch" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
    </button>
  );
}
