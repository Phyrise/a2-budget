/**
 * Un kompeitō du bocal (Arthur) : on le tire du bocal du bout du doigt, les
 * Noiraudes visibles le suivent en troupeau (s'il n'y en a pas, deux ou
 * trois accourent du bord) ; lâché, il tombe, elles se ruent dessus et se
 * chamaillent ; puis l'une repart avec (avec deux, s'ils étaient collés),
 * ou elles finissent en tas, qui s'écroule. Lâcher coûte 1 kompeitō (le
 * bocal s'en charge) ; relâché tout près du bocal, il y retourne, gratuit.
 */
import type { Point } from '../susuwatari';
import { dist, type Actor } from './cast';
import type { Loose, SootDirector } from './director';
import { makeItem, randomTone } from './items';

/** Le kompeitō flotte un peu au-dessus du doigt (visible), elles se tiennent dessous. */
const ABOVE = 26;
const BELOW = 56;
/** Lâché à moins de ceci du bocal : il y retourne. */
const KEEP = 28;

type Phase = 'drag' | 'rush' | 'squabble' | 'end';

interface Treat {
  loose: Loose;
  start: Point;
  herd: Actor[];
  /** Places autour du kompeitō (ordre du troupeau). */
  slots: Point[];
  phase: Phase;
  ground: Point | null;
  until: number;
  jostle: Map<Actor, number>;
  tick: (dt: number, time: number) => void;
}

const treats = new WeakMap<SootDirector, Treat>();

const alive = (d: SootDirector, a: Actor) => d.actors.includes(a) && !a.leaving && a.s.state !== 'flee';

/** Les nouvelles venues repartent par le bord ; les perchées retournent à leur perchoir. */
function disperse(d: SootDirector, t: Treat, except: Actor | null = null): void {
  for (const a of t.herd) {
    if (a === except || !alive(d, a)) continue;
    a.s.lookAt(null);
    a.s.setArms('none');
    if (a.role === 'stray' && a.perch) {
      const p = a.perch;
      a.s.walkTo(p.x, p.y, { speed: d.calm ? 45 : 80, onArrive: () => (a.busy = null) });
      a.until = Math.max(a.until, d.time + 3);
    } else {
      leaveBy(d, a, d.calm ? 50 : 110);
    }
  }
}

/** Repart par le bord le plus proche, puis disparaît. */
function leaveBy(d: SootDirector, a: Actor, speed: number): void {
  const right = a.s.x > window.innerWidth / 2;
  const x = right ? window.innerWidth + a.s.scale * 2 : -a.s.scale * 2;
  a.s.walkTo(x, a.s.y + (d.rand() - 0.5) * 30, { speed, onArrive: () => d.remove(a) });
  d.later(4500, () => d.actors.includes(a) && d.vanish(a, 3));
}

function finish(d: SootDirector, t: Treat): void {
  t.phase = 'end';
  d.tickers.delete(t.tick);
  if (treats.get(d) === t) treats.delete(d);
}

export function treatStart(d: SootDirector, p: Point): void {
  treatCancel(d);
  const item = makeItem('konpeito', 6, randomTone(d.rand));
  item.page = false;
  // Parfois deux kompeitō collés : un seul est compté.
  item.pair = d.rand() < 0.22;
  Object.assign(item, { x: p.x, y: p.y - ABOVE });
  const loose: Loose = { item, mode: 'finger' };
  d.loose.push(loose);
  d.layer.wake();

  const herd = d.actors.filter((a) => a.role === 'stray' && !a.caught && !a.leaving && a.busy === null).slice(0, 6);
  for (const a of herd) a.busy = 'herd';
  const view = d.view();
  const want = herd.length >= 2 ? 0 : 3 - herd.length;
  for (let i = 0; i < want; i++) {
    const right = p.x < window.innerWidth / 2 ? i % 2 === 1 : i % 2 === 0;
    const size = 28 + d.rand() * 5;
    const y = Math.min(view.bottom - 6, Math.max(view.top + size, p.y + BELOW + (d.rand() - 0.5) * 40));
    const a = d.add({ x: right ? window.innerWidth + size * (1 + i) : -size * (1 + i), y, size }, 'herd');
    a.fadeRate = 6;
    a.busy = 'herd';
    herd.push(a);
  }
  const slots = herd.map((_, i) => ({ x: (i % 2 === 0 ? 1 : -1) * (14 + Math.floor((i + 1) / 2) * 26) - 7, y: (i % 3) * 7 }));
  const t: Treat = { loose, start: p, herd, slots, phase: 'drag', ground: null, until: 0, jostle: new Map(), tick: () => undefined };
  t.tick = (dt, time) => step(d, t, dt, time);
  d.tickers.add(t.tick);
  treats.set(d, t);
}

export function treatMove(d: SootDirector, p: Point): void {
  const t = treats.get(d);
  if (!t || t.phase !== 'drag') return;
  t.loose.item.x = p.x;
  t.loose.item.y = p.y - ABOVE;
}

/** Lâché : vrai s'il tombe aux Noiraudes (il coûte alors 1 kompeitō). */
export function treatDrop(d: SootDirector, p: Point): boolean {
  const t = treats.get(d);
  if (!t || t.phase !== 'drag') return false;
  if (dist(p, t.start) < KEEP) {
    treatCancel(d);
    return false;
  }
  const item = t.loose.item;
  d.unloose(t.loose);
  item.page = true;
  const ground = { x: p.x, y: p.y - ABOVE + BELOW };
  t.loose = d.drop(item, ground.x, ground.y, BELOW - item.r * 0.8);
  t.ground = ground;
  t.phase = 'rush';
  for (const [i, a] of t.herd.entries()) {
    if (!alive(d, a)) continue;
    const o = t.slots[i] ?? { x: 0, y: 0 };
    a.s.setArms('none');
    a.s.walkTo(ground.x + o.x * 0.45, ground.y + o.y * 0.5, { speed: d.calm ? 70 : 210 });
  }
  return true;
}

/** Relâché près du bocal (ou geste interrompu) : il y retourne. */
export function treatCancel(d: SootDirector): void {
  const t = treats.get(d);
  if (!t) return;
  if (t.phase === 'drag') {
    d.unloose(t.loose);
    const jar = d.jar?.();
    const item = t.loose.item;
    if (jar) d.fly(item, { x: item.x, y: item.y }, jar, 0.35, undefined, 20);
    disperse(d, t);
  }
  finish(d, t);
}

function step(d: SootDirector, t: Treat, dt: number, time: number): void {
  const herd = t.herd.filter((a) => alive(d, a));
  const item = t.loose.item;
  if (t.phase === 'drag') {
    for (const [i, a] of t.herd.entries()) {
      if (!alive(d, a)) continue;
      const o = t.slots[i] ?? { x: 0, y: 0 };
      const to = { x: item.x + o.x, y: item.y + BELOW + o.y };
      const s = a.s;
      s.lookAt({ x: item.x, y: item.y });
      if (s.state !== 'shiver' && dist(s, to) > 10 && (!s.goal || dist(s.goal, to) > 10)) s.walkTo(to.x, to.y, { speed: d.calm ? 60 : 125 });
      const near = dist(s.body(), item) < s.scale * 1.8;
      s.setArms(near ? 'cheer' : 'none');
      if (near && !d.calm && s.rand() < dt * 0.7) s.bounce(0.3);
    }
    return;
  }
  const g = t.ground;
  if (!g) return;
  if (herd.length === 0) {
    t.loose.fading = true;
    finish(d, t);
    return;
  }
  if (t.phase === 'rush') {
    for (const a of herd) a.s.lookAt({ x: item.x, y: item.y - item.z });
    if (item.z === 0 && herd.some((a) => dist(a.s, g) < 22)) {
      t.phase = 'squabble';
      t.until = time + (d.calm ? 0.8 : 1.4 + d.rand() * 0.9);
    }
    return;
  }
  if (t.phase !== 'squabble') return;
  // Chamaillerie : on se bouscule, on saute, on frémit autour du kompeitō.
  for (const a of herd) {
    const s = a.s;
    s.lookAt({ x: g.x, y: g.y - 6 });
    if (d.calm || time < (t.jostle.get(a) ?? 0) || s.state === 'shiver') continue;
    t.jostle.set(a, time + 0.22 + s.rand() * 0.35);
    const r = s.rand();
    if (r < 0.35) s.bounce(0.3 + s.rand() * 0.3);
    else if (r < 0.75) s.walkTo(g.x + (s.rand() - 0.5) * 34, g.y + (s.rand() - 0.5) * 10, { speed: 170 });
    else s.shiver(160);
  }
  if (time >= t.until) outcome(d, t, herd);
}

function outcome(d: SootDirector, t: Treat, herd: Actor[]): void {
  const g = t.ground!;
  const item = t.loose.item;
  const heap = !d.calm && !item.pair && herd.length >= 2 && d.rand() < 0.45;
  if (!heap) {
    // L'une repart avec (avec les deux, s'ils étaient collés).
    const winner = herd[Math.floor(d.rand() * herd.length)]!;
    d.unloose(t.loose);
    winner.load = item;
    winner.s.eyes = 'happy';
    winner.s.bounce(0.5);
    leaveBy(d, winner, d.calm ? 50 : 105);
    for (const a of herd) if (a !== winner) a.s.bounce(0.25);
    disperse(d, t, winner);
    finish(d, t);
    return;
  }
  // En tas : deux en bas, une ou deux au-dessus… puis tout s'écroule.
  t.phase = 'end';
  d.tickers.delete(t.tick);
  const base = Math.min(3, Math.ceil(herd.length / 2));
  herd.forEach((a, i) => {
    const row = i < base ? 0 : i < base + 2 ? 1 : 2;
    const k = row === 0 ? i : row === 1 ? i - base : 0;
    const per = row === 0 ? base : row === 1 ? Math.min(2, herd.length - base) : 1;
    const S = a.s.scale;
    const x = g.x + (k - (per - 1) / 2) * S * 0.62;
    a.s.walkTo(x, g.y + 2 + row * 0.5, {
      speed: 140,
      onArrive: () => {
        a.s.held = row > 0;
        a.s.z = row * S * 0.5;
        a.s.eyes = row === 2 ? 'happy' : 'closed';
        a.s.setArms(row === 2 ? 'cheer' : 'none');
        a.s.strain = row === 0 ? 0.5 : 0.2;
      },
    });
  });
  d.later(2300, () => {
    // Le tas s'écroule ; le kompeitō a disparu (mangé).
    t.loose.fading = true;
    for (const a of herd) {
      if (!d.actors.includes(a)) continue;
      a.s.held = false;
      a.s.strain = 0;
      a.s.eyes = 'wide';
      d.later(450, () => d.actors.includes(a) && (a.s.bounce(0.35), (a.s.eyes = 'happy')));
    }
    d.later(1100, () => disperse(d, t));
    if (treats.get(d) === t) treats.delete(d);
  });
}
