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

export function computeFraming(
  w: number,
  h: number,
  imgW: number,
  imgH: number,
  focal: { x: number; y: number } = FOCAL,
  overscale = OVERSCALE,
): Framing {
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  const scale = Math.max(W / imgW, H / imgH) * overscale;
  const vw = W / (imgW * scale);
  const vh = H / (imgH * scale);
  return {
    scale,
    cx: clamp(focal.x, vw / 2, 1 - vw / 2),
    cy: clamp(focal.y, vh / 2, 1 - vh / 2),
    vw,
    vh,
    w: W,
    h: H,
  };
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
