/**
 * Chef d'orchestre des Noiraudes d'un écran : UNE toile (le calque
 * Susuwatari) posée sur toute la fenêtre, les acteurs (cast.ts), les objets
 * libres (au sol, en vol, au bout du doigt) et les cibles du doigt.
 *
 * - Défilement : celles qui sont posées sur la page défilent avec elle
 *   (`shift`), celles de la bande du bas restent à l'écran.
 * - Toile `pointer-events: none` : seuls les boutons transparents des
 *   Noiraudes perchées (et le bocal, ailleurs) reçoivent les touchers.
 * - Une feuille ouverte, le clavier ou un onglet caché : tout s'efface, plus
 *   rien n'apparaît ; la boucle du calque s'arrête quand il n'y a personne.
 * - Les rôles (strays.ts, porters.ts, herd.ts, parade.ts) et les jouets
 *   (toys.ts) passent par ses méthodes.
 */
import { isTextEntry } from '../../app/useKeyboardOpen';
import { createSusuwatariLayer, type Point, type SusuwatariInit, type SusuwatariLayer } from '../susuwatari';
import { approach, makeActor, type Actor, type Role } from './cast';
import type { Item } from './items';
import { paintOver, paintUnder } from './paint';
import { laneOf, type Box } from './perch';
import { bindToys, installToys } from './toys';

export type SootScreen = 'budget' | 'courses' | 'calendar';

const GRAVITY = 1800;

/** Un objet qui n'est porté par personne. */
export interface Loose {
  item: Item;
  mode: 'fall' | 'ground' | 'fly' | 'finger';
  /** Vol : départ, arrivée, début (s), durée (s), hauteur de l'arc (px). */
  from?: Point;
  to?: Point;
  t0?: number;
  dur?: number;
  arc?: number;
  /** Arrivé (au sol ou au bout du vol). */
  done?: () => void;
  /** S'efface (feuille ouverte, mangé…), puis disparaît. */
  fading?: boolean;
}

function boxOf(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/** Une feuille, le pavé ou le clavier sont ouverts (ou l'onglet est caché). */
export function busy(): boolean {
  return (
    document.visibilityState !== 'visible' ||
    document.querySelector('dialog[open]') !== null ||
    document.querySelector('.app--keyboard') !== null ||
    isTextEntry(document.activeElement)
  );
}

export class SootDirector {
  readonly layer: SusuwatariLayer;
  readonly actors: Actor[] = [];
  readonly loose: Loose[] = [];
  time = 0;
  calm = false;
  night = false;
  readonly rand = Math.random;
  /** Appelé quand le nombre d'acteurs d'un rôle change (attributs de la scène). */
  onCast: (() => void) | null = null;
  /** Appelé au défilement (dx, dy) : le kompeitō au bout du doigt, etc. */
  onScroll: ((dx: number, dy: number) => void) | null = null;
  /** Appelés à chaque image, avant les acteurs (gestes en cours, troupeau). */
  readonly tickers = new Set<(dt: number, time: number) => void>();
  /** Où est le bocal (cible des kompeitō gagnés), s'il y en a un. */
  jar: (() => Point | null) | null = null;
  /** Un kompeitō gagné vient d'arriver au bocal. */
  onGift: (() => void) | null = null;
  private scroll = { x: window.scrollX, y: window.scrollY };
  private readonly timers = new Set<number>();
  private readonly cleanups: Array<() => void> = [];
  private castKey = '';

  constructor(
    canvas: HTMLCanvasElement,
    readonly hits: HTMLElement,
    readonly screen: SootScreen,
  ) {
    this.layer = createSusuwatariLayer(canvas, {
      rim: 1,
      shadow: 0.8,
      idleWhenEmpty: true,
      keepAwake: () => this.loose.length > 0,
      onFrame: (dt, time) => this.frame(dt, time),
      drawUnder: (ctx, dpr) => paintUnder(this, ctx, dpr),
      drawOver: (ctx, dpr, time) => paintOver(this, ctx, dpr, time),
    });
    // Le défilement déplace tout de suite celles qui sont posées sur la page.
    const onScroll = () => this.shift(this.scroll.x - window.scrollX, this.scroll.y - window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    this.cleanups.push(() => window.removeEventListener('scroll', onScroll));
    this.cleanups.push(this.watchGaze(), installToys(this));
    const watch = window.setInterval(() => {
      if (busy()) this.dismiss(document.visibilityState !== 'visible');
    }, 400);
    this.cleanups.push(() => window.clearInterval(watch));
  }

  // ——— Acteurs ———

  add(init: SusuwatariInit, role: Role, page = true): Actor {
    const s = this.layer.spawn(init);
    s.alpha = 0;
    const a = makeActor(s, role, page);
    this.actors.push(a);
    this.layer.wake();
    return a;
  }

  /** S'efface (fondu), puis disparaît. */
  vanish(a: Actor, rate = 2.5): void {
    a.leaving = true;
    a.fadeTo = 0;
    a.fadeRate = rate;
    this.dropHit(a);
  }

  remove(a: Actor): void {
    const i = this.actors.indexOf(a);
    if (i >= 0) this.actors.splice(i, 1);
    this.layer.remove(a.s);
    this.dropHit(a, true);
    if (a.mate) {
      if (a.mate.load === a.load) a.mate.mate = null;
      a.mate = null;
    }
  }

  /** Tout s'efface (feuille ouverte, clavier) ; `now` : sans fondu (onglet caché). */
  dismiss(now = false): void {
    for (const a of [...this.actors]) {
      if (now) this.remove(a);
      else if (!a.leaving) this.vanish(a, 5);
    }
    if (now) this.loose.length = 0;
    else for (const l of this.loose) l.fading = true;
  }

  count(role: Role): number {
    return this.actors.filter((a) => a.role === role && !a.leaving).length;
  }

  /** Cible du doigt (bouton transparent) d'une Noiraude perchée. */
  giveHit(a: Actor, label: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.tabIndex = -1;
    b.className = 'susu-stray';
    b.setAttribute('aria-label', label);
    this.hits.appendChild(b);
    a.hit = b;
    bindToys(this, a, b);
    return b;
  }

  dropHit(a: Actor, force = false): void {
    // Attrapée : le bouton garde sa bulle jusqu'à ce qu'elle disparaisse.
    if (a.hit && (force || !a.caught)) {
      a.hit.remove();
      a.hit = null;
    }
  }

  // ——— Objets libres ———

  /** Fait voler un objet de `from` à `to` (arc), puis `done`. */
  fly(item: Item, from: Point, to: Point, dur: number, done?: () => void, arc = 60): Loose {
    const l: Loose = { item, mode: 'fly', from, to, t0: this.time, dur, arc, ...(done ? { done } : {}) };
    item.x = from.x;
    item.y = from.y;
    this.loose.push(l);
    this.layer.wake();
    return l;
  }

  /** Lâche un objet : il tombe de `z` jusqu'au sol `y`, rebondit, puis `done`. */
  drop(item: Item, x: number, y: number, z: number, done?: () => void): Loose {
    Object.assign(item, { x, y, z, vz: 0 });
    const l: Loose = { item, mode: 'fall', ...(done ? { done } : {}) };
    this.loose.push(l);
    this.layer.wake();
    return l;
  }

  unloose(l: Loose): void {
    const i = this.loose.indexOf(l);
    if (i >= 0) this.loose.splice(i, 1);
  }

  // ——— Repères ———

  /** Zone visible : sous le bandeau, au-dessus de la navigation. */
  view(): Box {
    const header = boxOf(document.querySelector('.app-header'));
    const dock = boxOf(document.querySelector('.app-nav') ?? document.querySelector('.app-dock'));
    const bottom = dock && dock.top > window.innerHeight * 0.6 ? dock.top : window.innerHeight;
    return { left: 0, right: window.innerWidth, top: (header?.bottom ?? 0) + 8, bottom: bottom - 8 };
  }

  lane(): { y: number; left: number; right: number } {
    const dock = boxOf(document.querySelector('.app-nav') ?? document.querySelector('.app-dock'));
    const sheet = boxOf(document.querySelector('.screen-sheet'));
    return laneOf(dock, sheet, window.innerWidth, window.innerHeight);
  }

  later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  setNight(on: boolean): void {
    this.night = on;
    this.layer.setNight(on);
  }

  setCalm(on: boolean): void {
    this.calm = on;
    this.layer.setCalm(on);
  }

  destroy(): void {
    this.tickers.clear();
    this.timers.forEach((t) => window.clearTimeout(t));
    this.cleanups.forEach((c) => c());
    for (const a of [...this.actors]) this.remove(a);
    this.loose.length = 0;
    this.layer.destroy();
  }

  // ——— Boucle ———

  private frame(dt: number, time: number): void {
    this.time = time;
    this.shift(this.scroll.x - window.scrollX, this.scroll.y - window.scrollY);
    this.tickers.forEach((t) => t(dt, time));

    for (const a of [...this.actors]) {
      const s = a.s;
      const step = a.fadeRate * dt;
      s.alpha = s.alpha < a.fadeTo ? Math.min(a.fadeTo, s.alpha + step) : Math.max(a.fadeTo, s.alpha - step);
      if (!a.leaving || s.alpha > 0.02) a.tick?.(a, dt, time);
      // Qui porte garde les bras levés (un rebond les baisse).
      if (a.load && s.armPose !== 'up' && !a.leaving) s.setArms('up');
      if ((a.leaving && s.alpha <= 0.01) || s.state === 'gone') this.remove(a);
    }
    for (const l of [...this.loose]) this.moveLoose(l, dt, time);

    for (const a of this.actors) {
      if (!a.hit) continue;
      const w = a.s.scale * 1.05;
      const h = a.s.scale * 1.35;
      a.hit.style.width = `${w}px`;
      a.hit.style.height = `${h}px`;
      a.hit.style.transform = `translate3d(${a.s.x - w / 2}px, ${a.s.y + 4 - h}px, 0)`;
    }
    const key = (['stray', 'porter', 'herd', 'parade', 'runner'] as const).map((r) => this.count(r)).join(',');
    if (key !== this.castKey) {
      this.castKey = key;
      this.onCast?.();
    }
  }

  private shift(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.scroll = { x: window.scrollX, y: window.scrollY };
    for (const a of this.actors) {
      if (!a.page) continue;
      a.s.shift(dx, dy);
      if (a.perch) {
        a.perch.x += dx;
        a.perch.x2 += dx;
        a.perch.y += dy;
      }
    }
    for (const l of this.loose) {
      if (!l.item.page || l.mode === 'finger') continue;
      l.item.x += dx;
      l.item.y += dy;
      if (l.from) l.from = { x: l.from.x + dx, y: l.from.y + dy };
      if (l.to && l.mode !== 'fly') l.to = { x: l.to.x + dx, y: l.to.y + dy };
    }
    this.onScroll?.(dx, dy);
  }

  private moveLoose(l: Loose, dt: number, time: number): void {
    const it = l.item;
    if (l.mode === 'fall') {
      it.vz -= GRAVITY * dt;
      it.z += it.vz * dt;
      it.spin += dt * 3;
      if (it.z <= 0) {
        it.z = 0;
        // Un petit rebond, puis il reste au sol.
        if (it.vz < -220) it.vz = -it.vz * 0.3;
        else {
          it.vz = 0;
          l.mode = 'ground';
          const done = l.done;
          delete l.done;
          done?.();
        }
      }
    } else if (l.mode === 'fly' && l.from && l.to && l.t0 !== undefined && l.dur) {
      const u = Math.min(1, (time - l.t0) / l.dur);
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      it.x = l.from.x + (l.to.x - l.from.x) * e;
      it.y = l.from.y + (l.to.y - l.from.y) * e - Math.sin(Math.PI * u) * (l.arc ?? 0);
      it.spin += dt * 6;
      if (u >= 1) {
        this.unloose(l);
        l.done?.();
      }
    }
    if (l.fading) {
      it.alpha = approach(it.alpha, 0, 6, dt);
      if (it.alpha < 0.02) this.unloose(l);
    }
  }

  /** Les Noiraudes regardent le doigt (ou la souris), où qu'il soit. */
  private watchGaze(): () => void {
    let release = 0;
    const onMove = (e: PointerEvent) => {
      this.layer.setGaze({ x: e.clientX, y: e.clientY });
      window.clearTimeout(release);
      if (e.pointerType !== 'mouse') release = window.setTimeout(() => this.layer.setGaze(null), 1600);
    };
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget === null && e.pointerType === 'mouse') this.layer.setGaze(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('pointerout', onOut);
    return () => {
      window.clearTimeout(release);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('pointerout', onOut);
    };
  }
}
