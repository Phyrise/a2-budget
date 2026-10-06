/**
 * Dessins au trait des sept lanternes de pierre (tōrō), en attendant les
 * peintures (themes/lanterns.ts). Repère : viewBox 0 0 120 160, sol à
 * y ≈ 150, lanterne centrée sur x = 60. Chaque modèle est une liste de
 * formes : le corps de pierre (dans l'ordre de dessin), les fenêtres de la
 * chambre à feu (qui s'allument), la mousse, les détails gravés et quelques
 * accents colorés (neige, corde sacrée, visages de kodama).
 */

export interface ToroShape {
  /** Corps de pierre, du socle au sommet (remplis, cernés). */
  body: string[];
  /** Ouvertures de la chambre à feu (sombres, ou allumées). */
  windows: string[];
  /** Taches de mousse / lichen : [cx, cy, rx, ry]. */
  moss: Array<[number, number, number, number]>;
  /** Détails gravés (trait seul). */
  carve: string[];
  /** Accents colorés : `tone` = neige, corde, papier, sombre (yeux), eau. */
  accents: Array<{ d: string; tone: 'snow' | 'rope' | 'paper' | 'dark' | 'water' }>;
  /** Centre et rayon de la lumière quand la lanterne est allumée. */
  glow: [number, number, number];
  /** Lumière d'esprit (vert d'eau) au lieu de l'ambre. */
  spirit?: boolean;
  /** Petites lueurs flottantes : [x, y, r]. */
  orbs?: Array<[number, number, number]>;
}

const f = (n: number) => Math.round(n * 10) / 10;

export function rect(x1: number, y1: number, x2: number, y2: number): string {
  return `M${f(x1)} ${f(y1)}H${f(x2)}V${f(y2)}H${f(x1)}Z`;
}

export function poly(...pts: number[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${f(pts[i]!)} ${f(pts[i + 1]!)}`;
  return `${d}Z`;
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx): string {
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
}

/** Toit aux coins relevés (concave), du faîte `yt` au bord `yb`. */
export function roof(cx: number, yt: number, yb: number, hw: number, ht: number, curl: number): string {
  const h = yb - yt;
  const cxr = cx + ht + (hw - ht) * 0.3;
  const cxl = cx - ht - (hw - ht) * 0.3;
  const cy = yb - h * 0.28;
  return [
    `M${f(cx - hw)} ${f(yb - curl)}`,
    `Q${f(cx - hw + 2)} ${f(yb)} ${f(cx - hw + 9)} ${f(yb)}`,
    `L${f(cx + hw - 9)} ${f(yb)}`,
    `Q${f(cx + hw - 2)} ${f(yb)} ${f(cx + hw)} ${f(yb - curl)}`,
    `Q${f(cxr)} ${f(cy)} ${f(cx + ht)} ${f(yt)}`,
    `L${f(cx - ht)} ${f(yt)}`,
    `Q${f(cxl)} ${f(cy)} ${f(cx - hw)} ${f(yb - curl)}Z`,
  ].join('');
}

/** Joyau du sommet (hōju) posé sur le faîte `yt`, haut de `h`. */
export function finial(cx: number, yt: number, h = 12): string {
  const top = yt - h;
  return `M${f(cx)} ${f(top)}C${f(cx + 5)} ${f(top + h * 0.35)} ${f(cx + 6.5)} ${f(yt - 5)} ${f(cx + 3.5)} ${f(yt - 3)}H${f(cx + 5)}V${f(yt)}H${f(cx - 5)}V${f(yt - 3)}H${f(cx - 3.5)}C${f(cx - 6.5)} ${f(yt - 5)} ${f(cx - 5)} ${f(top + h * 0.35)} ${f(cx)} ${f(top)}Z`;
}

/** Pétales de lotus gravés le long d'un bord (de x1 à x2, à y). */
function lotus(x1: number, x2: number, y: number, n: number, depth = 4): string {
  const w = (x2 - x1) / n;
  let d = `M${f(x1)} ${f(y)}`;
  for (let i = 0; i < n; i++) d += `q${f(w / 2)} ${f(depth)} ${f(w)} 0`;
  return d;
}

/** Un kodama (tête ronde, corps en goutte) : corps + visage. */
function kodama(cx: number, cy: number, s = 1): { body: string; face: string[] } {
  const body = `${ellipse(cx, cy, 7 * s, 6 * s)}M${f(cx - 5 * s)} ${f(cy + 14 * s)}Q${f(cx - 6 * s)} ${f(cy + 6 * s)} ${f(cx)} ${f(cy + 5 * s)}Q${f(cx + 6 * s)} ${f(cy + 6 * s)} ${f(cx + 5 * s)} ${f(cy + 14 * s)}Z`;
  const face = [ellipse(cx - 2.6 * s, cy - 0.6 * s, 1.2 * s, 1.4 * s), ellipse(cx + 2.8 * s, cy - 0.8 * s, 1 * s, 1.2 * s), ellipse(cx + 0.4 * s, cy + 2.8 * s, 0.8 * s, 0.9 * s)];
  return { body, face };
}

const spiritKodama = kodama(60, 20);
const peekKodama = kodama(92, 136, 0.7);

export const TORO: Record<string, ToroShape> = {
  'kasuga-moss': {
    body: [
      rect(32, 140, 88, 148),
      poly(46, 128, 74, 128, 84, 140, 36, 140),
      rect(53, 91, 67, 128),
      rect(50, 106, 70, 111),
      rect(34, 88, 86, 91),
      poly(42, 80, 78, 80, 86, 88, 34, 88),
      poly(40, 51, 80, 51, 78, 80, 42, 80),
      rect(26, 48, 94, 51),
      roof(60, 30, 48, 40, 8, 6),
      finial(60, 30, 13),
    ],
    windows: [rect(50, 57, 70, 74), ellipse(45, 65, 2.6), 'M73.5 62a3.2 3.2 0 1 0 0 6.4a2.3 2.3 0 1 1 0-6.4Z'],
    moss: [[44, 41, 11, 3.6], [72, 44, 6, 2], [80, 86, 6, 2.2], [42, 145, 9, 3], [70, 139, 7, 2.2]],
    carve: ['M60 57V74', lotus(37, 83, 140, 6, 3.5), 'M54 100h12'],
    accents: [],
    glow: [60, 65, 34],
  },
  yukimi: {
    body: [
      'M56 113L54 142H66L64 113Z',
      'M38 113Q30 128 21 146H30Q36 130 46 113Z',
      'M82 113Q90 128 99 146H90Q84 130 74 113Z',
      rect(34, 110, 86, 113),
      poly(46, 104, 74, 104, 84, 110, 36, 110),
      poly(44, 82, 76, 82, 74, 104, 46, 104),
      rect(14, 78, 106, 81),
      roof(60, 58, 78, 54, 10, 7),
      finial(60, 58, 12),
    ],
    windows: [ellipse(60, 93, 7), rect(47.5, 88, 50, 99), rect(70, 88, 72.5, 99)],
    moss: [[30, 76, 7, 2], [88, 75, 6, 2], [58, 140, 6, 2]],
    carve: ['M60 86V100', lotus(38, 82, 110, 5, 3)],
    accents: [
      { d: 'M17 73Q38 61 50 58H70Q82 61 103 73Q82 67 60 67Q38 67 17 73Z', tone: 'snow' },
      { d: 'M8 151Q24 147 40 151T72 151T112 151V156H8Z', tone: 'water' },
    ],
    glow: [60, 93, 30],
  },
  oribe: {
    body: [
      'M52 82H68V88Q78 90 78 96Q78 102 68 102V150H52V102Q42 102 42 96Q42 90 52 88Z',
      poly(42, 74, 78, 74, 74, 82, 46, 82),
      poly(44, 47, 76, 47, 76, 74, 44, 74),
      rect(32, 44, 88, 47),
      roof(60, 30, 44, 30, 8, 3),
      finial(60, 30, 12),
    ],
    windows: [ellipse(52, 60, 5), 'M69 54a6.5 6.5 0 1 0 0 13a4.8 4.8 0 1 1 0-13Z'],
    moss: [[70, 38, 8, 2.6], [60, 148, 10, 2.6], [46, 96, 3, 1.6]],
    carve: ['M54 142V121Q60 112 66 121V142', 'M57.2 125a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0', 'M56 140Q56 130 60 129Q64 130 64 140', 'M44 150Q47 141 49 150M71 150Q73 143 75 150M77 150Q80 145 81 150'],
    accents: [],
    glow: [60, 61, 30],
  },
  kotoji: {
    body: [
      'M72 146Q66 132 78 126Q88 122 100 125Q110 130 108 146Z',
      'M40 90H47Q40 120 35 150H26Q34 120 40 90Z',
      'M73 90H80Q88 106 93 124H85Q79 106 73 90Z',
      rect(32, 87, 88, 90),
      poly(42, 80, 78, 80, 86, 87, 34, 87),
      poly(44, 58, 76, 58, 74, 80, 46, 80),
      rect(18, 54, 102, 57),
      roof(60, 34, 54, 50, 10, 8),
      finial(60, 34, 13),
    ],
    windows: [rect(51, 62, 69, 76)],
    moss: [[96, 127, 8, 2.6], [40, 46, 8, 2.4], [82, 141, 5, 1.8]],
    carve: ['M60 62V76M51 69H69', lotus(36, 84, 87, 6, 3)],
    accents: [
      { d: 'M6 150Q18 146 30 150T54 150T70 150V157H6Z', tone: 'water' },
      { d: 'M14 154q8-2 16 0', tone: 'snow' },
    ],
    glow: [60, 69, 32],
  },
  'tachi-carved': {
    body: [
      rect(30, 136, 90, 146),
      poly(44, 124, 76, 124, 84, 136, 36, 136),
      rect(53, 80, 67, 124),
      rect(50, 91, 70, 95),
      rect(50, 111, 70, 115),
      rect(34, 77, 86, 80),
      poly(42, 70, 78, 70, 84, 77, 36, 77),
      poly(44, 41, 76, 41, 74, 70, 46, 70),
      rect(28, 38, 92, 41),
      roof(60, 22, 38, 34, 7, 7),
      `${finial(60, 22, 10)}${ellipse(60, 9, 3.2, 3)}`,
    ],
    windows: [rect(52, 47, 68, 65), ellipse(47.8, 56, 1.6, 4), ellipse(72.2, 56, 1.6, 4)],
    moss: [[50, 30, 6, 2], [36, 144, 8, 2.4], [80, 134, 4, 1.6]],
    carve: [
      'M25 31.5a2.4 2.4 0 1 1 1.6 2.4M95 31.5a2.4 2.4 0 1 0-1.6 2.4',
      lotus(38, 82, 80, 6, 3.5),
      'M55 103q2-4 5-1q3-4 5 0q2 2 0 4q-2 2-5 0q-3 2-5-3Z',
      'M54 131.5a4 1.8 0 1 0 8 0a4 1.8 0 1 0-8 0M62 130.6l2.2-3h1M64.2 127.6l-1-2M64.2 127.6l1.4-1.8M55.5 133v2.6M60.5 133v2.6',
      lotus(32, 88, 146, 7, -3),
    ],
    accents: [],
    glow: [60, 56, 30],
  },
  'ancient-shrine': {
    body: [
      rect(22, 142, 98, 150),
      poly(40, 130, 80, 130, 92, 142, 28, 142),
      rect(48, 102, 72, 130),
      rect(24, 98, 96, 102),
      poly(34, 90, 86, 90, 94, 98, 26, 98),
      poly(36, 56, 84, 56, 82, 90, 38, 90),
      rect(16, 48, 104, 54),
      roof(60, 26, 48, 50, 12, 6),
      `${finial(60, 26, 16)}${rect(54, 23, 66, 26)}`,
    ],
    windows: [rect(44, 61, 76, 85)],
    moss: [[34, 40, 12, 3.6], [80, 38, 9, 3], [96, 47, 5, 1.8], [30, 141, 10, 3], [84, 147, 9, 2.6], [56, 129, 6, 2], [88, 97, 5, 1.6]],
    carve: ['M52 61V85M60 61V85M68 61V85M44 69H76M44 77H76', lotus(30, 90, 142, 8, 3), 'M44 34l2 1M70 31l2-1M50 37l1.6 .8'],
    accents: [
      { d: 'M43 107Q60 116 77 107L77 112Q60 121 43 112Z', tone: 'rope' },
      { d: 'M51 115h4l-1.5 4.5h3.5l-1.5 5h-4l1.5-4.5h-3.5Z', tone: 'paper' },
      { d: 'M66 115h4l-1.5 4.5h3.5l-1.5 5h-4l1.5-4.5h-3.5Z', tone: 'paper' },
    ],
    glow: [60, 73, 40],
  },
  'spirit-light': {
    body: [
      peekKodama.body,
      rect(32, 140, 88, 148),
      poly(46, 128, 74, 128, 84, 140, 36, 140),
      rect(54, 92, 66, 128),
      rect(51, 108, 69, 112),
      rect(34, 89, 86, 92),
      poly(40, 82, 80, 82, 86, 89, 34, 89),
      'M48 54H72Q78 54 78 60V82H42V60Q42 54 48 54Z',
      rect(28, 50, 92, 53),
      roof(60, 34, 50, 40, 9, 8),
      spiritKodama.body,
    ],
    windows: ['M50 79V65Q60 55 70 65V79Z'],
    moss: [[82, 146, 7, 2.2], [44, 44, 7, 2.2]],
    carve: ['M60 60V79', lotus(37, 83, 140, 6, 3.5)],
    accents: [...spiritKodama.face, ...peekKodama.face].map((d) => ({ d, tone: 'dark' as const })),
    glow: [60, 68, 36],
    spirit: true,
    orbs: [[20, 62, 2.2], [100, 44, 1.6], [102, 92, 2.4], [16, 104, 1.5], [88, 18, 1.4]],
  },
};
