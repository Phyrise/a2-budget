/**
 * Clavier virtuel ouvert ? (pour effacer la pilule de navigation).
 *
 * Le focus seul ne suffit pas : sur iPhone, après fermeture du clavier, le
 * champ garde souvent le focus et la navigation ne revenait jamais. On se
 * fie donc à la géométrie : le clavier est ouvert quand un champ de saisie a
 * le focus ET que la zone visible (`visualViewport`) est nettement plus basse
 * que la hauteur pleine connue pour cette largeur.
 *
 * - iOS : le viewport de mise en page ne bouge pas, `visualViewport` rétrécit.
 * - Android : le viewport de mise en page rétrécit aussi (`innerHeight`) ;
 *   la hauteur pleine mémorisée sert de référence.
 * - Sans `visualViewport` (anciens navigateurs) : on retombe sur
 *   `innerHeight`, toujours comparé à la hauteur pleine.
 *
 * Réévalué sur resize / scroll de `visualViewport`, resize de la fenêtre,
 * focusin / focusout, et à l'orientation.
 */
import { useEffect, useState } from 'react';

/** Rétrécissement minimal (px) attribué au clavier, au-delà des barres du navigateur. */
const MIN_KEYBOARD_PX = 140;
/** Ou, sur grands écrans, une part de la hauteur pleine. */
const MIN_KEYBOARD_RATIO = 0.2;

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'number', 'password', 'date', 'time', '']);

/** Un élément qui fait apparaître le clavier quand il a le focus. */
export function isTextEntry(el: Element | null): boolean {
  if (el === null) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
  if (el instanceof HTMLSelectElement) return false;
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Hauteur visible, ramenée à l'échelle 1 (un zoom au pincer n'est pas un clavier). */
function visibleHeight(): number {
  const vv = window.visualViewport;
  if (!vv) return window.innerHeight;
  return vv.height * (vv.scale > 0 ? vv.scale : 1);
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let fullHeight = Math.max(window.innerHeight, visibleHeight());
    let width = window.innerWidth;
    let frame = 0;

    const evaluate = () => {
      frame = 0;
      // Nouvelle largeur (rotation, fenêtre) : nouvelle référence.
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        fullHeight = Math.max(window.innerHeight, visibleHeight());
      }
      const visible = visibleHeight();
      fullHeight = Math.max(fullHeight, window.innerHeight, visible);
      const shrink = fullHeight - visible;
      const threshold = Math.max(MIN_KEYBOARD_PX, fullHeight * MIN_KEYBOARD_RATIO);
      const next = isTextEntry(document.activeElement) && shrink >= threshold;
      setOpen((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(evaluate);
    };
    // focusout : le focus n'a pas encore bougé, on attend l'image suivante.
    const onFocusOut = () => {
      schedule();
      window.setTimeout(schedule, 120);
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', onFocusOut);
    evaluate();
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return open;
}
