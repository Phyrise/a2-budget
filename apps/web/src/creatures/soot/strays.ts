/**
 * Noiraudes vagabondes (le petit jeu, V4.2, désormais dessinées par le
 * code) : de temps en temps, une Noiraude se pose au bord d'un bloc, loin de
 * tout contrôle, trottine, se dresse, somnole, cligne et suit le doigt des
 * yeux, puis s'efface. Un toucher l'attrape : elle saute de joie, un
 * kompeitō s'envole vers le bocal, « Noiraudes attrapées : N » augmente.
 * - parfois elle porte un petit morceau de charbon (la chaufferie) ;
 * - la dorée (rarissime) : attrapée, cinq kompeitō ;
 * - celle qui s'est trompée d'onglet (Courses, Calendrier) regarde partout,
 *   perdue, puis s'en va.
 * Calme (mouvement réduit, forêt « immobile ») : elle apparaît, reste et
 * s'efface, sans trotter.
 */
import { playCue } from '../../app/sound';
import { fr } from '../../ui/format';
import { getPlay, playCatch } from '../play';
import type { Actor } from './cast';
import { busy, type SootDirector } from './director';
import { makeItem, randomTone } from './items';
import { STRAY_SIZE, pickPerch, type Box } from './perch';

/** Durée de la joie d'une Noiraude attrapée, bulle comprise (ms). */
export const CAUGHT_MS = 1700;

const BLOCKS = '.card, .ledger, .sheet-section, .aisle, .paybook, .balance-card';
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
  d.giveHit(a, s.gold ? 'Attraper la Noiraude dorée' : 'Attraper la Noiraude');
  a.tick = (_a, _dt, time) => life(d, a, time);
  a.tap = () => catchStray(d, a);
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

/** Le bocal (ou, sans bocal, un peu au-dessus d'elle). */
function giftTarget(d: SootDirector, a: Actor) {
  const jar = d.jar?.();
  if (jar) return { x: jar.x, y: Math.max(-20, jar.y) };
  return { x: a.s.x, y: a.s.y - 90 };
}

/** Attrapée : joie, kompeitō vers le bocal, compteur. */
export function catchStray(d: SootDirector, a: Actor): void {
  if (a.caught || a.leaving) return;
  a.caught = true;
  const s = a.s;
  const golden = s.gold;
  playCatch(golden);
  const total = getPlay().caught;
  const hit = a.hit;
  if (hit) {
    hit.classList.add('is-caught');
    const rect = hit.getBoundingClientRect();
    const align = rect.left < 90 ? 'start' : rect.right > window.innerWidth - 90 ? 'end' : 'center';
    const tally = document.createElement('span');
    tally.className = `susu-stray__tally is-${align}`;
    tally.textContent = fr(`Noiraudes attrapées : ${total}`);
    hit.appendChild(tally);
  }
  if (a.load) {
    d.drop(a.load, s.x + s.facing * 10, s.y, 14, () => undefined);
    a.load = null;
  }
  s.setArms('cheer');
  s.eyes = 'happy';
  const from = s.body();
  const gifts = golden ? 5 : 1;
  for (let i = 0; i < gifts; i++) {
    d.later(120 + i * 140, () => {
      const item = makeItem('konpeito', 5, randomTone(d.rand));
      d.fly(item, { x: from.x, y: from.y - s.scale * 0.6 }, giftTarget(d, a), d.calm ? 0.9 : 0.75, () => d.onGift?.(), 70);
    });
  }
  playCue('konpeito', { delayMs: 650 });
  d.later(CAUGHT_MS - 600, () => d.actors.includes(a) && d.vanish(a, 2.5));
  d.later(CAUGHT_MS, () => {
    hit?.remove();
    if (a.hit === hit) a.hit = null;
    if (d.actors.includes(a)) d.remove(a);
  });
}
