import type { ReactNode } from 'react';
import { KodamaArt } from './companionArt';
import { cx } from './format';

/** Feuille de cèdre stylisée (états vides des listes). */
function LeafArt() {
  return (
    <svg viewBox="0 0 64 64" className="empty__leaf" aria-hidden="true" focusable="false">
      <path d="M32 56V22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity={1 - i * 0.12}>
          <path d={`M32 ${50 - i * 7}c-5-1-9-4-11-9`} />
          <path d={`M32 ${50 - i * 7}c5-1 9-4 11-9`} />
        </g>
      ))}
      <path d="M32 22c-2-4-2-8 0-12 2 4 2 8 0 12Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/** État vide illustré : petit kodama ou feuille, titre, phrase, action. */
export function EmptyState({
  title,
  children,
  action,
  art = 'kodama',
  className,
  compact = false,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  art?: 'kodama' | 'leaf' | 'none';
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cx('empty', compact && 'empty--compact', className)}>
      {art !== 'none' && (
        <div className={cx('empty__art', `empty__art--${art}`)} aria-hidden="true">
          {art === 'kodama' ? <KodamaArt /> : <LeafArt />}
        </div>
      )}
      <p className="empty__title">{title}</p>
      {children && <div className="empty__text">{children}</div>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
