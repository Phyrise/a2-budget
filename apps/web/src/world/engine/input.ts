/**
 * Entrées du moteur : parallaxe au doigt / à la souris, tap pour passer le
 * gardien, reprise du rendu (clavier, onglet visible), perte de contexte.
 */
import type { WorldEngine } from './Engine';
import { now } from './Engine';

export function bindEngineEvents(engine: WorldEngine) {
  let touchStart: { x: number; y: number } | null = null;

  const onPointer = (e: PointerEvent, kind: 'move' | 'down' | 'up') => {
    const sp = engine.spirits;
    if (kind === 'down' && sp.guardianActive(now())) sp.skipGuardian(now());
    const r = engine.canvas.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const p = engine.pointer;
    if (e.pointerType === 'mouse') {
      if (inside) {
        p.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        p.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      } else {
        p.tx = 0;
        p.ty = 0;
      }
    } else if (kind === 'down') {
      touchStart = inside ? { x: e.clientX, y: e.clientY } : null;
    } else if (kind === 'move' && touchStart) {
      p.tx = Math.max(-1, Math.min(1, (e.clientX - touchStart.x) / 180));
      p.ty = Math.max(-1, Math.min(1, (e.clientY - touchStart.y) / 180));
    } else if (kind === 'up') {
      touchStart = null;
      p.tx = 0;
      p.ty = 0;
    }
    engine.requestFrame(true);
  };

  const on = <E extends Event>(target: Window | Document, type: string, fn: (e: E) => void) => {
    target.addEventListener(type, fn as EventListener, { passive: true });
    engine.cleanups.push(() => target.removeEventListener(type, fn as EventListener));
  };
  on<PointerEvent>(window, 'pointermove', (e) => onPointer(e, 'move'));
  on<PointerEvent>(window, 'pointerdown', (e) => onPointer(e, 'down'));
  on<PointerEvent>(window, 'pointerup', (e) => onPointer(e, 'up'));
  on<PointerEvent>(window, 'pointercancel', (e) => onPointer(e, 'up'));
  on(window, 'keydown', () => engine.requestFrame(true));
  on(document, 'visibilitychange', () => (document.hidden ? engine.halt() : engine.requestFrame(true)));
  const lost = (e: Event) => {
    e.preventDefault();
    engine.markLost();
  };
  engine.canvas.addEventListener('webglcontextlost', lost);
  engine.cleanups.push(() => engine.canvas.removeEventListener('webglcontextlost', lost));
}
