/**
 * Boutons − / + à appui long qui accélère (montants en euros entiers).
 *
 * - Un toucher = un pas de 1 €.
 * - Appui maintenu : après 420 ms, la valeur défile de plus en plus vite,
 *   puis par 10 €, puis par 50 € (calée sur les dizaines / cinquantaines).
 * - Clavier (Entrée, Espace) : un pas par appui, validé tout de suite.
 * - `onRelease` est appelé à la fin du geste (relâché, annulé, perdu) : c'est
 *   là qu'on valide la valeur, pour ne pas écrire à chaque pas.
 *
 * Aucune logique financière : un simple compteur d'euros entiers.
 */
import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

const FIRST_DELAY_MS = 420;

/** Pas (en euros) au n-ième rebond d'un appui long. */
export function holdStep(tick: number): number {
  if (tick < 14) return 1;
  if (tick < 34) return 10;
  return 50;
}

/** Intervalle (ms) avant le rebond suivant : de 150 ms à 45 ms. */
export function holdDelay(tick: number): number {
  return Math.max(45, 150 - tick * 9);
}

/**
 * Valeur suivante en euros entiers : un pas de 1 € part de la valeur ; un
 * pas plus grand se cale d'abord sur un multiple du pas (2 203 → 2 210).
 */
export function nextEuros(euros: number, direction: 1 | -1, step: number): number {
  if (step <= 1) return euros + direction;
  return direction > 0 ? Math.floor(euros / step) * step + step : Math.ceil(euros / step) * step - step;
}

export function haptic(ms = 5): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch {
    // Retour haptique facultatif.
  }
}

export interface HoldHandlers {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onLostPointerCapture: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * `step(stepEuros)` applique un pas et renvoie false s'il n'y a plus rien à
 * faire (borne atteinte) : l'appui long s'arrête alors de lui-même.
 */
export function useHoldRepeat(step: (stepEuros: number) => boolean, onRelease: () => void): HoldHandlers {
  const timer = useRef<number | undefined>(undefined);
  const active = useRef(false);
  const stepRef = useRef(step);
  const releaseRef = useRef(onRelease);
  stepRef.current = step;
  releaseRef.current = onRelease;

  const stop = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (!active.current) return;
    active.current = false;
    releaseRef.current();
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tickAt = (tick: number) => {
    timer.current = window.setTimeout(() => {
      if (!active.current) return;
      if (!stepRef.current(holdStep(tick))) {
        stop();
        return;
      }
      tickAt(tick + 1);
    }, tick === 0 ? FIRST_DELAY_MS : holdDelay(tick));
  };

  return {
    onPointerDown: (event) => {
      if (event.button !== 0 || event.currentTarget.disabled) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture facultative (pointeur déjà relâché).
      }
      active.current = true;
      if (!stepRef.current(1)) {
        stop();
        return;
      }
      tickAt(0);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    onClick: (event) => {
      // Les clics souris / doigt sont déjà traités au pointerdown ; ici, le clavier.
      if (event.detail !== 0) return;
      if (stepRef.current(1)) releaseRef.current();
    },
    onContextMenu: (event) => event.preventDefault(),
  };
}
