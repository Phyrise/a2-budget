/**
 * Règles pures des Noiraudes d'un écran (V4.2, reprises par les Noiraudes
 * dessinées par le code) : rythme des apparitions, perchoir au bord d'un
 * bloc loin de tout contrôle, bande du bas (au-dessus de la navigation) et
 * raretés jamais annoncées.
 */

/** Pas d'apparition pendant les premières secondes à l'écran. */
export const WARMUP_MS = 20_000;
/** Une apparition « au défilement » attend au moins ceci depuis la précédente. */
export const SCROLL_GAP_MS = 18_000;
/** Place d'une Noiraude perchée (px) : boule et pattes. */
export const STRAY_SIZE = { w: 34, h: 46 } as const;

/** Prochaine apparition : 25–60 s ; plus rare quand tout est immobile (60–120 s). */
export function nextDelayMs(calm: boolean, rand: () => number): number {
  const [min, max] = calm ? [60_000, 120_000] : [25_000, 60_000];
  return min + rand() * (max - min);
}

/** Onglet où une Noiraude « se trompe » : rare (45–120 s, une chance sur huit). */
export function wrongTabDelayMs(rand: () => number): number {
  return 45_000 + rand() * 75_000;
}
export const WRONG_TAB_CHANCE = 0.125;

/**
 * Rareté d'une apparition : la dorée (≈ 1 sur 60), la procession
 * (≈ 1 sur 25, jamais au calme), sinon une Noiraude ordinaire.
 */
export function rollRarity(calm: boolean, rand: () => number): 'golden' | 'procession' | null {
  const r = rand();
  if (r < 1 / 60) return 'golden';
  if (!calm && r < 1 / 60 + 1 / 25) return 'procession';
  return null;
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

/**
 * Bande du bas, où passent la procession et la Noiraude qui traverse : le
 * haut de la navigation quand elle est une pilule en bas de l'écran (elles
 * y marchent dessus), sinon le bas de la fenêtre. `left` / `right` : la
 * feuille de l'écran, bornée à la fenêtre.
 */
export function laneOf(dock: Box | null, sheet: Box | null, width: number, height: number): { y: number; left: number; right: number } {
  const atBottom = dock !== null && dock.top > height * 0.6 && dock.right - dock.left > width * 0.5;
  const y = atBottom ? dock.top + 2 : height - 14;
  const left = Math.max(0, sheet?.left ?? 0);
  const right = Math.min(width, sheet?.right ?? width);
  return right - left > 120 ? { y, left, right } : { y, left: 0, right: width };
}
