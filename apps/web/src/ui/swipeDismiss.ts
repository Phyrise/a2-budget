/**
 * Glisser pour fermer (messages éphémères, invitation de mise à jour).
 * L'élément suit le doigt sur un axe choisi au premier mouvement : à
 * l'horizontale, ou vers le bas (vers le haut, rien ne bouge). Au-delà du
 * seuil, ou d'un geste vif, il file dans la direction du geste (en
 * SWIPE_OUT_MS) et `onDismiss` est appelé aussitôt ; sinon il revient avec
 * un petit rebond.
 *
 * Le décalage passe par la propriété `translate` (indépendante de
 * `transform` : ni le centrage ni les animations d'entrée ne sont touchés).
 * Le clic qui termine un glissé est avalé (« Annuler » n'est pas déclenché
 * par mégarde). L'élément porte `touch-action: none` dans sa feuille de style.
 */
import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react';

interface Drag {
  id: number;
  x0: number;
  y0: number;
  axis: 'x' | 'y' | null;
  offset: number;
  /** Vitesse sur l'axe (px/ms), lissée. */
  speed: number;
  lastPos: number;
  lastT: number;
}

/** Distance avant de choisir un axe (un simple toucher reste un clic). */
const SLOP = 8;
/** Durée de la sortie (l'élément peut être retiré ensuite). */
export const SWIPE_OUT_MS = 200;
const BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useSwipeDismiss<T extends HTMLElement>({
  onDismiss,
  onDragChange,
}: {
  onDismiss: () => void;
  /** Glissé commencé / fini (ex. suspendre la fermeture automatique). */
  onDragChange?: (dragging: boolean) => void;
}) {
  const drag = useRef<Drag | null>(null);
  const swallowUntil = useRef(0);
  const callbacks = useRef({ onDismiss, onDragChange });
  callbacks.current = { onDismiss, onDragChange };

  const onPointerDown = useCallback((e: PointerEvent<T>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || e.currentTarget.dataset.swiped) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, offset: 0, speed: 0, lastPos: 0, lastT: e.timeStamp };
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    const d = drag.current;
    if (d === null || d.id !== e.pointerId) return;
    const el = e.currentTarget;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (d.axis === null) {
      if (Math.hypot(dx, dy) < SLOP) return;
      if (Math.abs(dx) >= Math.abs(dy)) d.axis = 'x';
      else if (dy > 0) d.axis = 'y';
      else {
        drag.current = null;
        return;
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture refusée (pointeur déjà relâché) : le suivi continue sans elle.
      }
      el.style.transition = 'none';
      callbacks.current.onDragChange?.(true);
    }
    const pos = d.axis === 'x' ? dx : dy;
    // Vers le haut, l'élément résiste (un quart du geste).
    d.offset = d.axis === 'y' && pos < 0 ? pos / 4 : pos;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.speed = d.speed * 0.4 + ((pos - d.lastPos) / dt) * 0.6;
    d.lastPos = pos;
    d.lastT = e.timeStamp;
    const size = d.axis === 'x' ? el.offsetWidth : el.offsetHeight * 1.6;
    el.style.translate = d.axis === 'x' ? `${d.offset}px 0` : `0 ${d.offset}px`;
    el.style.opacity = String(1 - Math.min(1, Math.abs(d.offset) / Math.max(1, size)) * 0.75);
  }, []);

  const finish = useCallback((e: PointerEvent<T>, cancelled: boolean) => {
    const d = drag.current;
    if (d === null || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.axis === null) return;
    const el = e.currentTarget;
    swallowUntil.current = performance.now() + 400;
    callbacks.current.onDragChange?.(false);
    const size = d.axis === 'x' ? el.offsetWidth : el.offsetHeight;
    const far = d.axis === 'x' ? Math.abs(d.offset) > Math.min(110, size * 0.35) : d.offset > Math.min(56, size * 0.8);
    const flick = Math.abs(d.speed) > 0.55 && Math.abs(d.offset) > 16 && Math.sign(d.speed) === Math.sign(d.offset);
    if (!cancelled && (far || flick)) {
      const away = d.axis === 'x' ? `${Math.sign(d.offset) * (size + 60)}px 0` : `0 ${size + 80}px`;
      el.style.transition = `translate ${SWIPE_OUT_MS}ms var(--ease-out), opacity ${SWIPE_OUT_MS}ms var(--ease-out)`;
      el.style.translate = away;
      el.style.opacity = '0';
      el.dataset.swiped = 'true';
      callbacks.current.onDismiss();
      return;
    }
    // Retour élastique à sa place.
    el.style.transition = `translate ${reducedMotion() ? '160ms ease' : `420ms ${BOUNCE}`}, opacity 220ms ease`;
    el.style.translate = '';
    el.style.opacity = '';
  }, []);

  const onPointerUp = useCallback((e: PointerEvent<T>) => finish(e, false), [finish]);
  const onPointerCancel = useCallback((e: PointerEvent<T>) => finish(e, true), [finish]);

  /** Avale le clic qui suit un glissé. */
  const onClickCapture = useCallback((e: MouseEvent<T>) => {
    if (performance.now() < swallowUntil.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture };
}
