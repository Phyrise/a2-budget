/**
 * Labo Noiraudes — la comparaison : le trio peint (susuwatari-trio.webp)
 * reproduit par le code, à la même taille et dans la même pose (trois
 * Noiraudes debout, celle de droite salue). Elles regardent le doigt ou la
 * souris où qu'il soit sur la page, sinon alentour.
 */
import { useEffect, type RefObject } from 'react';
import { createSusuwatariLayer } from '../../../creatures/susuwatari';

/** Pose du trio peint, en fractions de la case (centre du sol, diamètre). */
const TRIO = [
  { x: 0.49, y: 0.6, d: 0.4, seed: 3 },
  { x: 0.28, y: 0.89, d: 0.4, seed: 1 },
  { x: 0.7, y: 0.9, d: 0.4, seed: 6 },
] as const;

export function useCompareTrio(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layer = createSusuwatariLayer(canvas, { rim: 0, shadow: 0.45 });
    const place = () => {
      const w = layer.width;
      const h = layer.height;
      if (layer.creatures.length === 0) {
        TRIO.forEach((p, i) => {
          const s = layer.spawn({ x: p.x * w, y: p.y * h, size: p.d * w, seed: p.seed });
          s.stand(true);
          if (i === 2) s.setArms('wave');
        });
      } else {
        layer.creatures.forEach((s, i) => {
          const p = TRIO[i]!;
          s.place(p.x * w, p.y * h);
          s.size = p.d * w;
        });
      }
    };
    place();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestAnimationFrame(place)) : null;
    observer?.observe(canvas);
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
      observer?.disconnect();
      window.clearTimeout(release);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('pointerout', onOut);
      layer.destroy();
    };
  }, [canvasRef]);
}
