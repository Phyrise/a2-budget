/**
 * Labo Noiraudes — la comparaison : le trio peint (susuwatari-trio.webp)
 * reproduit par le code, à la même taille et dans la même pose (trois
 * Noiraudes debout, celle de droite salue), avec l'apparence réglée dans le
 * panneau. Elles regardent le doigt ou la souris où qu'il soit sur la page.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { createSusuwatariLayer, type SootSpriteParams, type SusuwatariLayer } from '../../../creatures/susuwatari';
import { followPointer } from './followPointer';

/** Pose du trio peint, en fractions de la case (centre du sol, diamètre). */
const TRIO = [
  { x: 0.49, y: 0.62, d: 0.36, seed: 3 },
  { x: 0.28, y: 0.9, d: 0.36, seed: 1 },
  { x: 0.7, y: 0.91, d: 0.36, seed: 6 },
] as const;

export function useCompareTrio(canvasRef: RefObject<HTMLCanvasElement | null>, params: SootSpriteParams) {
  const layerRef = useRef<SusuwatariLayer | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layer = createSusuwatariLayer(canvas, { rim: 0, shadow: 0.45, params: paramsRef.current });
    layerRef.current = layer;
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
    const unfollow = followPointer(layer, canvas);
    return () => {
      observer?.disconnect();
      unfollow();
      layer.destroy();
      layerRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    layerRef.current?.setParams(params);
  }, [params]);
}
