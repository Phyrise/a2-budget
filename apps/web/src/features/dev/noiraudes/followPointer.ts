/**
 * Labo Noiraudes — les Noiraudes d'un calque regardent le doigt ou la souris
 * où qu'il soit sur la page (même sur un curseur du panneau), sinon alentour.
 * Rend la fonction qui retire les écouteurs.
 */
import type { SusuwatariLayer } from '../../../creatures/susuwatari';

export function followPointer(layer: SusuwatariLayer, canvas: HTMLCanvasElement): () => void {
  let release = 0;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    layer.setGaze({ x: e.clientX - r.left, y: e.clientY - r.top });
    window.clearTimeout(release);
    if (e.pointerType !== 'mouse') release = window.setTimeout(() => layer.setGaze(null), 1600);
  };
  const onOut = (e: PointerEvent) => {
    if (e.relatedTarget === null && e.pointerType === 'mouse') layer.setGaze(null);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerdown', onMove);
  document.addEventListener('pointerout', onOut);
  return () => {
    window.clearTimeout(release);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onMove);
    document.removeEventListener('pointerout', onOut);
  };
}
