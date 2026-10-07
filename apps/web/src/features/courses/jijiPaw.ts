/**
 * Jiji, à côté du panier, donne un petit coup de patte curieux quand un
 * article coché file vers le panier (V4.3) : il se ramasse, se penche deux
 * fois vers le panier, puis se redresse — avant que l'article n'y tombe
 * (SWEEP_MS). Anti-rafale : un coup de patte en cours n'est jamais relancé.
 * Calme (mouvement réduit, Forêt « Immobile ») : rien.
 */
import { readPrefs } from '../../app/prefs';
import { prefersReducedMotion } from './kiki';

/** Le coup de patte part pendant que l'article est en vol, et finit avant qu'il n'arrive. */
export const PAW_DELAY_MS = 150;
export const PAW_MS = 480;

const FRAMES: Keyframe[] = [
  { offset: 0, transform: 'none' },
  { offset: 0.18, transform: 'translateX(2px) scale(1.02, 0.95)' },
  { offset: 0.38, transform: 'translateX(-7px) rotate(-10deg)' },
  { offset: 0.52, transform: 'translateX(-3px) rotate(-4deg)' },
  { offset: 0.66, transform: 'translateX(-8px) rotate(-11deg)' },
  { offset: 0.84, transform: 'translateX(-2px) rotate(-2deg)' },
  { offset: 1, transform: 'none' },
];

const running = new WeakMap<Element, Animation>();

function calm(): boolean {
  try {
    return prefersReducedMotion() || readPrefs().forestMotion === 'still';
  } catch {
    return true;
  }
}

/** Joue le coup de patte sur l'image de Jiji ; faux s'il n'a pas lieu. */
export function jijiPaw(el: HTMLElement | null, delay = PAW_DELAY_MS): boolean {
  if (!el || typeof el.animate !== 'function' || calm()) return false;
  const cur = running.get(el);
  if (cur && cur.playState !== 'finished' && cur.playState !== 'idle') return false;
  const a = el.animate(FRAMES, { duration: PAW_MS, delay, easing: 'cubic-bezier(0.33, 0, 0.3, 1)' });
  running.set(el, a);
  return true;
}
