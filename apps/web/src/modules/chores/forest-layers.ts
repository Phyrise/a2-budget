/**
 * Configuration des couches de la scène forêt (assets peints).
 *
 * Quand un asset est disponible (import PNG), la couche raster est utilisée.
 * Sinon, la scène retombe sur la version SVG (fallback).
 *
 * Pour activer une couche : décommenter l'import et ajouter l'URL ici.
 * Voir docs/FOREST_ASSETS.md pour les spécifications.
 */

// Les assets peints (à générer) — décommenter quand disponibles :
// import forestBg from './assets/forest-bg.png';
// import forestTree from './assets/forest-tree.png';
// import forestFg from './assets/forest-fg.png';
// import guardian from './assets/guardian.png';
// import spiritMoss from './assets/spirit-moss.png';

export type ForestLayerName =
  | 'bg'
  | 'tree'
  | 'fg'
  | 'guardian'
  | 'spirit';

export interface ForestLayerConfig {
  /** URL de l'asset (PNG transparent, 2x). null = couche SVG fallback. */
  src: string | null;
  /** Position CSS (couche positionnée dans la scène). */
  className: string;
}

/**
 * Couches de la scène, de l'arrière vers l'avant.
 * `src: null` = pas d'asset peint → fallback SVG.
 */
export const FOREST_LAYERS: Record<ForestLayerName, ForestLayerConfig> = {
  bg: { src: null, className: 'forest-scene__layer--bg' },
  tree: { src: null, className: 'forest-scene__layer--tree' },
  fg: { src: null, className: 'forest-scene__layer--fg' },
  guardian: { src: null, className: 'forest-scene__layer--guardian' },
  spirit: { src: null, className: 'forest-scene__layer--spirit' },
};

/** Vrai si au moins une couche raster est disponible. */
export function hasRasterLayers(): boolean {
  return Object.values(FOREST_LAYERS).some((l) => l.src !== null);
}
