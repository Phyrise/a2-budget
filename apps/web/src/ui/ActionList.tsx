/**
 * Liste d'actions d'une feuille d'actions (menu ⋯) : un groupe nommé de
 * grands boutons (≥ 56 px) avec illustration, libellé et indication.
 * À placer dans une <Sheet size="auto"> : focus piégé, Échap, retour au
 * bouton d'origine sont gérés par la feuille.
 */
import { forwardRef, type ReactNode } from 'react';
import { cx } from './format';
import './actionList.css';

export function ActionList({
  label,
  labelVisible = false,
  children,
  className,
}: {
  label: string;
  labelVisible?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx('action-list', className)}>
      {labelVisible && (
        <p className="action-list__label" aria-hidden="true">
          {label}
        </p>
      )}
      <div className="action-list__items">{children}</div>
    </div>
  );
}

export const ActionItem = forwardRef<
  HTMLButtonElement,
  {
    icon?: ReactNode;
    label: ReactNode;
    hint?: ReactNode;
    onClick: () => void;
    tone?: 'neutral' | 'a' | 'b' | 'both' | 'soft';
    /** Libellé accessible complet si le libellé visible est elliptique. */
    ariaLabel?: string;
    className?: string;
  }
>(function ActionItem({ icon, label, hint, onClick, tone = 'neutral', ariaLabel, className }, ref) {
  return (
    <button ref={ref} type="button" className={cx('action-item', `action-item--${tone}`, className)} onClick={onClick} aria-label={ariaLabel}>
      {icon && (
        <span className="action-item__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="action-item__text">
        <span className="action-item__label">{label}</span>
        {hint && <span className="action-item__hint">{hint}</span>}
      </span>
    </button>
  );
});
