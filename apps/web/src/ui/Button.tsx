import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './format';

export type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger' | 'danger-ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm' | 'lg';
  icon?: IconName;
  /** Icône après le libellé (ex. chevron). */
  iconEnd?: IconName;
  block?: boolean;
  children?: ReactNode;
}

/** Bouton texte (classes de base `.btn`, `.btn--primary`, `.btn--ghost`…). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'quiet', size = 'md', icon, iconEnd, block = false, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children !== undefined && <span className="btn__label">{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={size === 'sm' ? 18 : 20} />}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Libellé accessible (obligatoire : le bouton n'a pas de texte visible). */
  label: string;
  variant?: 'soft' | 'ghost' | 'glass' | 'accent' | 'danger';
  size?: 'md' | 'sm' | 'lg';
  /** Badge discret (ex. point de notification). */
  dot?: boolean;
}

/** Bouton rond à icône seule (zone tactile ≥ 44 px). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'soft', size = 'md', dot = false, className, type = 'button', title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx('icon-btn', `icon-btn--${variant}`, size !== 'md' && `icon-btn--${size}`, className)}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 18 : size === 'lg' ? 24 : 22} />
      {dot && <span className="icon-btn__dot" aria-hidden="true" />}
    </button>
  );
});
