/**
 * Petit lampion chōchin dessiné en SVG (anniversaire du couple) : corps de
 * papier rouge braise à côtes, chapeau et pied laqués, lueur chaude. Sert de
 * marque discrète au calendrier (le 19 de chaque mois) et dans les Réglages.
 * Toujours décoratif (aria-hidden) : le libellé est porté par le parent.
 */
import { useId } from 'react';

export function Lampion({ size = 14, className }: { size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const body = `lampion-body-${id}`;
  const glow = `lampion-glow-${id}`;
  return (
    <svg
      className={className ? `lampion ${className}` : 'lampion'}
      width={size * 0.8}
      height={size}
      viewBox="0 0 16 20"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glow} cx="50%" cy="52%" r="50%">
          <stop offset="0%" stopColor="#ffb469" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={body} cx="46%" cy="44%" r="62%">
          <stop offset="0%" stopColor="#ffd7a0" />
          <stop offset="38%" stopColor="#f2793f" />
          <stop offset="100%" stopColor="#b8322a" />
        </radialGradient>
      </defs>
      <ellipse cx="8" cy="10.4" rx="8" ry="8.6" fill={`url(#${glow})`} />
      <path d="M8 0.6v2" stroke="#3a2a22" strokeWidth="1" strokeLinecap="round" />
      <rect x="5" y="2.4" width="6" height="1.9" rx="0.7" fill="#2b1d1a" />
      <ellipse cx="8" cy="10" rx="5.6" ry="5.9" fill={`url(#${body})`} />
      <g stroke="#9d2a22" strokeOpacity="0.45" strokeWidth="0.55" fill="none">
        <path d="M2.8 7.6q5.2 -1.2 10.4 0" />
        <path d="M2.4 10q5.6 -0.9 11.2 0" />
        <path d="M2.8 12.4q5.2 1.2 10.4 0" />
      </g>
      <rect x="5" y="15.6" width="6" height="1.9" rx="0.7" fill="#2b1d1a" />
      <path d="M8 17.5v1.9" stroke="#e8b04c" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
