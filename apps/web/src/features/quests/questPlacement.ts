/**
 * V5.3 — où la quête se pose DANS la scène de l'onglet (pur, testé).
 *
 * Chaque onglet a trois emplacements (le `spot` 0..2 du modèle, déterministe),
 * chacun une liste de « perchoirs » par ordre de préférence : un repère de la
 * scène (sélecteur), un de ses bords (haut ou bas), un côté de départ. On glisse
 * le long du bord jusqu'à une place libre : jamais sur un bouton, un champ, un
 * montant ou du texte, et assez haut pour se voir sans long défilement. Aucun
 * perchoir libre : repli sûr sur le bord haut de la feuille (ancienne place).
 */
import type { QuestTab } from '@a2/core';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Perch {
  /** Repère dans la feuille (le premier trouvé et visible). */
  sel: string;
  edge: 'top' | 'bottom';
  /** start : depuis la gauche ; end : depuis la droite ; after : juste à droite du repère. */
  align: 'start' | 'end' | 'after';
  /** Décalage depuis le côté de départ (px). */
  inset?: number;
  /** Part de l'objet sous la ligne du bord (0 : posé dessus ; 1 : pendu dessous). */
  sink?: number;
}

export interface Place {
  x: number;
  y: number;
  /** Index du perchoir retenu (-1 : repli sur le bord de la feuille). */
  perch: number;
}

/** Taille de l'objet (px), comme quests.css. */
export const QUEST_SIZE = { w: 60, h: 48 } as const;
/** Pas de glissement le long d'un bord (px). */
const STEP = 6;
/** Visible sans long défilement : bas de l'objet sous ce multiple de la hauteur d'écran. */
export const MAX_SCROLL_SCREENS = 1.3;

/**
 * Les perchoirs, par onglet puis par emplacement. Budget (Chihiro) : le
 * rocher sur le chemin des Noiraudes, près du bocal ; au pied d'une carte ;
 * au bord du carnet des virements. Courses (Kiki) : le colis tombé du balai
 * dans la scène de Kiki ; entre deux rayons ; derrière l'en-tête d'une
 * catégorie. Calendrier (Totoro) : la pousse à côté de Totoro endormi ; au
 * bord du jour ; au bord de « À venir ».
 */
export const PERCHES: Record<QuestTab, readonly (readonly Perch[])[]> = {
  budget: [
    [
      { sel: '.budget-income .section-head', edge: 'bottom', align: 'end', inset: 56, sink: 0.1 },
      { sel: '.balance-card', edge: 'bottom', align: 'end', sink: 0.6 },
    ],
    [
      { sel: '.person-card--a', edge: 'bottom', align: 'end', inset: 10, sink: 0.25 },
      { sel: '.person-card--b', edge: 'bottom', align: 'end', inset: 10, sink: 0.25 },
      { sel: '.budget-income .section-head', edge: 'bottom', align: 'end', inset: 56, sink: 0.1 },
    ],
    [
      { sel: '.paybook', edge: 'top', align: 'start', inset: 8, sink: 0.2 },
      { sel: '.person-card--b', edge: 'bottom', align: 'end', inset: 10, sink: 0.25 },
      { sel: '.budget-income .section-head', edge: 'bottom', align: 'end', inset: 56, sink: 0.1 },
    ],
  ],
  courses: [
    [
      { sel: '.kiki-empty__art', edge: 'bottom', align: 'end', inset: 8, sink: 0 },
      { sel: '.kiki-done', edge: 'bottom', align: 'end', inset: 8, sink: 0 },
      { sel: '.basket-stage', edge: 'bottom', align: 'start', inset: 0, sink: 0 },
      { sel: '.aisle__title', edge: 'bottom', align: 'end', inset: 22, sink: 0 },
    ],
    [
      { sel: '.aisle:nth-child(2) .aisle__title', edge: 'bottom', align: 'end', inset: 22, sink: 0 },
      { sel: '.aisle__title', edge: 'bottom', align: 'end', inset: 22, sink: 0 },
      { sel: '.kiki-empty__art', edge: 'bottom', align: 'start', inset: 0, sink: 0 },
      { sel: '.kiki-done', edge: 'bottom', align: 'end', inset: 8, sink: 0 },
    ],
    [
      { sel: '.aisle__title', edge: 'bottom', align: 'start', inset: 40, sink: 0 },
      { sel: '.kiki-empty__art', edge: 'bottom', align: 'end', inset: 8, sink: 0 },
      { sel: '.kiki-done', edge: 'bottom', align: 'end', inset: 8, sink: 0 },
      { sel: '.basket-stage', edge: 'bottom', align: 'start', inset: 0, sink: 0 },
    ],
  ],
  calendar: [
    [
      { sel: '.cal-totoro', edge: 'bottom', align: 'after', inset: 2, sink: 0 },
      { sel: '.cal-day-panel .section-head', edge: 'bottom', align: 'end', inset: 52, sink: 0.08 },
    ],
    [
      { sel: '.cal-day-panel .section-head', edge: 'bottom', align: 'end', inset: 52, sink: 0.08 },
      { sel: '.cal-upcoming-section .section-head', edge: 'bottom', align: 'end', inset: 4, sink: 0.08 },
    ],
    [
      { sel: '.cal-upcoming-section .section-head', edge: 'bottom', align: 'end', inset: 4, sink: 0.08 },
      { sel: '.cal-day-panel .section-head', edge: 'bottom', align: 'end', inset: 52, sink: 0.08 },
    ],
  ],
};

/** Repli : sur le bord haut de la feuille, comme avant (x selon l'emplacement). */
export function fallbackPlace(spot: number, sheetW: number, gutter = 16): Place {
  const { w, h } = QUEST_SIZE;
  const x = spot === 1 ? sheetW * 0.66 - w : spot === 2 ? gutter + 28 : sheetW - gutter - 4 - w;
  return { x: Math.round(x), y: -Math.round(h * 0.66), perch: -1 };
}

export function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

/** Positions candidates le long d'un perchoir, dans l'ordre d'essai. */
export function slide(anchor: Rect, p: Perch, bounds: { left: number; right: number }): Rect[] {
  const { w, h } = QUEST_SIZE;
  const sink = p.sink ?? 0;
  const line = p.edge === 'top' ? anchor.y : anchor.y + anchor.h;
  const y = line - h * (1 - sink);
  const inset = p.inset ?? 0;
  const min = Math.max(bounds.left, p.align === 'after' ? anchor.x + anchor.w + inset : anchor.x - w * 0.2);
  const max = Math.min(bounds.right - w, p.align === 'after' ? bounds.right - w : anchor.x + anchor.w - w * 0.8);
  const out: Rect[] = [];
  if (max < min) return out;
  if (p.align === 'end') {
    for (let x = Math.min(max, anchor.x + anchor.w - inset - w); x >= min; x -= STEP) out.push({ x, y, w, h });
  } else {
    const from = p.align === 'start' ? anchor.x + inset : min;
    for (let x = Math.max(min, from); x <= max; x += STEP) out.push({ x, y, w, h });
  }
  return out;
}

/**
 * Première place libre. `anchors[i]` : le rectangle du repère du perchoir i
 * (null s'il est absent ou masqué) ; toutes les mesures dans le même repère.
 */
export function findPlace(
  perches: readonly Perch[],
  anchors: readonly (Rect | null)[],
  avoid: readonly Rect[],
  bounds: { left: number; right: number; top: number; bottom: number },
): Place | null {
  for (let i = 0; i < perches.length; i++) {
    const a = anchors[i];
    if (a === null || a === undefined || a.w <= 0 || a.h <= 0) continue;
    for (const r of slide(a, perches[i]!, bounds)) {
      if (r.y < bounds.top || r.y + r.h > bounds.bottom) break;
      if (!avoid.some((b) => overlaps(r, b, 2))) return { x: Math.round(r.x), y: Math.round(r.y), perch: i };
    }
  }
  return null;
}
