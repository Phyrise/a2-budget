/**
 * Les kompeitō du bocal (Arthur) : on en tire un du bout du doigt, les
 * Noiraudes libres le suivent en troupeau (s'il n'y en a pas, deux ou trois
 * accourent du bord de la feuille) ; lâché, il tombe et reste au sol. On
 * peut en lâcher plusieurs : CHACUN est ramassé.
 * - Répartition (forage.ts) : chaque Noiraude libre va vers le bonbon le
 *   moins réservé le plus proche (1 à 3 par bonbon), puis vers le suivant ;
 *   un bonbon que personne ne vise fait venir une Noiraude du bord (au plus
 *   FLOCK_CAP dans le troupeau).
 * - Arrivées : chamaillerie (ou simple bouchée, seule), puis feast.ts.
 * - Aucune ne reste figée : celle qui s'est arrêtée loin de son bonbon
 *   repart ; un bonbon jamais ramassé s'efface en douceur (TREAT_LIFE).
 * - Sans bonbon ni doigt : elles repartent (perchoir ou bord).
 * Lâcher coûte 1 kompeitō (le bocal s'en charge) ; relâché tout près du
 * bocal, il y retourne, gratuit.
 */
import type { Point } from '../susuwatari';
import { dist } from './cast';
import type { Loose, SootDirector } from './director';
import { addTreat, feast } from './feast';
import { FLOCK_CAP, alive, dismissMember, dropTreat, join, recruit, spot, type Flock, type Member, type Treat } from './flock';
import { assignForagers } from './forage';
import { makeItem, randomTone } from './items';

/** Le kompeitō flotte un peu au-dessus du doigt (visible), elles se tiennent dessous. */
const ABOVE = 26;
const BELOW = 56;
/** Lâché à moins de ceci du bocal : il y retourne. */
const KEEP = 28;
/** Arrivée au bonbon (px). */
const NEAR = 22;
/** Un bonbon que personne n'a pris s'efface après ceci (s). */
export const TREAT_LIFE = 16;
/** Sans bonbon ni doigt, elle attend ceci (s) avant de repartir. */
const LINGER = 0.8;

const flocks = new WeakMap<SootDirector, Flock>();

export function flockOf(d: SootDirector): Flock {
  let f = flocks.get(d);
  if (!f) {
    const made: Flock = { drag: null, treats: [], members: [], nextId: 1, recruitAt: 0, tick: () => undefined };
    made.tick = (dt, time) => step(d, made, dt, time);
    d.tickers.add(made.tick);
    flocks.set(d, made);
    f = made;
  }
  return f;
}

/** Places autour du kompeitō au bout du doigt (ordre du troupeau). */
const slot = (i: number): Point => ({ x: (i % 2 === 0 ? 1 : -1) * (14 + Math.floor((i + 1) / 2) * 26) - 7, y: (i % 3) * 7 });
/** Places autour d'un bonbon au sol (1 à 3 Noiraudes). */
const ring = (i: number): Point => [{ x: -13, y: 1 }, { x: 13, y: 2 }, { x: 0, y: 7 }][i % 3]!;

export function treatStart(d: SootDirector, p: Point): void {
  const f = flockOf(d);
  treatCancel(d);
  const item = makeItem('konpeito', 6, randomTone(d.rand));
  item.page = false;
  // Parfois deux kompeitō collés : un seul est compté.
  item.pair = d.rand() < 0.22;
  Object.assign(item, { x: p.x, y: p.y - ABOVE });
  const loose: Loose = { item, mode: 'finger' };
  d.loose.push(loose);
  d.layer.wake();
  f.drag = { loose, start: p };

  // Les vagabondes libres rejoignent le troupeau.
  for (const a of d.actors) {
    if (f.members.length >= FLOCK_CAP) break;
    if (a.role === 'stray' && !a.caught && !a.leaving && a.busy === null) join(f, a, d.time);
  }
  const followers = f.members.filter((m) => m.target === null && !m.heap).length;
  const want = followers >= 2 ? 0 : Math.min(3 - followers, FLOCK_CAP - f.members.length);
  const near: -1 | 1 = p.x < window.innerWidth / 2 ? -1 : 1;
  for (let i = 0; i < want; i++) recruit(d, f, { x: p.x, y: p.y + BELOW }, i % 2 === 0 ? near : near === 1 ? -1 : 1);
}

export function treatMove(d: SootDirector, p: Point): void {
  const drag = flocks.get(d)?.drag;
  if (!drag) return;
  drag.loose.item.x = p.x;
  drag.loose.item.y = p.y - ABOVE;
}

/** Lâché : vrai s'il tombe aux Noiraudes (il coûte alors 1 kompeitō). */
export function treatDrop(d: SootDirector, p: Point): boolean {
  const f = flocks.get(d);
  const drag = f?.drag;
  if (!f || !drag) return false;
  if (dist(p, drag.start) < KEEP) {
    treatCancel(d);
    return false;
  }
  f.drag = null;
  d.unloose(drag.loose);
  addTreat(d, f, drag.loose.item, p.x, p.y - ABOVE + BELOW, BELOW - drag.loose.item.r * 0.8);
  return true;
}

/** Relâché près du bocal (ou geste interrompu) : il y retourne. */
export function treatCancel(d: SootDirector): void {
  const f = flocks.get(d);
  const drag = f?.drag;
  if (!f || !drag) return;
  f.drag = null;
  d.unloose(drag.loose);
  const jar = d.jar?.();
  const item = drag.loose.item;
  if (jar) d.fly(item, { x: item.x, y: item.y }, jar, 0.35, undefined, 20);
}

function step(d: SootDirector, f: Flock, dt: number, time: number): void {
  // Qui est encore là ; quels bonbons restent (mangés, effacés, feuille ouverte).
  f.members = f.members.filter((m) => alive(d, m.a));
  for (const t of [...f.treats]) {
    const gone = !d.loose.includes(t.loose) || t.loose.fading === true;
    if (gone && t.phase !== 'heap') dropTreat(f, t);
    else if (t.phase === 'down' && time - t.born > TREAT_LIFE) t.loose.fading = true;
  }
  if (f.members.length === 0 && f.treats.length === 0 && !f.drag) return;

  // Répartition entre les bonbons au sol.
  const open = f.treats.filter((t) => t.phase !== 'heap');
  const byId = new Map(open.map((t) => [t.id, t]));
  const pool = f.members.filter((m) => !m.heap);
  const plan = assignForagers(
    open.map((t) => ({ id: t.id, ...spot(t) })),
    pool.map((m, i) => ({
      id: i,
      x: m.a.s.x,
      y: m.a.s.y,
      target: m.target?.id ?? null,
      locked: m.target?.phase === 'squabble' && dist(m.a.s, spot(m.target)) < 46,
    })),
  );
  pool.forEach((m, i) => {
    const id = plan.targets.get(i) ?? null;
    m.target = id === null ? null : (byId.get(id) ?? null);
  });

  // Un bonbon que personne ne vise : une Noiraude arrive du bord.
  const lonely = plan.unserved[0];
  if (lonely !== undefined && f.members.length < FLOCK_CAP && time >= f.recruitAt) {
    const t = byId.get(lonely);
    if (t) {
      recruit(d, f, spot(t));
      f.recruitAt = time + (d.calm ? 0.9 : 0.35);
    }
  }

  const claim = new Map<number, number>();
  const done: Member[] = [];
  for (const m of f.members) {
    const a = m.a;
    if (a.busy === null) a.busy = 'herd';
    if (m.heap || a.busy !== 'herd' || time < m.rest) continue;
    const t = m.target;
    if (t) {
      m.idleSince = time;
      const k = claim.get(t.id) ?? 0;
      claim.set(t.id, k + 1);
      seek(d, f, m, t, ring(k), time);
    } else if (f.drag) {
      m.idleSince = time;
      follow(d, f, m, dt);
    } else if (open.length > 0) {
      m.idleSince = time;
      linger(d, m, open, time);
    } else if (time - m.idleSince > LINGER) {
      dismissMember(d, m);
      done.push(m);
    }
  }
  if (done.length > 0) f.members = f.members.filter((m) => !done.includes(m));
}

/** Vers son bonbon ; arrivée : on se le dispute (ou une simple bouchée, seule). */
function seek(d: SootDirector, f: Flock, m: Member, t: Treat, o: Point, time: number): void {
  const s = m.a.s;
  const g = spot(t);
  const item = t.loose.item;
  s.lookAt({ x: g.x, y: g.y - item.z - 6 });
  s.setArms('none');
  const to = { x: g.x + o.x, y: g.y + o.y };
  const far = dist(s, g) > NEAR + 6;
  if (t.phase === 'down') {
    if (far) {
      // Jamais figée : à l'arrêt loin de son bonbon (ou partie ailleurs), elle repart.
      if (s.state !== 'shiver' && (!s.goal || dist(s.goal, to) > 8)) s.walkTo(to.x, to.y, { speed: d.calm ? 70 : 210 });
      return;
    }
    if (t.loose.mode !== 'ground') return;
    const crowd = f.members.filter((x) => x.target === t).length;
    t.phase = 'squabble';
    t.until = time + (d.calm ? 0.8 : crowd > 1 ? 1.2 + d.rand() * 0.8 : 0.45);
    return;
  }
  if (t.phase !== 'squabble') return;
  if (far) {
    if (s.state !== 'shiver' && (!s.goal || dist(s.goal, to) > 8)) s.walkTo(to.x, to.y, { speed: d.calm ? 70 : 210 });
  } else if (!d.calm && time >= m.jostle && s.state !== 'shiver') {
    // Chamaillerie : on se bouscule, on saute, on frémit autour du kompeitō.
    m.jostle = time + 0.22 + s.rand() * 0.35;
    const r = s.rand();
    if (r < 0.35) s.bounce(0.3 + s.rand() * 0.3);
    else if (r < 0.75) s.walkTo(g.x + (s.rand() - 0.5) * 34, g.y + (s.rand() - 0.5) * 10, { speed: 170 });
    else s.shiver(160);
  }
  if (time >= t.until) feast(d, f, t);
}

/** Sous le kompeitō au bout du doigt. */
function follow(d: SootDirector, f: Flock, m: Member, dt: number): void {
  const drag = f.drag!;
  const item = drag.loose.item;
  const i = f.members.filter((x) => x.target === null).indexOf(m);
  const o = slot(Math.max(0, i));
  const to = { x: item.x + o.x, y: item.y + BELOW + o.y };
  const s = m.a.s;
  s.lookAt({ x: item.x, y: item.y });
  if (s.state !== 'shiver' && dist(s, to) > 10 && (!s.goal || dist(s.goal, to) > 10)) s.walkTo(to.x, to.y, { speed: d.calm ? 60 : 125 });
  const near = dist(s.body(), item) < s.scale * 1.8;
  s.setArms(near ? 'cheer' : 'none');
  if (near && !d.calm && s.rand() < dt * 0.7) s.bounce(0.3);
}

/** Tous les bonbons sont pris : elle attend près du plus proche, sautille, regarde. */
function linger(d: SootDirector, m: Member, open: readonly Treat[], time: number): void {
  const s = m.a.s;
  let best = open[0]!;
  for (const t of open) if (dist(s, spot(t)) < dist(s, spot(best))) best = t;
  const g = spot(best);
  s.lookAt({ x: g.x, y: g.y - 6 });
  if (time < m.jostle || s.state === 'shiver') return;
  m.jostle = time + 0.6 + s.rand() * 0.8;
  const side = s.x < g.x ? -1 : 1;
  if (dist(s, g) > 60 || s.rand() < 0.5) s.walkTo(g.x + side * (34 + s.rand() * 18), g.y + (s.rand() - 0.5) * 12, { speed: d.calm ? 50 : 120 });
  else if (!d.calm) s.bounce(0.3);
}
