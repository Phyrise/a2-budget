import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { cx } from './format';

/**
 * Section repliable (bouton aria-expanded + panneau). Animation de hauteur
 * par grille 0fr → 1fr ; panneau `inert` une fois replié.
 */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  variant = 'plain',
}: {
  summary: ReactNode;
  /** Texte discret à droite du titre (ex. « 3 »). */
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  variant?: 'plain' | 'card';
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const panelId = useId();
  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className={cx('disclosure', `disclosure--${variant}`, open && 'is-open', className)}>
      <button type="button" className="disclosure__toggle" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <span className="disclosure__summary">{summary}</span>
        {meta !== undefined && <span className="disclosure__meta">{meta}</span>}
        <Icon name="chevron-down" size={20} className="disclosure__chevron" />
      </button>
      <div className="disclosure__panel" id={panelId} inert={!open}>
        <div className="disclosure__inner">{children}</div>
      </div>
    </div>
  );
}
