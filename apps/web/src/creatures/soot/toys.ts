/**
 * Jouets inutiles (Arthur) : ce que le doigt fait aux Noiraudes perchées.
 * - toucher : rebond et petit cri « kyu » (si les petits sons sont
 *   activés), puis ce que veut son rôle (`tap` : attraper) ;
 * - appui long sur elle : elle tremble, puis s'enfuit hors de l'écran ;
 * - glisser contre elle : le doigt la pousse (elle reste juste devant lui),
 *   puis elle se secoue et retourne à son perchoir ;
 * - doigt immobile ~1,5 s PRÈS d'elle (pas sur un contrôle) : elle vient,
 *   grimpe sur le bout du doigt, le suit, et retombe quand on le lève.
 * Écouteurs passifs sur la fenêtre : rien n'est intercepté hors des
 * boutons transparents des Noiraudes.
 */
import { playCue } from '../../app/sound';
import type { Point } from '../susuwatari';
import { approach, dist, type Actor } from './cast';
import type { SootDirector } from './director';

const LONG_PRESS_MS = 450;
const SHIVER_MS = 650;
const CLIMB_MS = 1500;
const CLIMB_NEAR = 120;
const CONTROLS = 'button, input, textarea, select, a[href], label, [role="checkbox"], [role="button"], [tabindex]:not([tabindex="-1"]), .konpeito-jar';

/** Touchée : rebond, « kyu », puis son rôle (attraper…). */
export function tap(a: Actor): void {
  a.s.bounce(1);
  playCue('squeak');
  a.tap?.();
}

/** Retour au perchoir après un geste (sinon elle reste où elle est). */
function settle(d: SootDirector, a: Actor, delay = 0.3): void {
  d.later(delay * 1000, () => {
    if (!d.actors.includes(a) || a.busy === 'flee') return;
    a.s.eyes = 'open';
    a.s.lookAt(null);
    const p = a.perch;
    if (!p || dist(a.s, p) < 6) {
      a.busy = null;
      return;
    }
    a.s.walkTo(p.x, p.y, { speed: d.calm ? 40 : 70, onArrive: () => (a.busy = null) });
  });
}

/** Le doigt pousse : elle reste à distance du doigt, du côté où elle était. */
function push(a: Actor, p: Point, prev: Point): boolean {
  const s = a.s;
  const b = s.body();
  const reach = s.scale * 0.62;
  let vx = b.x - p.x;
  let vy = b.y - p.y;
  let d = Math.hypot(vx, vy);
  if (d >= reach) return false;
  if (d < 0.5) {
    vx = p.x - prev.x;
    vy = p.y - prev.y;
    d = Math.hypot(vx, vy) || 1;
  }
  const k = (reach - d) / d;
  s.x += vx * k;
  s.y += vy * k * 0.7;
  if (Math.abs(vx) > 0.5) s.facing = vx > 0 ? 1 : -1;
  s.eyes = 'wide';
  s.lookAt(p);
  s.standFor(0.5);
  s.squashV += 0.4;
  return true;
}

function flee(d: SootDirector, a: Actor, from: Point): void {
  a.busy = 'flee';
  a.s.shiver(SHIVER_MS, () => {
    playCue('squeak');
    d.dropHit(a);
    if (a.load) {
      d.drop(a.load, a.s.x, a.s.y, 16, () => undefined);
      a.load = null;
    }
    a.s.flee(from, { view: d.layer.view(), onGone: () => d.remove(a) });
  });
}

/** Gestes sur la cible transparente d'une Noiraude perchée. */
export function bindToys(d: SootDirector, a: Actor, b: HTMLButtonElement): void {
  let press: { id: number; at: Point; start: Point; timer: number; long: boolean; pushed: boolean } | null = null;
  let swallow = false;
  b.addEventListener('pointerdown', (e) => {
    swallow = false;
    if (a.caught || a.busy === 'flee' || a.busy === 'climb') return;
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      // Pointeur déjà relâché.
    }
    const p = { x: e.clientX, y: e.clientY };
    const timer = window.setTimeout(() => {
      if (!press || press.pushed) return;
      press.long = true;
      flee(d, a, press.at);
    }, LONG_PRESS_MS);
    press = { id: e.pointerId, at: p, start: p, timer, long: false, pushed: false };
  });
  b.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id || press.long) return;
    const p = { x: e.clientX, y: e.clientY };
    if (!press.pushed && dist(p, press.start) > 7) {
      press.pushed = true;
      window.clearTimeout(press.timer);
      a.busy = 'push';
    }
    if (press.pushed) push(a, p, press.at);
    press.at = p;
  });
  const end = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    window.clearTimeout(press.timer);
    swallow = press.long || press.pushed;
    if (press.pushed) {
      a.s.shiver(220);
      settle(d, a, 0.35);
    }
    press = null;
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (swallow) {
      swallow = false;
      return;
    }
    if (a.busy === 'flee') return;
    tap(a);
  });
}

/** Elle vient, grimpe sur le bout du doigt et le suit ; lâchée, elle retombe. */
function climb(d: SootDirector, a: Actor, finger: { p: Point; up: boolean }): () => void {
  const s = a.s;
  a.busy = 'climb';
  let mounted = false;
  const below = () => ({ x: finger.p.x, y: finger.p.y + s.scale * 0.9 });
  const mount = () => {
    if (finger.up) return;
    mounted = true;
    s.held = true;
    s.setArms('cheer');
    s.eyes = 'happy';
  };
  const go = () => s.walkTo(below().x, below().y, { speed: d.calm ? 60 : 130, onArrive: mount });
  go();
  const tick = (dt: number) => {
    if (!mounted) {
      s.lookAt(finger.p);
      if (s.state === 'walk' && s.goal && dist(s.goal, below()) > 6) go();
      return;
    }
    // Assise sur le bout du doigt : le centre du corps juste au-dessus.
    const to = below();
    s.x = approach(s.x, to.x, 14, dt);
    s.y = approach(s.y, to.y, 14, dt);
    const stand = (s.rig.rest + s.rig.lift * s.legs) * s.scale;
    s.z = approach(s.z, Math.max(0, s.y - (finger.p.y - s.scale * 0.55) - stand), 9, dt);
  };
  d.tickers.add(tick);
  return () => {
    d.tickers.delete(tick);
    if (!d.actors.includes(a)) return;
    s.held = false;
    s.setArms('none');
    s.lookAt(null);
    if (mounted) d.later(500, () => d.actors.includes(a) && s.bounce(0.4));
    settle(d, a, mounted ? 0.9 : 0.1);
  };
}

/**
 * Gestes sur la page : doigt immobile près d'une Noiraude (elle grimpe),
 * souris qui glisse contre elle (elle est poussée). Rend le nettoyage.
 */
export function installToys(d: SootDirector): () => void {
  let hold: { id: number; start: Point; finger: { p: Point; up: boolean }; timer: number; release: (() => void) | null } | null = null;
  let last: Point | null = null;
  const root = document.documentElement;
  /** Poussées à la souris : dernier contact (horloge du calque). */
  const pushed = new Map<Actor, number>();
  const unpush = () => {
    for (const [a, at] of pushed) {
      if (d.time - at < 0.4) continue;
      pushed.delete(a);
      if (d.actors.includes(a) && a.busy === 'push') settle(d, a, 0);
    }
  };
  d.tickers.add(unpush);

  const eligible = (a: Actor) => a.role === 'stray' && !a.caught && !a.leaving && a.busy === null && a.s.state !== 'flee';

  const stop = () => {
    if (!hold) return;
    window.clearTimeout(hold.timer);
    hold.finger.up = true;
    hold.release?.();
    hold = null;
    root.classList.remove('soot-holding');
  };

  const onDown = (e: PointerEvent) => {
    stop();
    const target = e.target instanceof Element ? e.target : null;
    if (!e.isPrimary || target?.closest(`.susu-stray, ${CONTROLS}`)) return;
    const p = { x: e.clientX, y: e.clientY };
    let best: Actor | null = null;
    for (const a of d.actors) {
      if (!eligible(a)) continue;
      const b = a.s.body();
      const k = dist(b, p);
      if (k > a.s.scale * 0.6 && k < CLIMB_NEAR && (!best || k < dist(best.s.body(), p))) best = a;
    }
    if (!best) return;
    const chosen = best;
    const finger = { p, up: false };
    root.classList.add('soot-holding');
    const timer = window.setTimeout(() => {
      if (hold && eligible(chosen)) hold.release = climb(d, chosen, finger);
    }, CLIMB_MS);
    hold = { id: e.pointerId, start: p, finger, timer, release: null };
  };

  const onMove = (e: PointerEvent) => {
    const p = { x: e.clientX, y: e.clientY };
    if (hold && e.pointerId === hold.id) {
      if (hold.release) hold.finger.p = p;
      else if (dist(p, hold.start) > 12) stop();
    }
    // Souris (bouton enfoncé) qui glisse contre une Noiraude : elle est poussée.
    const target = e.target instanceof Element ? e.target : null;
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 1 && last && !target?.closest('.susu-stray')) {
      for (const a of d.actors) {
        const free = a.busy === null || (a.busy === 'push' && pushed.has(a));
        if (free && a.role === 'stray' && !a.caught && push(a, p, last)) {
          a.busy = 'push';
          pushed.set(a, d.time);
        }
      }
    }
    last = p;
  };
  const onUp = (e: PointerEvent) => {
    if (hold && e.pointerId === hold.id) stop();
    last = null;
  };

  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  return () => {
    stop();
    d.tickers.delete(unpush);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}
