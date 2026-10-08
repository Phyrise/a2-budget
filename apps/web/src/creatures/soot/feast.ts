/**
 * Les kompeitō par terre et le troupeau qui les ramasse (Arthur : « chaque
 * bonbon posé est ramassé, aucune ne reste figée »).
 *
 * - Chaque bonbon lâché (du bocal, ou par une Noiraude attrapée en le
 *   portant) entre dans la liste ; toutes les Noiraudes libres rejoignent
 *   le troupeau.
 * - Répartition (share.ts) : chaque Noiraude libre court au bonbon non
 *   réservé le plus proche (1 à 3 par bonbon) ; les autres regardent, puis
 *   vont au suivant. Bonbon sans personne : une Noiraude arrive du bord de
 *   la feuille (plafond HERD_CAP).
 * - Arrivées : chamaillerie (seule : elle le ramasse tout de suite), puis
 *   l'une repart avec, ou elles finissent en tas, qui s'écroule (mangé).
 * - Plus de bonbon ni de kompeitō au bout du doigt : elles se dispersent
 *   (les vagabondes retournent à leur perchoir). Un bonbon jamais ramassé
 *   s'efface après CANDY_TTL.
 */
import type { Point } from '../susuwatari';
import { dist, type Actor } from './cast';
import type { Loose, SootDirector } from './director';
import { edgeX, leaveBy, sheetEdges } from './edges';
import { makeItem, randomTone, type Item } from './items';
import { HERD_CAP, reinforcements, share } from './share';

/** Un bonbon jamais ramassé s'efface après ce délai (s). */
export const CANDY_TTL = 14;
/** Le kompeitō au bout du doigt : elles se tiennent dessous. */
export const BELOW = 56;
/** Arrivée près du bonbon (px, des pieds au bonbon). */
const NEAR = 26;
/** Nouvelle répartition au plus tard toutes les … s (sinon dès qu'il y a du changement). */
const SHARE_EVERY = 0.25;
/** Une Noiraude venue du bord au plus toutes les … s. */
const CALL_EVERY = 0.22;
/** Places autour d'un bonbon (pieds), pour une, deux ou trois Noiraudes. */
const SLOTS: readonly Point[] = [
  { x: -15, y: 1 },
  { x: 15, y: 2 },
  { x: 0, y: -8 },
];

interface Candy {
  id: number;
  loose: Loose;
  landedAt: number | null;
  /** Fin de la chamaillerie (s), dès qu'une Noiraude est arrivée. */
  until: number | null;
  heap: boolean;
}

interface Feast {
  candies: Candy[];
  members: Set<Actor>;
  target: Map<Actor, Candy>;
  /** En tas : immobiles jusqu'à l'écroulement. */
  locked: Set<Actor>;
  jostle: Map<Actor, number>;
  /** Kompeitō au bout du doigt (herd.ts) : les libres le suivent. */
  finger: Item | null;
  dirty: boolean;
  nextShare: number;
  nextCall: number;
  running: boolean;
  tick: (dt: number, time: number) => void;
}

let ids = 1;
const feasts = new WeakMap<SootDirector, Feast>();

function feastOf(d: SootDirector): Feast {
  const known = feasts.get(d);
  if (known) return known;
  const f: Feast = {
    candies: [],
    members: new Set(),
    target: new Map(),
    locked: new Set(),
    jostle: new Map(),
    finger: null,
    dirty: true,
    nextShare: 0,
    nextCall: 0,
    running: false,
    tick: (dt, time) => step(d, f, dt, time),
  };
  feasts.set(d, f);
  return f;
}

function wake(d: SootDirector, f: Feast): void {
  f.dirty = true;
  if (f.running) return;
  f.running = true;
  d.tickers.add(f.tick);
}

const alive = (d: SootDirector, a: Actor) => !a.caught && !a.leaving && d.actors.includes(a);

function release(f: Feast, a: Actor): void {
  f.members.delete(a);
  f.target.delete(a);
  f.locked.delete(a);
  f.jostle.delete(a);
  f.dirty = true;
}

/** Toutes les Noiraudes libres (vagabondes au repos, troupeau sans charge) rejoignent le troupeau. */
function rally(d: SootDirector, f: Feast): void {
  for (const a of d.actors) {
    if (a.caught || a.leaving || a.load || f.members.has(a)) continue;
    const free = (a.role === 'stray' && a.busy === null) || a.role === 'herd';
    if (!free) continue;
    a.busy = 'herd';
    f.members.add(a);
  }
  wake(d, f);
}

/** Une Noiraude arrive du bord de la feuille le plus proche de `near`. */
function callOne(d: SootDirector, f: Feast, near: Point): void {
  const edges = sheetEdges(d);
  const view = d.view();
  const size = 28 + d.rand() * 5;
  const right = near.x > (edges.left + edges.right) / 2;
  const y = Math.min(view.bottom - 6, Math.max(view.top + size, near.y + (d.rand() - 0.5) * 50));
  const a = d.add({ x: edgeX(d, right, size, edges), y, size }, 'herd');
  a.fadeRate = 6;
  a.busy = 'herd';
  f.members.add(a);
  f.dirty = true;
}

/** Un kompeitō vient d'être lâché (`loose`, en train de tomber) : à ramasser. */
export function addCandy(d: SootDirector, loose: Loose): void {
  const f = feastOf(d);
  f.candies.push({ id: ids++, loose, landedAt: null, until: null, heap: false });
  rally(d, f);
}

/** Un kompeitō tombe ici (lâché par une Noiraude attrapée, ou par le panneau DEV). */
export function dropCandy(d: SootDirector, item: Item, x: number, y: number, z: number): void {
  item.page = true;
  addCandy(d, d.drop(item, x, y, z));
}

/** DEV : `n` kompeitō tombent du ciel, ici et là dans la feuille. */
export function rain(d: SootDirector, n: number): boolean {
  const view = d.view();
  const { left, right } = sheetEdges(d);
  for (let i = 0; i < n; i++) {
    const x = left + 40 + ((i + 0.2 + d.rand() * 0.6) / n) * (right - left - 80);
    const y = view.top + (view.bottom - view.top) * (0.35 + d.rand() * 0.4);
    dropCandy(d, makeItem('konpeito', 6, randomTone(d.rand)), x, y, 120 + d.rand() * 80);
  }
  return n > 0;
}

/** Le kompeitō au bout du doigt (null : lâché ou rendu). Rend le nombre de Noiraudes libres. */
export function setFinger(d: SootDirector, item: Item | null): number {
  const f = feastOf(d);
  f.finger = item;
  if (item) rally(d, f);
  else wake(d, f);
  let free = 0;
  for (const a of f.members) if (!f.target.has(a) && !f.locked.has(a)) free++;
  return free;
}

/** Fait venir `n` Noiraudes du bord (kompeitō tiré du bocal sans personne pour le suivre). */
export function callHerd(d: SootDirector, n: number, near: Point): void {
  const f = feastOf(d);
  const k = Math.min(n, HERD_CAP - f.members.size);
  for (let i = 0; i < k; i++) callOne(d, f, { x: i % 2 === 0 ? near.x : d.view().right - near.x, y: near.y });
  wake(d, f);
}

function step(d: SootDirector, f: Feast, dt: number, time: number): void {
  for (const a of f.members) if (!alive(d, a)) release(f, a);
  for (const c of f.candies) {
    if (c.landedAt === null && c.loose.mode === 'ground') c.landedAt = time;
    if (!c.heap && c.until === null && c.landedAt !== null && time - c.landedAt > CANDY_TTL) {
      c.loose.fading = true;
      d.score.expired += 1;
    }
  }
  const kept = f.candies.filter((c) => !c.loose.fading && d.loose.includes(c.loose));
  if (kept.length !== f.candies.length) {
    f.candies = kept;
    f.dirty = true;
  }
  for (const [a, c] of f.target) {
    if (c.heap || !f.candies.includes(c)) {
      f.target.delete(a);
      f.dirty = true;
    }
  }
  if (f.dirty || time >= f.nextShare) assign(d, f, time);

  let followers = 0;
  for (const a of f.members) {
    if (f.locked.has(a)) continue;
    const c = f.target.get(a);
    if (c) chase(d, f, a, c);
    else if (f.finger) follow(d, a, f.finger, followers++, dt);
    else if (f.candies.length > 0) watch(d, a, f.candies);
    else disperse(d, f, a);
  }
  for (const c of [...f.candies]) squabble(d, f, c, time);

  if (!f.finger && f.candies.length === 0 && f.members.size === 0) {
    f.running = false;
    d.tickers.delete(f.tick);
  }
}

function assign(d: SootDirector, f: Feast, time: number): void {
  f.dirty = false;
  f.nextShare = time + SHARE_EVERY;
  const open = f.candies.filter((c) => !c.heap);
  const eaters = [...f.members].filter((a) => !f.locked.has(a));
  const plan = share(
    open.map((c) => ({ id: c.id, x: c.loose.item.x, y: c.loose.item.y })),
    eaters.map((a) => ({ id: a.s.id, x: a.s.x, y: a.s.y, target: f.target.get(a)?.id ?? null })),
  );
  const byId = new Map(open.map((c) => [c.id, c]));
  for (const a of eaters) {
    const c = byId.get(plan.targets.get(a.s.id) ?? -1);
    if (!c) f.target.delete(a);
    else if (f.target.get(a) !== c) {
      f.target.set(a, c);
      a.s.setArms('none');
    }
  }
  const first = byId.get(plan.unclaimed[0] ?? -1);
  if (first && time >= f.nextCall && reinforcements(plan.unclaimed.length, f.members.size) > 0) {
    callOne(d, f, { x: first.loose.item.x, y: first.loose.item.y });
    f.nextCall = time + CALL_EVERY;
  }
}

function claimers(f: Feast, c: Candy): Actor[] {
  const out: Actor[] = [];
  for (const [a, t] of f.target) if (t === c) out.push(a);
  return out;
}

/** Court à sa place près du bonbon (et y retourne si on l'en a écartée). */
function chase(d: SootDirector, f: Feast, a: Actor, c: Candy): void {
  const s = a.s;
  const it = c.loose.item;
  s.lookAt({ x: it.x, y: it.y - it.z - 4 });
  if (s.state === 'shiver' || (c.until !== null && dist(s, it) < NEAR * 1.6)) return;
  const slot = SLOTS[claimers(f, c).indexOf(a) % SLOTS.length] ?? SLOTS[0]!;
  const to = { x: it.x + slot.x, y: it.y + slot.y };
  if (dist(s, to) > 6 && (s.state !== 'walk' || !s.goal || dist(s.goal, to) > 8)) s.walkTo(to.x, to.y, { speed: d.calm ? 70 : 200 });
}

/** Suit le kompeitō au bout du doigt, en troupeau dessous. */
function follow(d: SootDirector, a: Actor, it: Item, i: number, dt: number): void {
  const s = a.s;
  const o = { x: (i % 2 === 0 ? 1 : -1) * (14 + Math.floor((i + 1) / 2) * 26) - 7, y: (i % 3) * 7 };
  const to = { x: it.x + o.x, y: it.y + BELOW + o.y };
  s.lookAt({ x: it.x, y: it.y });
  if (s.state !== 'shiver' && dist(s, to) > 10 && (!s.goal || dist(s.goal, to) > 10)) s.walkTo(to.x, to.y, { speed: d.calm ? 60 : 125 });
  const near = dist(s.body(), it) < s.scale * 1.8;
  s.setArms(near ? 'cheer' : 'none');
  if (near && !d.calm && s.rand() < dt * 0.7) s.bounce(0.3);
}

/** En trop pour l'instant : regarde la chamaillerie la plus proche, à côté. */
function watch(d: SootDirector, a: Actor, candies: readonly Candy[]): void {
  const s = a.s;
  let c = candies[0]!;
  for (const k of candies) if (dist(s, k.loose.item) < dist(s, c.loose.item)) c = k;
  const it = c.loose.item;
  const side = s.x < it.x ? -1 : 1;
  const to = { x: it.x + side * 48, y: it.y + 4 };
  s.lookAt({ x: it.x, y: it.y - 6 });
  if (dist(s, to) > 14 && (!s.goal || dist(s.goal, to) > 14)) s.walkTo(to.x, to.y, { speed: d.calm ? 60 : 140 });
}

/** Plus rien à ramasser : les vagabondes retournent à leur perchoir, les autres repartent. */
function disperse(d: SootDirector, f: Feast, a: Actor): void {
  release(f, a);
  const s = a.s;
  s.lookAt(null);
  s.setArms('none');
  if (a.role === 'stray' && a.perch) {
    a.busy = null;
    s.walkTo(a.perch.x, a.perch.y, { speed: d.calm ? 45 : 80 });
    a.until = Math.max(a.until, d.time + 3);
    return;
  }
  leaveBy(d, a, d.calm ? 50 : 110);
}

/** Arrivées au bonbon : chamaillerie, puis l'issue. */
function squabble(d: SootDirector, f: Feast, c: Candy, time: number): void {
  if (c.heap || c.landedAt === null) return;
  const it = c.loose.item;
  const crowd = claimers(f, c);
  const near = crowd.filter((a) => dist(a.s, it) < NEAR * 1.6);
  if (c.until === null) {
    if (!near.some((a) => dist(a.s, it) < NEAR)) return;
    c.until = time + (crowd.length <= 1 ? 0.35 : d.calm ? 0.8 : 1.3 + d.rand() * 0.8);
    return;
  }
  if (near.length === 0) {
    c.until = null;
    return;
  }
  if (time < c.until) {
    // On se bouscule, on saute, on frémit autour du kompeitō.
    if (d.calm || near.length < 2) return;
    for (const a of near) {
      const s = a.s;
      if (time < (f.jostle.get(a) ?? 0) || s.state === 'shiver') continue;
      f.jostle.set(a, time + 0.22 + s.rand() * 0.35);
      const r = s.rand();
      if (r < 0.35) s.bounce(0.3 + s.rand() * 0.3);
      else if (r < 0.75) s.walkTo(it.x + (s.rand() - 0.5) * 34, it.y + (s.rand() - 0.5) * 10, { speed: 170 });
      else s.shiver(160);
    }
    return;
  }
  if (!d.calm && !it.pair && near.length >= 2 && d.rand() < 0.3) pile(d, f, c, near);
  else win(d, f, c, near);
}

/** L'une repart avec (avec les deux, s'ils étaient collés) ; les autres vont au suivant. */
function win(d: SootDirector, f: Feast, c: Candy, near: Actor[]): void {
  const winner = near[Math.floor(d.rand() * near.length)]!;
  d.unloose(c.loose);
  f.candies = f.candies.filter((k) => k !== c);
  release(f, winner);
  const item = c.loose.item;
  winner.load = item;
  // Attrapée en chemin : le bonbon retombe, et le troupeau le reprend.
  winner.letGo = () => {
    if (winner.load !== item) return;
    winner.load = null;
    dropCandy(d, item, winner.s.x + winner.s.facing * 10, winner.s.y, 14);
  };
  winner.s.eyes = 'happy';
  winner.s.bounce(0.5);
  leaveBy(d, winner, d.calm ? 50 : 105);
  for (const a of near) if (a !== winner) a.s.bounce(0.25);
  d.score.picked += 1;
}

/** En tas : deux en bas, une ou deux au-dessus… puis tout s'écroule, le kompeitō est mangé. */
function pile(d: SootDirector, f: Feast, c: Candy, near: Actor[]): void {
  c.heap = true;
  f.dirty = true;
  const it = c.loose.item;
  const g = { x: it.x, y: it.y };
  const base = Math.min(3, Math.ceil(near.length / 2));
  near.forEach((a, i) => {
    f.locked.add(a);
    f.target.delete(a);
    const row = i < base ? 0 : i < base + 2 ? 1 : 2;
    const k = row === 0 ? i : row === 1 ? i - base : 0;
    const per = row === 0 ? base : row === 1 ? Math.min(2, near.length - base) : 1;
    const S = a.s.scale;
    a.s.walkTo(g.x + (k - (per - 1) / 2) * S * 0.62, g.y + 2 + row * 0.5, {
      speed: 140,
      onArrive: () => {
        if (!f.locked.has(a)) return;
        a.s.held = row > 0;
        a.s.z = row * S * 0.5;
        a.s.eyes = row === 2 ? 'happy' : 'closed';
        a.s.setArms(row === 2 ? 'cheer' : 'none');
        a.s.strain = row === 0 ? 0.5 : 0.2;
      },
    });
  });
  d.later(2300, () => {
    c.loose.fading = true;
    d.score.picked += 1;
    for (const a of near) {
      if (!f.locked.has(a)) continue;
      a.s.held = false;
      a.s.strain = 0;
      a.s.eyes = 'wide';
      d.later(450, () => d.actors.includes(a) && (a.s.bounce(0.35), (a.s.eyes = 'happy')));
    }
    // Puis elles redeviennent libres : le bonbon suivant, ou chacune chez soi.
    d.later(1100, () => {
      for (const a of near) f.locked.delete(a);
      wake(d, f);
    });
  });
}
