/**
 * Labo Noiraudes — la comparaison : le trio peint (susuwatari-trio.webp)
 * reproduit par le code, à la même taille et dans la même pose (trois
 * Noiraudes debout, celle de droite salue), avec l'apparence réglée dans le
 * panneau. Elles regardent le doigt ou la souris où qu'il soit sur la page.
 *
 * « Gros plan » (`closeUp`) : une seule Noiraude, cadrée comme le plan du
 * film (corps aux 3/8 de la hauteur, pieds en bas, bras levés en « V ») —
 * pour juger poils, yeux, jambes et doigts de près.
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

/** Gros plan : sol et centre du corps (fractions de la hauteur), comme le plan du film. */
const CLOSE = { ground: 0.92, center: 0.375, seed: 3 } as const;

export function useCompareTrio(canvasRef: RefObject<HTMLCanvasElement | null>, params: SootSpriteParams, closeUp = false) {
  const layerRef = useRef<SusuwatariLayer | null>(null);
  const placeRef = useRef<() => void>(() => undefined);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const closeRef = useRef(closeUp);
  closeRef.current = closeUp;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layer = createSusuwatariLayer(canvas, { rim: 0, shadow: 0.45, params: paramsRef.current });
    layerRef.current = layer;
    (canvas as HTMLCanvasElement & { noiraudes?: SusuwatariLayer }).noiraudes = layer;
    let mode: boolean | null = null;
    const place = () => {
      const w = layer.width;
      const h = layer.height;
      const close = closeRef.current;
      if (mode !== close) {
        layer.clear();
        mode = close;
      }
      if (close) {
        const s = layer.creatures[0] ?? layer.spawn({ x: w / 2, y: CLOSE.ground * h, size: h * 0.6, seed: CLOSE.seed });
        // Taille : le centre du corps, pattes sorties, tombe aux 3/8 de la hauteur.
        const rise = Math.max(0.2, s.rig.rest + s.rig.lift);
        s.size = ((CLOSE.ground - CLOSE.center) * h) / rise;
        s.place(w / 2, CLOSE.ground * h);
        s.stand(true);
        s.setArms('cheer');
        return;
      }
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
    placeRef.current = place;
    place();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestAnimationFrame(place)) : null;
    observer?.observe(canvas);
    const unfollow = followPointer(layer, canvas);
    return () => {
      observer?.disconnect();
      unfollow();
      layer.destroy();
      layerRef.current = null;
      placeRef.current = () => undefined;
      delete (canvas as HTMLCanvasElement & { noiraudes?: SusuwatariLayer }).noiraudes;
    };
  }, [canvasRef]);

  // Apparence (en gros plan, la taille suit la longueur des jambes), puis mode.
  useEffect(() => {
    layerRef.current?.setParams(params);
    if (closeRef.current) placeRef.current();
  }, [params]);

  useEffect(() => {
    placeRef.current();
  }, [closeUp]);
}
