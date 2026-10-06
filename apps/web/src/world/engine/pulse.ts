/**
 * Départ d'un pulse : du point d'écran (la case cochée) au point de la scène
 * où la lumière apparaît. La feuille de l'interface (`.screen-sheet`, classe
 * garantie par la coquille) recouvre le bas du canvas : on la mesure pour
 * faire émerger la lumière à son bord plutôt que dessous (flight.ts).
 */
import { pulseOrigin, type Cover } from './flight';
import { viewToScene, type Framing } from './framing';

function coverAt(clientX: number, clientY: number, canvasRect: DOMRect): Cover | null {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null;
  const el = document.elementFromPoint(clientX, clientY);
  const sheet = el?.closest('.screen-sheet');
  if (!sheet) return null;
  const r = sheet.getBoundingClientRect();
  return { left: r.left - canvasRect.left, top: r.top - canvasRect.top, width: r.width };
}

/** Coordonnées scène du départ, ou null sans point d'écran. */
export function pulseStart(canvas: HTMLCanvasElement, framing: Framing, clientX?: number, clientY?: number): { x: number; y: number } | null {
  if (clientX === undefined || clientY === undefined) return null;
  const r = canvas.getBoundingClientRect();
  const view = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  const o = pulseOrigin(view, { x: clientX - r.left, y: clientY - r.top }, coverAt(clientX, clientY, r));
  return viewToScene(framing, o.x, o.y);
}
