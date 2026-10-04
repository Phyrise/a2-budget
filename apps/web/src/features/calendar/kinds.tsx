/**
 * Natures d'événement du Calendrier : libellé, couleur douce et petite icône
 * au trait (même grammaire que ui/Icon : grille 24 px, trait 1,6 px,
 * extrémités arrondies). Les icônes sont décoratives : le libellé est porté
 * par le contrôle ou le texte voisin.
 */
import type { CalendarEventKind } from '@a2/core';
import type { CSSProperties, ReactNode } from 'react';

export interface KindMeta {
  kind: CalendarEventKind;
  label: string;
  /** Couleur douce (pastilles, tuiles), lisible sur l'encre. */
  color: string;
}

/** Ordre d'affichage des chips (le plus courant d'abord). */
export const KINDS: readonly KindMeta[] = [
  { kind: 'repas', label: 'Repas', color: '#e9bb72' },
  { kind: 'sortie', label: 'Sortie', color: '#9cc58e' },
  { kind: 'anniversaire', label: 'Anniversaire', color: '#eba3b4' },
  { kind: 'rdv', label: 'Rendez-vous', color: '#a9c4ea' },
  { kind: 'voyage', label: 'Voyage', color: '#7fc8c0' },
  { kind: 'maison', label: 'Maison', color: '#cf9b78' },
  { kind: 'autre', label: 'Autre', color: '#b9c6bd' },
];

const BY_KIND = new Map(KINDS.map((k) => [k.kind, k]));

export function kindMeta(kind: CalendarEventKind): KindMeta {
  return BY_KIND.get(kind) ?? KINDS[KINDS.length - 1]!;
}

/** Variable CSS `--kind` posée sur un élément (pastille, tuile). */
export function kindStyle(kind: CalendarEventKind): CSSProperties {
  return { '--kind': kindMeta(kind).color } as CSSProperties;
}

const PATHS: Record<CalendarEventKind, ReactNode> = {
  // Assiette, fourchette et couteau.
  repas: (
    <>
      <circle cx="12" cy="12.6" r="5.4" />
      <circle cx="12" cy="12.6" r="2.6" />
      <path d="M3.6 4.6v4.2c0 .9.6 1.6 1.4 1.6s1.4-.7 1.4-1.6V4.6M5 10.4v9" />
      <path d="M19.6 19.4V4.8c-1.6.8-2.4 2.6-2.4 4.8v3.2h2.4" />
    </>
  ),
  // Billet de spectacle.
  sortie: (
    <>
      <path d="M4 7.4c0-.8.6-1.4 1.4-1.4h13.2c.8 0 1.4.6 1.4 1.4v2.2a2.4 2.4 0 0 0 0 4.8v2.2c0 .8-.6 1.4-1.4 1.4H5.4c-.8 0-1.4-.6-1.4-1.4v-2.2a2.4 2.4 0 0 0 0-4.8V7.4Z" />
      <path d="M14.6 6v2M14.6 11v2M14.6 16v2" />
    </>
  ),
  // Gâteau à bougie.
  anniversaire: (
    <>
      <path d="M5 20h14M6 20v-6.4c0-.9.7-1.6 1.6-1.6h8.8c.9 0 1.6.7 1.6 1.6V20" />
      <path d="M6 16.2c1 .9 2 .9 3 0s2-.9 3 0 2 .9 3 0 2-.9 3 0" />
      <path d="M12 12V9" />
      <path d="M12 6.6c-.8-.6-.9-1.7 0-2.8.9 1.1.8 2.2 0 2.8Z" />
    </>
  ),
  // Horloge.
  rdv: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 7.8V12l2.8 1.8" />
    </>
  ),
  // Valise.
  voyage: (
    <>
      <rect x="4.4" y="7.6" width="15.2" height="11.4" rx="2" />
      <path d="M9.2 7.6V5.8c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1v1.8" />
      <path d="M8.6 7.6V19M15.4 7.6V19" />
    </>
  ),
  // Petite maison au toit pentu.
  maison: (
    <>
      <path d="M4.4 11 12 4.8l7.6 6.2" />
      <path d="M6.4 9.6v8.6c0 .7.5 1.2 1.2 1.2h8.8c.7 0 1.2-.5 1.2-1.2V9.6" />
      <path d="M10.4 19.4v-4.2h3.2v4.2" />
    </>
  ),
  // Étoile douce à quatre branches.
  autre: (
    <path d="M12 4.6c.6 3.9 1.9 5.6 6.4 7.4-4.5 1.8-5.8 3.5-6.4 7.4-.6-3.9-1.9-5.6-6.4-7.4 4.5-1.8 5.8-3.5 6.4-7.4Z" />
  ),
};

export function KindIcon({ kind, size = 20, strokeWidth = 1.6 }: { kind: CalendarEventKind; size?: number; strokeWidth?: number }) {
  return (
    <svg
      className="icon cal-kind-icon"
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
      {PATHS[kind]}
    </svg>
  );
}

/** Tuile ronde teintée portant l'icône de la nature (listes d'événements). */
export function KindBadge({ kind, size = 40 }: { kind: CalendarEventKind; size?: number }) {
  return (
    <span className={`cal-kind-badge cal-kind-badge--${kind}`} style={{ ...kindStyle(kind), '--badge': `${size}px` } as CSSProperties} aria-hidden="true">
      <KindIcon kind={kind} size={Math.round(size * 0.52)} />
    </span>
  );
}
