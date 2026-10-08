/**
 * Noiraudes vagabondes (le petit jeu, V4.2, désormais dessinées par le
 * code) : de temps en temps, une Noiraude se pose au bord d'un bloc, loin de
 * tout contrôle, trottine, se dresse, somnole, cligne et suit le doigt des
 * yeux, puis s'efface. Un toucher l'attrape (comme toutes les Noiraudes,
 * voir catch.ts).
 * - parfois elle porte un petit morceau de charbon (la chaufferie) ;
 * - la dorée (rarissime) : attrapée, cinq kompeitō ;
 * - celle qui s'est trompée d'onglet (Courses, Calendrier) regarde partout,
 *   perdue, puis s'en va.
 * Calme (mouvement réduit, forêt « immobile ») : elle apparaît, reste et
 * s'efface, sans trotter.
 */
import type { Actor } from './cast';
import { busy, type SootDirector } from './director';
import { makeItem } from './items';
import { STRAY_SIZE, pickPerch, type Box } from './perch';

const BLOCKS = '.card, .ledger, .sheet-section, .aisle, .paybook, .balance-card, .cal-month, .kiki-empty__art, .kiki-empty__title, .basket, .event-list';
const CONTROLS = 'button, input, textarea, select, a[href], label, [role="checkbox"], [role="button"], [tabindex]:not([tabindex="-1"]), .konpeito-jar';

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

export interface StrayOptions {
  golden?: boolean;
  lost?: boolean;
}

export function spawnStray(d: SootDirector, opts: StrayOptions = {}): Actor | null {
  if (busy()) return null;
  const view = d.view();
  const foreign = (el: Element) => !d.hits.contains(el);
  const blocks = [...document.querySelectorAll(BLOCKS)].filter(foreign).map(boxOf).filter((b) => b.right - b.left > 120);
  const controls = [...document.querySelectorAll(CONTROLS)].filter(foreign).map(boxOf);
  const perch = pickPerch(blocks, controls, view, d.rand, d.calm ? 0 : 56);
  if (perch === null) return null;
  const { w, h } = STRAY_SIZE;
  const x = perch.x + w / 2;
  const y = perch.y + h - 4;
  const a = d.add({ x, y, size: w * (0.94 + d.rand() * 0.06) }, 'stray');
  const s = a.s;
  s.gold = opts.golden === true;
  a.lost = opts.lost === true;
  a.perch = { x, y, x2: x + perch.dx };
  a.fadeRate = d.calm ? 1.6 : 4;
  a.until = d.time + (d.calm ? 7 : 6.5 + d.rand() * 3) + (a.lost ? 1.5 : 0);
  a.next = d.time + 0.6;
  if (!d.calm) s.bounce(0.45);
  if (!s.gold && !a.lost && d.rand() < 0.3) a.load = makeItem('coal', 4.2);
  a.tick = (_a, _dt, time) => life(d, a, time);
  return a;
}

function leave(d: SootDirector, a: Actor): void {
  a.s.wake();
  a.s.lookAt(null);
  d.vanish(a, d.calm ? 1.6 : 2.5);
}

/** Sa petite vie sur le perchoir. */
function life(d: SootDirector, a: Actor, time: number): void {
  if (a.busy !== null || a.caught) return;
  const s = a.s;
  if (time >= a.until) {
    leave(d, a);
    return;
  }
  if (time < a.next || s.state !== 'idle' || s.z > 0) return;
  const r = s.rand();
  if (a.lost) {
    // Perdue : elle regarde à gauche, à droite, en haut… pas son onglet.
    const side = r < 0.5 ? -1 : 1;
    s.lookAt({ x: s.x + side * 300, y: s.y - 40 - s.rand() * 120 });
    if (r > 0.75) s.standFor(0.7);
    a.next = time + 0.45 + s.rand() * 0.6;
    return;
  }
  s.lookAt(null);
  a.next = time + (d.calm ? 2.5 : 1) + s.rand() * 2;
  if (d.calm) return;
  const p = a.perch;
  if (r < 0.5 && p) {
    // Trot jusqu'à l'autre bout du perchoir (sans jamais en sortir).
    const far = Math.abs(s.x - p.x) < Math.abs(s.x - p.x2) ? p.x2 : p.x;
    const to = far + (p.x - far) * s.rand() * 0.25;
    s.walkTo(to, p.y, { speed: 45 + s.rand() * 35 });
  } else if (r < 0.65) {
    s.bounce(0.35 + s.rand() * 0.3);
  } else if (r < 0.85) {
    s.standFor(0.8 + s.rand() * 0.8);
  } else if (r < 0.93 && !a.load) {
    s.sleep(1.4 + s.rand() * 1.4);
    a.next = time + 3;
  }
}
