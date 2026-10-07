/**
 * Labo Noiraudes — l'aperçu à plusieurs tailles : la même Noiraude à 30, 50,
 * 80 et 140 px (diamètre CSS), au repos sur le papier des peintures, avec
 * l'apparence réglée dans le panneau. À 50 px, on doit lire « ⚫ + 👀 ».
 * Elles regardent le doigt ; en toucher une la fait sauter (rebond).
 */
import { useEffect, useRef, type RefObject } from 'react';
import { createSusuwatariLayer, type SootSpriteParams, type SusuwatariLayer } from '../../../creatures/susuwatari';
import { followPointer } from './followPointer';

export const PREVIEW_SIZES = [30, 50, 80, 140] as const;
/** Hauteur réservée sous le sol (étiquettes des tailles), px CSS. */
const FLOOR = 22;

export function useSizesBand(canvasRef: RefObject<HTMLCanvasElement | null>, params: SootSpriteParams) {
  const layerRef = useRef<SusuwatariLayer | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layer = createSusuwatariLayer(canvas, { rim: 0, shadow: 0.45, params: paramsRef.current });
    layerRef.current = layer;
    (canvas as HTMLCanvasElement & { noiraudes?: SusuwatariLayer }).noiraudes = layer;
    // Écarts égaux entre les Noiraudes et aux bords (comme les étiquettes en « space-evenly »).
    const place = () => {
      const total = PREVIEW_SIZES.reduce((a, b) => a + b, 0);
      const gap = Math.max(2, (layer.width - total) / (PREVIEW_SIZES.length + 1));
      let x = gap;
      PREVIEW_SIZES.forEach((size, i) => {
        const at = { x: x + size / 2, y: layer.height - FLOOR };
        const s = layer.creatures[i] ?? layer.spawn({ ...at, size, seed: 3 });
        s.place(at.x, at.y);
        x += size + gap;
      });
    };
    place();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestAnimationFrame(place)) : null;
    observer?.observe(canvas);
    const unfollow = followPointer(layer, canvas);
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      layer.hitTest(e.clientX - r.left, e.clientY - r.top)?.bounce(0.6);
    };
    canvas.addEventListener('pointerdown', onDown);
    return () => {
      observer?.disconnect();
      unfollow();
      canvas.removeEventListener('pointerdown', onDown);
      layer.destroy();
      layerRef.current = null;
      delete (canvas as HTMLCanvasElement & { noiraudes?: SusuwatariLayer }).noiraudes;
    };
  }, [canvasRef]);

  useEffect(() => {
    layerRef.current?.setParams(params);
  }, [params]);
}
