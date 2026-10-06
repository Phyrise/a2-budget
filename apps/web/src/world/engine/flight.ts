/**
 * Envol d'une lumière du jour (pulse) : de la case cochée jusqu'à son ancre.
 * Module pur (testé), partagé par DayLights et le moteur.
 *
 * Pourquoi cette forme (régression V4) : la case cochée est SOUS la feuille
 * opaque, et le canvas du héros mobile déborde de 72 px sous la feuille. Avec
 * l'ancien vol (Bézier quadratique, accélération et freinage symétriques,
 * départ au point de la case), les 40 premiers % du vol se passaient cachés
 * sous la feuille, puis derrière la bulle du compagnon et la phrase d'humeur :
 * on ne voyait plus que la lumière « s'allumer » à sa place.
 *
 * Désormais :
 * - le départ est ramené au bord visible de la feuille, à l'aplomb de la case
 *   (`pulseOrigin`) : la lumière jaillit dès la première image ;
 * - le vol est une courbe cubique qui monte franchement, passe AU-DESSUS de
 *   la phrase d'humeur (dans la forêt dégagée), puis redescend se poser ;
 * - l'horloge part vite (la partie basse, près des textes, est franchie en
 *   ≈0,2 s) et ralentit pour un atterrissage doux.
 */

export interface FlightPath {
  sx: number;
  sy: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  /** Ancre d'arrivée. */
  ax: number;
  ay: number;
  start: number;
  dur: number;
}

export const FLIGHT = 1.7;
export const FLIGHT_STRONG = 2.1;

/** Progression de l'horloge du vol : départ vif, arrivée douce (dérivée nulle à 1). */
export function flightEase(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return 1 - Math.pow(1 - c, 2.3);
}

/** Surface opaque de l'interface qui recouvre la scène (px CSS relatifs au canvas). */
export interface Cover {
  left: number;
  top: number;
  width: number;
}

/** Fondu du bord haut de la feuille : la lumière en émerge à mi-fondu. */
const EMERGE = 18;

/**
 * Point de départ du vol (px CSS relatifs au canvas). Une case cochée sous la
 * feuille est invisible : la lumière émerge au bord de la feuille, à l'aplomb
 * de la case (feuille du téléphone, pleine largeur), ou au bord gauche du
 * carnet posé à droite (ordinateur). Toujours ramené dans la vue.
 */
export function pulseOrigin(view: { w: number; h: number }, point: { x: number; y: number }, cover: Cover | null): { x: number; y: number } {
  let { x, y } = point;
  if (cover) {
    const fullWidth = cover.width >= view.w * 0.8;
    if (fullWidth && cover.top > 0 && y > cover.top) y = cover.top + EMERGE;
    else if (!fullWidth && cover.left > 0 && x > cover.left) x = cover.left - EMERGE;
  }
  return { x: Math.min(view.w, Math.max(0, x)), y: Math.min(view.h + EMERGE, Math.max(0, y)) };
}

/**
 * Trajectoire : monte d'abord presque à la verticale, survole l'ancre
 * (arc de `arc` en hauteur d'image) puis s'y pose en douceur. `side`
 * (−1 / 1) choisit de quel côté la courbe se penche.
 */
export function makeFlight(
  from: { x: number; y: number },
  anchor: { x: number; y: number },
  side: number,
  start: number,
  strong: boolean,
): FlightPath {
  const arc = strong ? 0.2 : 0.16;
  const top = Math.min(from.y, anchor.y) - arc;
  const dx = anchor.x - from.x;
  return {
    sx: from.x,
    sy: from.y,
    // Premier point : à la verticale du départ, déjà haut (envol franc).
    c1x: from.x + dx * 0.15,
    c1y: top + arc * 0.15,
    // Second point : au-dessus de l'ancre, décalé d'un côté (boucle douce).
    c2x: anchor.x + side * 0.07 + dx * 0.12,
    c2y: top - arc * 0.15,
    ax: anchor.x,
    ay: anchor.y,
    start,
    dur: strong ? FLIGHT_STRONG : FLIGHT,
  };
}

/** Position sur la courbe pour une avance e (0..1, déjà « easée »). */
export function bezierAt(f: FlightPath, e: number): { x: number; y: number } {
  const u = 1 - e;
  const a = u * u * u;
  const b = 3 * u * u * e;
  const c = 3 * u * e * e;
  const d = e * e * e;
  return {
    x: a * f.sx + b * f.c1x + c * f.c2x + d * f.ax,
    y: a * f.sy + b * f.c1y + c * f.c2y + d * f.ay,
  };
}

/** Position de la tête à l'instant `now` (k = progression temporelle 0..1). */
export function flightAt(f: FlightPath, now: number): { x: number; y: number; k: number; e: number } {
  const k = Math.min(1, Math.max(0, (now - f.start) / f.dur));
  const e = flightEase(k);
  return { ...bezierAt(f, e), k, e };
}
