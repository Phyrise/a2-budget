/**
 * Jeu d'icônes maison : trait 1,6 px, extrémités arrondies, grille 24 px.
 * Toujours décoratives (aria-hidden) : le libellé est porté par le contrôle.
 */
import type { ReactNode } from 'react';

const PATHS = {
  home: (
    <>
      <path d="M3.8 10.6 12 4l8.2 6.6" />
      <path d="M6 9.2V18.6c0 .8.6 1.4 1.4 1.4H10v-4.6c0-.6.4-1 1-1h2c.6 0 1 .4 1 1V20h2.6c.8 0 1.4-.6 1.4-1.4V9.2" />
    </>
  ),
  budget: (
    <>
      <ellipse cx="12" cy="6.6" rx="6.6" ry="2.6" />
      <path d="M5.4 6.6v5.2c0 1.4 3 2.6 6.6 2.6s6.6-1.2 6.6-2.6V6.6" />
      <path d="M5.4 11.8V17c0 1.4 3 2.6 6.6 2.6s6.6-1.2 6.6-2.6v-5.2" />
    </>
  ),
  basket: (
    <>
      <path d="M3.6 9.6h16.8l-1.7 8.6a2 2 0 0 1-2 1.6H7.3a2 2 0 0 1-2-1.6L3.6 9.6Z" />
      <path d="M8.2 9.6 11 4.4M15.8 9.6 13 4.4" />
      <path d="M9.4 13v3.4M14.6 13v3.4" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4.6v3.8h3.8" />
      <path d="M12 8v4.3l2.9 1.8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7.5h8.6M17.4 7.5H20" />
      <circle cx="15" cy="7.5" r="2.4" />
      <path d="M4 16.5h2.6M11.4 16.5H20" />
      <circle cx="9" cy="16.5" r="2.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.6l4.3 4.2L19 7.2" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  'chevron-left': <path d="M14.5 5.5 8 12l6.5 6.5" />,
  'chevron-right': <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  trash: (
    <>
      <path d="M4.8 7h14.4M10 4h4" />
      <path d="M6.8 7l.8 11.3A1.9 1.9 0 0 0 9.5 20h5a1.9 1.9 0 0 0 1.9-1.7L17.2 7" />
      <path d="M10.3 11v5M13.7 11v5" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h3.8L18.6 9.2a2.1 2.1 0 0 0-3-3L5.3 16.5l-.8 3Z" />
      <path d="M13.8 8l3 3" />
    </>
  ),
  moon: <path d="M19.2 14.6A7.6 7.6 0 0 1 9.4 4.8a7.6 7.6 0 1 0 9.8 9.8Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.2v1.9M12 18.9v1.9M3.2 12h1.9M18.9 12h1.9M5.8 5.8l1.3 1.3M16.9 16.9l1.3 1.3M5.8 18.2l1.3-1.3M16.9 7.1l1.3-1.3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10.6M7.6 10.4 12 14.8l4.4-4.4" />
      <path d="M5 19.4h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4.4M7.6 8.8 12 4.4l4.4 4.4" />
      <path d="M5 19.4h14" />
    </>
  ),
  undo: (
    <>
      <path d="M9.4 6.4 5 10.8l4.4 4.4" />
      <path d="M5.4 10.8h9.1a4.6 4.6 0 0 1 0 9.2h-2.8" />
    </>
  ),
  leaf: (
    <>
      <path d="M5.2 18.8C5 10.6 10 5.6 19 5c-.4 9-5.4 14-13.8 13.8Z" />
      <path d="M5.2 18.8 12.6 11.4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.6 3.2 19.4h17.6L12 4.6Z" />
      <path d="M12 10.2v4.2" />
      <circle cx="12" cy="16.9" r=".6" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="7.9" r=".6" fill="currentColor" />
    </>
  ),
  sparkle: <path d="M12 3.8c.7 4.1 2.2 5.6 6.2 6.2-4 .7-5.5 2.2-6.2 6.2-.7-4-2.2-5.5-6.2-6.2 4-.6 5.5-2.1 6.2-6.2Z" />,
  repeat: (
    <>
      <path d="M16.6 3.8l2.9 2.9-2.9 2.9" />
      <path d="M4.5 11.4v-.9a3.8 3.8 0 0 1 3.8-3.8h11.2" />
      <path d="M7.4 20.2l-2.9-2.9 2.9-2.9" />
      <path d="M19.5 12.6v.9a3.8 3.8 0 0 1-3.8 3.8H4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.6" width="16" height="14.4" rx="2.4" />
      <path d="M4 10h16M8.4 3.6v3.6M15.6 3.6v3.6" />
    </>
  ),
  today: (
    <>
      <rect x="4" y="5.6" width="16" height="14.4" rx="2.4" />
      <path d="M4 10h16M8.4 3.6v3.6M15.6 3.6v3.6" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.6 11.2A7.6 7.6 0 1 0 17.4 17" />
      <path d="M19.8 4.8v6.4h-6.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.6" r="3.6" />
      <path d="M5 19.6c.9-3.4 3.7-5.2 7-5.2s6.1 1.8 7 5.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.4 19c.8-3 3-4.6 5.6-4.6s4.8 1.6 5.6 4.6" />
      <path d="M15.4 6a3 3 0 0 1 0 6M17.4 14.6c1.6.5 2.8 2 3.2 4.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.8 5.4 6.4v5.2c0 4.1 2.8 7.4 6.6 8.6 3.8-1.2 6.6-4.5 6.6-8.6V6.4L12 3.8Z" />
      <path d="M9.2 12.2l2 2 3.8-3.9" />
    </>
  ),
  wind: (
    <>
      <path d="M3.6 9h10.6a2.6 2.6 0 1 0-2.6-2.6" />
      <path d="M3.6 13.2h14.6a2.8 2.8 0 1 1-2.8 2.8" />
      <path d="M3.6 17.2h6" />
    </>
  ),
  feather: (
    <>
      <path d="M19.4 4.6c-6.6.4-11.4 4.4-12.6 12.4l-.4 2.4" />
      <path d="M19.4 4.6c.2 7-3.4 11.4-11.6 12.6M9.6 14l5-5" />
    </>
  ),
  tag: (
    <>
      <path d="M4 12.4V5.6c0-.9.7-1.6 1.6-1.6h6.8l7.4 7.4a1.6 1.6 0 0 1 0 2.3l-6.5 6.5a1.6 1.6 0 0 1-2.3 0L4 12.4Z" />
      <circle cx="8.6" cy="8.6" r="1.3" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  cloud: <path d="M7.4 18.4h9.4a3.8 3.8 0 0 0 .5-7.6 5.4 5.4 0 0 0-10.4 1.2 3.2 3.2 0 0 0 .5 6.4Z" />,
  'cloud-off': (
    <>
      <path d="M9 6.8a5.4 5.4 0 0 1 8.3 4 3.8 3.8 0 0 1 2.3 6.4M16.4 18.4h-9a3.2 3.2 0 0 1-.5-6.4 5.4 5.4 0 0 1 .5-2" />
      <path d="M4.6 4.6l14.8 14.8" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.6,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
