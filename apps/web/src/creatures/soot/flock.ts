/**
 * Le troupeau d'un écran (état et petits gestes partagés par herd.ts et
 * feast.ts) : les Noiraudes venues pour les kompeitō (« membres »), les
 * bonbons au sol, le kompeitō au bout du doigt.
 */
import type { Point } from '../susuwatari';
import type { Actor } from './cast';
import type { Loose, SootDirector } from './director';

/** Au plus ceci de Noiraudes dans le troupeau (celles qui arrivent du bord comprises). */
export const FLOCK_CAP = 8;

export interface Treat {
  id: number;
  loose: Loose;
  /** Au sol (ou en train de tomber) / on se le dispute / en tas (mangé). */
  phase: 'down' | 'squabble' | 'heap';
  /** Posé à (s), fin de la chamaillerie (s). */
  born: number;
  until: number;
}

export interface Member {
  a: Actor;
  target: Treat | null;
  /** Prochaine bousculade (chamaillerie) ou petit pas (attente). */
  jostle: number;
  /** Ne bouge pas avant (elle croque, elle se relève). */
  rest: number;
  /** Sans bonbon ni doigt depuis (s) : elle repart après un instant. */
  idleSince: number;
  /** Dans le tas : ne bouge plus jusqu'à l'écroulement. */
  heap: boolean;
}

export interface Drag {
  loose: Loose;
  start: Point;
}

export interface Flock {
  drag: Drag | null;
  treats: Treat[];
  members: Member[];
  nextId: number;
  recruitAt: number;
  tick: (dt: number, time: number) => void;
}

/** Encore là, visible, ni attrapée ni en fuite. */
export const alive = (d: SootDirector, a: Actor) =>
  d.actors.includes(a) && !a.leaving && !a.caught && a.busy !== 'flee' && a.s.state !== 'flee' && a.s.state !== 'gone';

/** Le bonbon (centre au sol). */
export const spot = (t: Treat): Point => ({ x: t.loose.item.x, y: t.loose.item.y });

/** Repart par le bord le plus proche de la feuille, puis disparaît. */
export function leaveBy(d: SootDirector, a: Actor, speed: number): void {
  const e = d.edges();
  const right = a.s.x > (e.left + e.right) / 2;
  const x = right ? e.right + a.s.scale * 1.5 : e.left - a.s.scale * 1.5;
  a.busy = 'herd';
  a.s.walkTo(x, a.s.y + (d.rand() - 0.5) * 30, { speed, onArrive: () => d.vanish(a, 4) });
  // Bord de la feuille au milieu de la fenêtre (ordinateur) : elle s'y efface.
  a.tick = () => {
    if (!a.leaving && (a.s.x < e.left - a.s.scale * 0.6 || a.s.x > e.right + a.s.scale * 0.6)) d.vanish(a, 4);
  };
  d.later(5000, () => d.actors.includes(a) && d.vanish(a, 3));
}

/** Les nouvelles venues repartent par le bord ; les perchées retournent à leur perchoir. */
export function dismissMember(d: SootDirector, m: Member): void {
  const a = m.a;
  if (!alive(d, a)) return;
  a.s.lookAt(null);
  a.s.setArms('none');
  a.s.held = false;
  a.s.strain = 0;
  if (a.role === 'stray' && a.perch) {
    const p = a.perch;
    const free = () => {
      if (a.busy === 'herd') a.busy = null;
    };
    a.s.walkTo(p.x, p.y, { speed: d.calm ? 45 : 80, onArrive: free });
    d.later(5000, free);
    a.until = Math.max(a.until, d.time + 3);
  } else {
    leaveBy(d, a, d.calm ? 50 : 110);
  }
}

/**
 * Une Noiraude de plus, qui arrive par le bord de la feuille le plus proche
 * de `to` (ou par le bord `side` : -1 gauche, 1 droite).
 */
export function recruit(d: SootDirector, f: Flock, to: Point, side?: -1 | 1): Member {
  const e = d.edges();
  const view = d.view();
  const right = side === undefined ? to.x > (e.left + e.right) / 2 : side > 0;
  const size = 28 + d.rand() * 5;
  const y = Math.min(view.bottom - 6, Math.max(view.top + size, to.y + (d.rand() - 0.5) * 40));
  const a = d.add({ x: right ? e.right + size : e.left - size, y, size }, 'herd');
  a.fadeRate = 6;
  return join(f, a, d.time);
}

export function join(f: Flock, a: Actor, time: number): Member {
  a.busy = 'herd';
  const m: Member = { a, target: null, jostle: 0, rest: 0, idleSince: time, heap: false };
  f.members.push(m);
  return m;
}

export function dropTreat(f: Flock, t: Treat): void {
  const i = f.treats.indexOf(t);
  if (i >= 0) f.treats.splice(i, 1);
  for (const m of f.members) if (m.target === t) m.target = null;
}
