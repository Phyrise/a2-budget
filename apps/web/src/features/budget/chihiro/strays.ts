/**
 * Noiraudes vagabondes (V4.2) : règles pures du petit jeu de l'écran Budget
 * (rythme des apparitions, perchoir au bord d'un bloc, loin de tout contrôle)
 * et compteur « Noiraudes attrapées », sous une clé dédiée
 * `a2-budget:susuwatari:v1` (jamais dans l'AppState ; `a2-budget:ui:v1`
 * appartient à la coquille). Lecture / écriture protégées.
 */

/** Pas d'apparition pendant les premières secondes à l'écran. */
export const WARMUP_MS = 20_000;
/** Une apparition « au défilement » attend au moins ceci depuis la précédente. */
export const SCROLL_GAP_MS = 18_000;
/** Taille de la Noiraude à l'écran (px). */
export const STRAY_SIZE = { w: 34, h: 46 } as const;

/** Prochaine apparition : 25–60 s ; plus rare quand tout est immobile (60–120 s). */
export function nextDelayMs(calm: boolean, rand: () => number): number {
  const [min, max] = calm ? [60_000, 120_000] : [25_000, 60_000];
  return min + rand() * (max - min);
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Perchoir (coordonnées de la fenêtre) : coin haut-gauche de la Noiraude et trot horizontal. */
export interface Perch {
  x: number;
  y: number;
  dx: number;
}

function overlaps(a: Box, b: Box, margin: number): boolean {
  return a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
}

/**
 * Choisit où la Noiraude se pose : sur le bord haut d'un bloc visible (carte,
 * section), son trot compris, sans jamais chevaucher un contrôle (`obstacles`
 * élargis de 10 px) ni sortir de la zone visible `view` (sous le bandeau,
 * au-dessus de la navigation). `null` si aucune place ne convient.
 */
export function pickPerch(blocks: readonly Box[], obstacles: readonly Box[], view: Box, rand: () => number, trot = 56): Perch | null {
  const { w, h } = STRAY_SIZE;
  const order = blocks.map((b) => ({ b, k: rand() })).sort((p, q) => p.k - q.k);
  for (const { b } of order) {
    const y = b.top - h + 6;
    if (y < view.top || b.top + 8 > view.bottom) continue;
    const left = Math.max(b.left, view.left) + 12;
    const right = Math.min(b.right, view.right) - 12;
    if (right - left < w + trot) continue;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const dx = rand() < 0.5 ? trot : -trot;
      const span = right - left - w - trot;
      const x = left + (dx < 0 ? trot : 0) + rand() * span;
      const area = { left: Math.min(x, x + dx), right: Math.max(x, x + dx) + w, top: y, bottom: y + h };
      if (!obstacles.some((o) => overlaps(area, o, 10))) return { x, y, dx };
    }
  }
  return null;
}

const KEY = 'a2-budget:susuwatari:v1';

export function readCaught(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    const value = raw === null ? null : (JSON.parse(raw) as { caught?: unknown } | null);
    const caught = value?.caught;
    return typeof caught === 'number' && Number.isInteger(caught) && caught > 0 ? caught : 0;
  } catch {
    return 0;
  }
}

export function writeCaught(caught: number): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ caught }));
  } catch {
    // Stockage indisponible : le compteur vaut pour cette session.
  }
}
