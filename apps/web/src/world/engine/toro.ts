/**
 * Géométrie de la lanterne de pierre (tōrō) dans la scène : module pur (testé).
 *
 * Les peintures (themes/lanterns.ts) partagent la même échelle : `scale` =
 * hauteur de la toile / celle du plus haut modèle. Le pied de la toile est
 * posé sur LANTERN_GROUND (mousse entre les racines du cèdre) ; `fire` et
 * `roof` sont normalisés sur la toile entière (sprites chargés sans rognage).
 */

/** Pied de la lanterne : sur la mousse entre les racines du cèdre, visible au-dessus de la feuille (390×844). */
export const LANTERN_GROUND = { x: 0.548, y: 0.652, depth: 0.24 } as const;

/** Hauteur (en hauteur d'image) de la toile du plus haut modèle (scale = 1). */
export const LANTERN_HEIGHT = 0.16;

/** Hauteur du plus grand kodama assis, relative à LANTERN_HEIGHT (contrat des assets : 0,18–0,2). */
export const KODAMA_ON_ROOF = 0.2;

/** Modèle par défaut (toujours débloqué, @a2/core DEFAULT_LANTERN_ID). */
export const DEFAULT_LANTERN = 'kasuga-moss';

export interface LanternShape {
  aspect: number;
  scale: number;
  fire: { x: number; y: number };
  roof: { x: number; y: number };
}

export interface LanternGeometry {
  /** Hauteur et largeur de la toile (unités : hauteur d'image). */
  h: number;
  w: number;
  ground: { x: number; y: number; depth: number };
  /** Centre de la chambre à feu (coordonnées scène). */
  fire: { x: number; y: number };
  /** Assise d'un kodama sur le toit (coordonnées scène). */
  roof: { x: number; y: number };
}

/** Repli sans peinture (ou en attendant son chargement) : proportions d'une kasuga. */
export const FALLBACK_SHAPE: LanternShape = { aspect: 0.67, scale: 0.83, fire: { x: 0.48, y: 0.42 }, roof: { x: 0.65, y: 0.15 } };

/** Point (u, v) de la toile → scène, toile posée par son pied sur `ground`. */
export function lanternGeometry(shape: LanternShape, sceneAspect: number, ground = LANTERN_GROUND): LanternGeometry {
  const h = LANTERN_HEIGHT * shape.scale;
  const w = h * shape.aspect;
  const at = (u: number, v: number) => ({ x: ground.x + ((u - 0.5) * w) / sceneAspect, y: ground.y - (1 - v) * h });
  return { h, w, ground, fire: at(shape.fire.x, shape.fire.y), roof: at(shape.roof.x, shape.roof.y) };
}

/**
 * Visites des kodama : un tirage doux (rng 0..1) donne l'attente avant la
 * prochaine visite et sa durée. Jamais pendant la floraison.
 */
export const VISIT = {
  /** Première visite après le chargement (s). */
  first: [9, 18] as const,
  /** Durée d'une visite (s). */
  stay: [14, 24] as const,
  /** Pause entre deux visites (s). */
  gap: [35, 80] as const,
  /** Arrivée / départ (s). */
  fade: 0.9,
};

export const between = (r: number, [a, b]: readonly [number, number]) => a + (b - a) * r;

/**
 * Présence d'un kodama en visite (0..1) et petit saut d'arrivée (décalage
 * vertical, en hauteurs du kodama) à l'instant `now`.
 */
export function visitFrame(start: number, end: number, now: number): { vis: number; hop: number } {
  if (now < start || now > end + VISIT.fade) return { vis: 0, hop: 0 };
  const kIn = Math.min(1, (now - start) / VISIT.fade);
  const kOut = now > end ? Math.min(1, (now - end) / VISIT.fade) : 0;
  const vis = kIn * kIn * (3 - 2 * kIn) * (1 - kOut * kOut * (3 - 2 * kOut));
  // Arrivée : il se pose d'un petit bond (parabole) ; départ : il s'élève un peu en s'effaçant.
  const hop = kIn < 1 ? Math.sin(Math.PI * kIn) * 0.6 : -kOut * 0.5;
  return { vis, hop };
}
