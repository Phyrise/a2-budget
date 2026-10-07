/**
 * Labo Noiraudes — la scène : quelques Noiraudes vivent sur le pont
 * (promenades, clignements, regard qui suit le doigt ou la souris).
 * - toucher bref : rebond + petit cri (si les petits sons sont activés) ;
 * - appui long : elle tremble, puis s'enfuit hors de l'écran ; elle revient
 *   un peu plus tard en trottinant depuis un bord ;
 * - nombre (1–50), taille, nuit (seuls les yeux restent visibles).
 */
import { useEffect, useRef, type RefObject } from 'react';
import { playCue } from '../../../app/sound';
import { createSusuwatariLayer, type Point, type Susuwatari, type SusuwatariLayer } from '../../../creatures/susuwatari';

const LONG_PRESS_MS = 420;
const SHIVER_MS = 650;

/** La toile de la scène porte son calque (tests, captures). */
export type LabCanvas = HTMLCanvasElement & { noiraudes?: SusuwatariLayer };

export interface LabSceneSettings {
  count: number;
  size: number;
  night: boolean;
}

/**
 * Début du plancher du pont dans la peinture portrait (fraction de sa
 * hauteur, côté droit où la rambarde descend le plus bas).
 */
const DECK_TOP = 0.8;

/** Haut du plancher dans la toile (px CSS), d'après le cadrage réel de la peinture (cover, calée en bas). */
function measureDeck(img: HTMLImageElement | null, canvas: HTMLCanvasElement): number {
  if (!img) return canvas.clientHeight * 0.4;
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth || 1024;
  const nh = img.naturalHeight || 1536;
  const h = nh * Math.max(r.width / nw, r.height / nh);
  return r.bottom - h + DECK_TOP * h - canvas.getBoundingClientRect().top;
}

export function useLabScene(canvasRef: RefObject<HTMLCanvasElement | null>, bgRef: RefObject<HTMLImageElement | null>, settings: LabSceneSettings) {
  const layerRef = useRef<SusuwatariLayer | null>(null);
  const factors = useRef(new Map<number, number>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Calque et gestes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let deckTop = measureDeck(bgRef.current, canvas);
    const deck = (width: number, height: number) => {
      const top = Math.max(20, Math.min(height - 60, deckTop));
      return { left: 28, top, right: Math.max(29, width - 28), bottom: Math.max(top + 1, height - 26) };
    };
    const layer = createSusuwatariLayer(canvas, {
      rim: 1,
      area: deck,
      depth: (y, h) => {
        const d = deck(canvas.clientWidth, h);
        return 0.8 + 0.2 * Math.max(0, Math.min(1, (y - d.top) / Math.max(1, d.bottom - d.top)));
      },
    });
    const remeasure = () => {
      deckTop = measureDeck(bgRef.current, canvas);
    };
    window.addEventListener('resize', remeasure);
    bgRef.current?.addEventListener('load', remeasure);
    layerRef.current = layer;
    // Accès pour les tests et les captures (où sont les Noiraudes sur la toile).
    (canvas as LabCanvas).noiraudes = layer;
    const timers = new Set<number>();
    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    let press: { s: Susuwatari; id: number; long: boolean; at: Point } | null = null;
    let release = 0;

    const local = (e: PointerEvent): Point => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const comeBack = (s: Susuwatari) => {
      later(1500 + Math.random() * 2500, () => {
        if (!layer.creatures.includes(s)) return;
        const zone = layer.area();
        const fromLeft = Math.random() < 0.5;
        const y = zone.top + Math.random() * (zone.bottom - zone.top);
        s.reappear(fromLeft ? -s.scale : layer.width + s.scale, y);
        s.walkTo(fromLeft ? zone.left + 30 + Math.random() * 80 : zone.right - 30 - Math.random() * 80, y, { speed: 90 });
      });
    };

    const onDown = (e: PointerEvent) => {
      const p = local(e);
      layer.setGaze(p);
      window.clearTimeout(release);
      const s = layer.hitTest(p.x, p.y);
      if (!s) return;
      canvas.setPointerCapture(e.pointerId);
      const id = window.setTimeout(() => {
        if (!press || press.s !== s) return;
        press.long = true;
        s.shiver(SHIVER_MS, () => {
          playCue('squeak');
          s.flee(press?.at ?? p, { view: layer.view(), onGone: () => comeBack(s) });
        });
      }, LONG_PRESS_MS);
      press = { s, id, long: false, at: p };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      layer.setGaze(p);
      if (press) press.at = p;
    };
    const onUp = () => {
      if (press) {
        window.clearTimeout(press.id);
        if (!press.long) {
          press.s.bounce(1);
          playCue('squeak');
        }
        press = null;
      }
      // Au doigt, le regard reste un instant sur le dernier toucher.
      release = window.setTimeout(() => layer.setGaze(null), 1400);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') layer.setGaze(null);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', remeasure);
      bgRef.current?.removeEventListener('load', remeasure);
      window.clearTimeout(release);
      if (press) window.clearTimeout(press.id);
      timers.forEach((t) => window.clearTimeout(t));
      layer.destroy();
      layerRef.current = null;
      delete (canvas as LabCanvas).noiraudes;
      factors.current.clear();
    };
  }, [canvasRef, bgRef]);

  // Nombre et taille.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const zone = layer.area();
    while (layer.creatures.length < settings.count) {
      const f = 0.86 + Math.random() * 0.28;
      const s = layer.spawn({
        x: zone.left + Math.random() * (zone.right - zone.left),
        y: zone.top + Math.random() * (zone.bottom - zone.top),
        size: settings.size * f,
      });
      s.autonomous = true;
      factors.current.set(s.id, f);
    }
    while (layer.creatures.length > settings.count) {
      const s = layer.creatures[layer.creatures.length - 1]!;
      factors.current.delete(s.id);
      layer.remove(s);
    }
    for (const s of layer.creatures) s.size = settings.size * (factors.current.get(s.id) ?? 1);
  }, [settings.count, settings.size]);

  useEffect(() => {
    layerRef.current?.setNight(settings.night);
  }, [settings.night]);

  return layerRef;
}
