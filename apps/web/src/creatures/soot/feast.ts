/**
 * Fin d'une chamaillerie autour d'un kompeitō : l'une le croque sur place
 * et file vers le bonbon suivant (s'il en reste), ou repart avec par le
 * bord (le dernier) ; parfois, pour le dernier, elles finissent en tas, qui
 * s'écroule. Attrapée ou enfuie en le portant, elle le lâche : il retombe
 * et le troupeau le reprend.
 */
import { dist } from './cast';
import type { SootDirector } from './director';
import { dropTreat, leaveBy, spot, type Flock, type Member, type Treat } from './flock';
import type { Item } from './items';

/** Pose un bonbon au sol pour le troupeau (lâché, ou tombé des bras). */
export function addTreat(d: SootDirector, f: Flock, item: Item, x: number, y: number, z: number): Treat {
  item.page = true;
  const t: Treat = { id: f.nextId++, loose: d.drop(item, x, y, z), phase: 'down', born: d.time, until: 0 };
  f.treats.push(t);
  return t;
}

export function feast(d: SootDirector, f: Flock, t: Treat): void {
  const g = spot(t);
  const near = f.members.filter((m) => m.target === t && dist(m.a.s, g) < 46);
  if (near.length === 0) {
    t.phase = 'down';
    return;
  }
  const item = t.loose.item;
  const others = f.treats.some((o) => o !== t && o.phase !== 'heap');
  if (!others && !d.calm && !item.pair && near.length >= 2 && d.rand() < 0.4) {
    heap(d, f, t, near);
    return;
  }
  const winner = near[Math.floor(d.rand() * near.length)]!;
  for (const m of near) {
    m.a.s.setArms('none');
    if (m !== winner) m.a.s.bounce(0.25);
  }
  dropTreat(f, t);
  if (others) {
    // Elle le croque sur place, puis tout le monde file vers le suivant.
    t.loose.fading = true;
    winner.a.s.eyes = 'happy';
    winner.a.s.bounce(0.5);
    winner.rest = d.time + 0.45;
    return;
  }
  // Le dernier : elle repart avec (avec les deux, s'ils étaient collés).
  d.unloose(t.loose);
  const a = winner.a;
  f.members.splice(f.members.indexOf(winner), 1);
  a.load = item;
  a.s.eyes = 'happy';
  a.s.bounce(0.5);
  // Attrapée en chemin : le bonbon retombe, le troupeau le reprend.
  a.letGo = () => {
    if (a.load !== item) return;
    a.load = null;
    addTreat(d, f, item, a.s.x + a.s.facing * 8, a.s.y, 16);
  };
  leaveBy(d, a, d.calm ? 50 : 105);
}

/** En tas : deux ou trois en bas, une ou deux au-dessus… puis tout s'écroule. */
function heap(d: SootDirector, f: Flock, t: Treat, herd: Member[]): void {
  t.phase = 'heap';
  const g = spot(t);
  const base = Math.min(3, Math.ceil(herd.length / 2));
  herd.forEach((m, i) => {
    m.heap = true;
    const a = m.a;
    const row = i < base ? 0 : i < base + 2 ? 1 : 2;
    const k = row === 0 ? i : row === 1 ? i - base : 0;
    const per = row === 0 ? base : row === 1 ? Math.min(2, herd.length - base) : 1;
    const S = a.s.scale;
    const x = g.x + (k - (per - 1) / 2) * S * 0.62;
    a.s.walkTo(x, g.y + 2 + row * 0.5, {
      speed: 140,
      onArrive: () => {
        if (!m.heap) return;
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
    dropTreat(f, t);
    for (const m of herd) {
      const a = m.a;
      m.heap = false;
      m.rest = d.time + 1.1;
      if (!d.actors.includes(a)) continue;
      a.s.held = false;
      a.s.strain = 0;
      a.s.eyes = 'wide';
      d.later(450, () => d.actors.includes(a) && (a.s.bounce(0.35), (a.s.eyes = 'happy')));
    }
  });
}
