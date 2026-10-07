/**
 * Natures d'événement du Calendrier : libellé, couleur douce et icône.
 * V4 (univers Totoro) : icônes peintes de `calendarTheme.kinds` (bento,
 * gland noué dans une feuille, Chatbus…) dans la grille, les listes et la
 * feuille ; l'icône au trait (même grammaire que ui/Icon) reste en repli
 * si une peinture manquait. Toujours décoratives : le libellé est porté par
 * le contrôle ou le texte voisin.
 *
 * V4.2 : cinq natures (voyage fusionné dans « Sortie », maison retirée) ; un
 * ancien événement s'affiche sous sa nature actuelle (`activeCalendarKind`).
 */
import { activeCalendarKind, type ActiveCalendarKind, type CalendarEventKind } from '@a2/core';
import type { CSSProperties, ReactNode } from 'react';
import { calendarTheme } from '../../themes/manifest';

export interface KindMeta {
  kind: ActiveCalendarKind;
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
  { kind: 'autre', label: 'Autre', color: '#b9c6bd' },
];

const BY_KIND = new Map(KINDS.map((k) => [k.kind, k]));

export function kindMeta(kind: CalendarEventKind): KindMeta {
  return BY_KIND.get(activeCalendarKind(kind)) ?? KINDS[KINDS.length - 1]!;
}

/** Variable CSS `--kind` posée sur un élément (pastille, tuile). */
export function kindStyle(kind: CalendarEventKind): CSSProperties {
  return { '--kind': kindMeta(kind).color } as CSSProperties;
}

const PATHS: Record<ActiveCalendarKind, ReactNode> = {
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
      {PATHS[activeCalendarKind(kind)]}
    </svg>
  );
}

/** Icône peinte de la nature (repli : icône au trait). */
export function KindArt({ kind, size = 20, className }: { kind: CalendarEventKind; size?: number; className?: string }) {
  const src = calendarTheme.kinds[activeCalendarKind(kind)];
  if (!src) return <KindIcon kind={kind} size={size} />;
  return (
    <img
      className={className ? `cal-kind-art ${className}` : 'cal-kind-art'}
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      aria-hidden="true"
    />
  );
}

/**
 * Tuile teintée portant l'icône peinte de la nature (listes d'événements).
 * Anniversaire : Totoro tend son paquet-feuille, à la place de l'icône.
 */
export function KindBadge({ kind, size = 40 }: { kind: CalendarEventKind; size?: number }) {
  const active = activeCalendarKind(kind);
  const gift = active === 'anniversaire' ? calendarTheme.totoro.gift : '';
  return (
    <span
      className={`cal-kind-badge cal-kind-badge--${active}${gift ? ' cal-kind-badge--gift' : ''}`}
      style={{ ...kindStyle(kind), '--badge': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {gift ? (
        <img className="cal-kind-badge__gift" src={gift} alt="" decoding="async" draggable={false} />
      ) : (
        <KindArt kind={active} size={Math.round(size * 0.8)} />
      )}
    </span>
  );
}
