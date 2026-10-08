/**
 * Le doigt sur les Noiraudes : un toucher attrape (catch.ts), et c'est tout
 * (Arthur : plus d'appui long, de poussée ni de doigt immobile).
 *
 * Pas un bouton par Noiraude : un seul écouteur, en phase de capture sur la
 * fenêtre, cherche au moment où le doigt se pose la Noiraude visible la plus
 * proche dans une zone généreuse (au moins 44 px de diamètre, plus si elle
 * est grosse) : la zone suit donc la Noiraude en mouvement, et rien n'est
 * réécrit dans la page à chaque image.
 * - Le doigt se lève sans avoir glissé (≤ SLOP px, ≤ TAP_MS) : attrapée ;
 *   ce toucher ne va pas à la page (ni pointerdown/up, ni le clic qui suit).
 * - Le doigt glisse : la page défile normalement (rien n'est bloqué).
 * - Sur un contrôle (case, bouton, champ, bocal…), le contrôle gagne :
 *   une porteuse qui sort d'une case ne vole jamais le toucher qui la
 *   décoche. Rien dans le bandeau, la navigation ou une feuille ouverte.
 */
import type { Point } from '../susuwatari';
import { dist, type Actor } from './cast';
import type { SootDirector } from './director';

const OUTSIDE = '.app-header, .app-nav, .app-dock, dialog';
const CONTROLS =
  'button, input, textarea, select, a[href], label, summary, [role="checkbox"], [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"]), .konpeito-jar';
/** Un toucher peut bouger un peu (px), et ne dure pas (ms). */
const SLOP = 14;
const TAP_MS = 700;
/** Le clic qui suit un toucher compté est ignoré s'il arrive dans ce délai (ms), à cet endroit (px). */
const ECHO_MS = 800;
const ECHO_PX = 40;

/** Rayon de la zone de toucher d'une Noiraude de diamètre `scale` (px) : au moins 22. */
export function reach(scale: number): number {
  return Math.max(22, scale * 0.8);
}

/** La Noiraude visible la plus proche de `p` dans sa zone de toucher, sinon null. */
export function pick(d: SootDirector, p: Point): Actor | null {
  let best: Actor | null = null;
  let bestK = Infinity;
  for (const a of d.actors) {
    if (a.caught || a.leaving || a.s.alpha < 0.35 || a.s.state === 'gone') continue;
    const k = dist(a.s.body(), p);
    if (k <= reach(a.s.scale) && k < bestK) {
      best = a;
      bestK = k;
    }
  }
  return best;
}

/** Installe le toucher sur la fenêtre ; `onTap` reçoit la Noiraude touchée. Rend le nettoyage. */
export function installTaps(d: SootDirector, onTap: (a: Actor) => void): () => void {
  let press: { id: number; a: Actor; at: Point; t: number } | null = null;
  let echo: { at: Point; until: number } | null = null;

  const down = (e: PointerEvent) => {
    press = null;
    if (!e.isPrimary || e.button > 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(OUTSIDE) || target?.closest(CONTROLS)) return;
    const at = { x: e.clientX, y: e.clientY };
    const a = pick(d, at);
    if (!a) return;
    // Ce toucher est pour elle : ni focus, ni sélection, ni la page dessous.
    e.preventDefault();
    e.stopPropagation();
    press = { id: e.pointerId, a, at, t: e.timeStamp };
  };
  const up = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const { a, at, t } = press;
    press = null;
    e.stopPropagation();
    const p = { x: e.clientX, y: e.clientY };
    if (dist(p, at) > SLOP || e.timeStamp - t > TAP_MS) return;
    e.preventDefault();
    echo = { at: p, until: e.timeStamp + ECHO_MS };
    onTap(a);
  };
  const cancel = (e: PointerEvent) => {
    if (press && e.pointerId === press.id) press = null;
  };
  const click = (e: MouseEvent) => {
    if (!echo) return;
    if (e.timeStamp > echo.until) {
      echo = null;
      return;
    }
    if (dist({ x: e.clientX, y: e.clientY }, echo.at) > ECHO_PX) return;
    echo = null;
    e.preventDefault();
    e.stopPropagation();
  };

  const opts = { capture: true } as const;
  window.addEventListener('pointerdown', down, opts);
  window.addEventListener('pointerup', up, opts);
  window.addEventListener('pointercancel', cancel, opts);
  window.addEventListener('click', click, opts);
  return () => {
    window.removeEventListener('pointerdown', down, opts);
    window.removeEventListener('pointerup', up, opts);
    window.removeEventListener('pointercancel', cancel, opts);
    window.removeEventListener('click', click, opts);
  };
}
