/**
 * Cadrage « cover » de la peinture portrait dans la vue, autour d'un point
 * focal (le cèdre), avec une légère sur-échelle qui cache les bords pendant la
 * parallaxe. Module pur, partagé par le moteur WebGL et par les <img> de repli
 * (même cadrage au pixel près : aucun saut au fondu enchaîné).
 */

export interface Framing {
  /** Pixels CSS par pixel d'image. */
  scale: number;
  /** Centre de la vue, en coordonnées image normalisées (0..1, origine en haut à gauche). */
  cx: number;
  cy: number;
  /** Taille visible, en coordonnées image normalisées. */
  vw: number;
  vh: number;
  /** Taille de la vue (px CSS). */
  w: number;
  h: number;
}

export const FOCAL = { x: 0.5, y: 0.42 } as const;
export const OVERSCALE = 1.045;

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

export interface FramingOptions {
  focal?: { x: number; y: number };
  overscale?: number;
  /**
   * Part minimale de la hauteur d'image visible. Sur un écran large, la
   * peinture portrait n'est alors plus « cover » en largeur : les côtés sont
   * prolongés par un reflet flou et assombri (shader).
   */
  minVisibleH?: number;
  /** Position horizontale à l'écran (0..1) où placer le point focal. */
  screenFocusX?: number;
}

export function computeFraming(w: number, h: number, imgW: number, imgH: number, o: FramingOptions = {}): Framing {
  const focal = o.focal ?? FOCAL;
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  let scale = Math.max(W / imgW, H / imgH) * (o.overscale ?? OVERSCALE);
  if (o.minVisibleH && H / (imgH * scale) < o.minVisibleH) scale = H / (imgH * o.minVisibleH);
  const vw = W / (imgW * scale);
  const vh = H / (imgH * scale);
  const fx = o.screenFocusX ?? 0.5;
  const cx = focal.x + (0.5 - fx) * vw;
  return {
    scale,
    // Plus étroite que la vue : la peinture reste collée au bord gauche.
    cx: vw < 1 ? clamp(cx, vw / 2, 1 - vw / 2) : Math.max(cx, vw / 2),
    cy: clamp(focal.y, vh / 2, 1 - vh / 2),
    vw,
    vh,
    w: W,
    h: H,
  };
}

/** Largeur du carnet d'interface posé à droite en présentation « backdrop ». */
export const BACKDROP_PANEL = 480;

/** Cadrage selon la présentation (partagé moteur / <img>). */
export function framingFor(variant: string, w: number, h: number, size: { w: number; h: number }): Framing {
  if (variant === 'backdrop' && w > h) {
    const free = w >= 1024 ? w - BACKDROP_PANEL : w;
    return computeFraming(w, h, size.w, size.h, { minVisibleH: 0.74, screenFocusX: free / 2 / w, overscale: 1.02, focal: { x: FOCAL.x, y: 0.5 } });
  }
  return computeFraming(w, h, size.w, size.h);
}

/** Style absolu d'une <img> plein format qui reproduit exactement le cadrage. */
export function imageBoxStyle(f: Framing, imgW: number, imgH: number) {
  const width = imgW * f.scale;
  const height = imgH * f.scale;
  return {
    position: 'absolute' as const,
    width: `${width}px`,
    height: `${height}px`,
    left: `${f.w / 2 - f.cx * width}px`,
    top: `${f.h / 2 - f.cy * height}px`,
    maxWidth: 'none',
  };
}

/** Point de vue (px CSS relatifs au conteneur) → coordonnées image normalisées. */
export function viewToScene(f: Framing, px: number, py: number) {
  return { x: f.cx + (px / f.w - 0.5) * f.vw, y: f.cy + (py / f.h - 0.5) * f.vh };
}

/** Coordonnées image normalisées → point de vue (px CSS). */
export function sceneToView(f: Framing, x: number, y: number) {
  return { x: ((x - f.cx) / f.vw + 0.5) * f.w, y: ((y - f.cy) / f.vh + 0.5) * f.h };
}
