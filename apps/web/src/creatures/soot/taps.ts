/**
 * Le doigt sur les Noiraudes : un toucher attrape (catch.ts), et c'est tout
 * (Arthur : plus d'appui long, de poussée ni de doigt immobile).
 *
 * Pas un bouton par Noiraude : un seul écouteur, en phase de capture sur la
 * fenêtre, cherche au moment où le doigt se pose la Noiraude visible la plus
 * proche dans une zone généreuse (au moins 44 px de diamètre à la souris,
 * 64 px au doigt, plus si elle est grosse) : la zone suit donc la Noiraude
 * en mouvement, et rien n'est réécrit dans la page à chaque image.
 * - Le doigt se lève sans avoir glissé (≤ SLOP px, ≤ TAP_MS) : attrapée ;
 *   ce toucher ne va pas à la page (ni pointerdown/up, ni le clic qui suit).
 * - Le navigateur reprend le doigt (pointercancel) alors qu'il n'a presque
 *   pas bougé — toucher pendant que la page glisse encore, sur iPhone —
 *   c'est quand même un toucher : attrapée.
 * - Le doigt glisse : la page défile normalement (rien n'est bloqué).
 * - Sur un contrôle (case, bouton, champ, bocal…), le contrôle gagne, sauf
 *   si le doigt est en plein sur la Noiraude (pas une porteuse : celle qui
 *   sort d'une case ne vole jamais le toucher qui la décoche). Rien dans le
 *   bandeau, la navigation ou une feuille ouverte.
 */
import type { Point } from '../susuwatari';
import { dist, type Actor } from './cast';
import type { SootDirector } from './director';

const OUTSIDE = '.app-header, .app-nav, .app-dock, dialog';
const CONTROLS =
  'button, input, textarea, select, a[href], label, summary, [role="checkbox"], [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"])';
/** Le bocal gagne toujours (on y tire un kompeitō). */
const ALWAYS = '.konpeito-jar';
/** Un toucher peut bouger un peu (px), et ne dure pas (ms). */
const SLOP = 14;
const TAP_MS = 700;
/** Le clic qui suit un toucher compté est ignoré s'il arrive dans ce délai (ms), à cet endroit (px). */
const ECHO_MS = 800;
const ECHO_PX = 40;
/** Après un pointercancel : le temps de voir si la page défile (ms). */
const CANCEL_WAIT_MS = 120;

/** Rayon de la zone de toucher d'une Noiraude de diamètre `scale` (px) : au moins 22 (32 au doigt). */
export function reach(scale: number, finger = false): number {
  return finger ? Math.max(32, scale * 1.05) : Math.max(22, scale * 0.8);
}

/**
 * La Noiraude visible la plus proche de `p` dans sa zone de toucher, sinon
 * null. `onControl` : le doigt est sur un contrôle, il ne la prend que s'il
 * est en plein sur elle (et pas sur une porteuse).
 */
export function pick(d: SootDirector, p: Point, finger = false, onControl = false): Actor | null {
  let best: Actor | null = null;
  let bestK = Infinity;
  for (const a of d.actors) {
    if (a.caught || a.leaving || a.s.alpha < 0.35 || a.s.state === 'gone') continue;
    if (onControl && a.role === 'porter') continue;
    const k = dist(a.s.body(), p);
    const r = onControl ? a.s.scale * 0.55 : reach(a.s.scale, finger);
    if (k <= r && k < bestK) {
      best = a;
      bestK = k;
    }
  }
  return best;
}

/** Installe le toucher sur la fenêtre ; `onTap` reçoit la Noiraude touchée. Rend le nettoyage. */
export function installTaps(d: SootDirector, onTap: (a: Actor) => void): () => void {
  let press: { id: number; a: Actor; at: Point; last: Point; t: number; scrolled: boolean } | null = null;
  let echo: { at: Point; until: number } | null = null;

  const down = (e: PointerEvent) => {
    press = null;
    if (!e.isPrimary || e.button > 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(OUTSIDE) || target?.closest(ALWAYS)) return;
    const at = { x: e.clientX, y: e.clientY };
    const a = pick(d, at, e.pointerType !== 'mouse', target?.closest(CONTROLS) != null);
    if (!a) return;
    // Ce toucher est pour elle : ni focus, ni sélection, ni la page dessous.
    e.preventDefault();
    e.stopPropagation();
    press = { id: e.pointerId, a, at, last: at, t: e.timeStamp, scrolled: false };
  };
  const move = (e: PointerEvent) => {
    if (press && e.pointerId === press.id) press.last = { x: e.clientX, y: e.clientY };
  };
  const tap = (a: Actor, p: Point, t: number) => {
    echo = { at: p, until: t + ECHO_MS };
    onTap(a);
  };
  const up = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const { a, at, t } = press;
    press = null;
    e.stopPropagation();
    const p = { x: e.clientX, y: e.clientY };
    if (dist(p, at) > SLOP || e.timeStamp - t > TAP_MS) return;
    e.preventDefault();
    tap(a, p, e.timeStamp);
  };
  const scrolled = () => {
    if (press) press.scrolled = true;
  };
  // Repris par le navigateur (la page glissait encore, geste ambigu) : si
  // rien n'a défilé juste après et qu'il n'a presque pas bougé, c'était un
  // toucher (le navigateur ne donne plus la position : on attend un peu).
  const cancel = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    if (dist(p.last, p.at) > SLOP || e.timeStamp - p.t > TAP_MS) {
      press = null;
      return;
    }
    window.setTimeout(() => {
      if (press !== p) return;
      press = null;
      if (!p.scrolled && !p.a.caught) tap(p.a, p.last, performance.now());
    }, CANCEL_WAIT_MS);
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
  window.addEventListener('pointermove', move, { capture: true, passive: true });
  document.addEventListener('scroll', scrolled, { capture: true, passive: true });
  window.addEventListener('pointerup', up, opts);
  window.addEventListener('pointercancel', cancel, opts);
  window.addEventListener('click', click, opts);
  return () => {
    press = null;
    window.removeEventListener('pointerdown', down, opts);
    window.removeEventListener('pointermove', move, opts);
    document.removeEventListener('scroll', scrolled, opts);
    window.removeEventListener('pointerup', up, opts);
    window.removeEventListener('pointercancel', cancel, opts);
    window.removeEventListener('click', click, opts);
  };
}
