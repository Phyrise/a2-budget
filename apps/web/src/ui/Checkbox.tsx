import { forwardRef, type MouseEvent } from 'react';
import { cx } from './format';

export type CheckTone = 'a' | 'b' | 'both' | 'unassigned' | 'neutral';

/**
 * Case ronde de 48 px (cercle visible de 30 px) avec coche dessinée
 * (stroke-dashoffset). Le clic transmet ses coordonnées d'écran — ou le
 * centre de la case au clavier — pour lancer la lumière depuis la case.
 */
export const Checkbox = forwardRef<
  HTMLButtonElement,
  {
    checked: boolean;
    label: string;
    onToggle: (origin: { x: number; y: number }) => void;
    tone?: CheckTone;
    className?: string;
    disabled?: boolean;
    size?: 'md' | 'sm';
  }
>(function Checkbox({ checked, label, onToggle, tone = 'neutral', className, disabled, size = 'md' }, ref) {
  const handle = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fromKeyboard = event.detail === 0;
    onToggle({
      x: fromKeyboard ? rect.left + rect.width / 2 : event.clientX,
      y: fromKeyboard ? rect.top + rect.height / 2 : event.clientY,
    });
  };
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handle}
      className={cx('check', `check--${tone}`, size === 'sm' && 'check--sm', checked && 'is-checked', className)}
    >
      <svg className="check__svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle className="check__ring" cx="16" cy="16" r="13.5" />
        <circle className="check__fill" cx="16" cy="16" r="13.5" />
        <path className="check__mark" d="M10.2 16.6l3.9 3.8 7.8-8.4" pathLength={1} />
      </svg>
    </button>
  );
});
