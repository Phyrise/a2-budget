/**
 * La procession (rare, jamais annoncée) : une trentaine de petites
 * Noiraudes traversent l'écran à la file, en bas, en marchant sur le haut de
 * la navigation ; quelques-unes portent un morceau de charbon ou un
 * kompeitō, d'autres sautillent. Chacune s'attrape d'un toucher (sa cible
 * s'arrête à ses pieds : la navigation reste libre). Rien au calme.
 */
import type { Actor } from './cast';
import { busy, type SootDirector } from './director';
import { makeItem, randomTone } from './items';

export function procession(d: SootDirector): boolean {
  if (d.calm || busy() || d.count('parade') > 0) return false;
  const lane = d.lane();
  const n = 28 + Math.floor(d.rand() * 6);
  const dir = d.rand() < 0.5 ? 1 : -1;
  const speed = 64 + d.rand() * 8;
  let x = dir > 0 ? lane.left - 16 : lane.right + 16;
  const end = dir > 0 ? lane.right + 80 : lane.left - 80;
  const out = (a: Actor) => (dir > 0 ? a.s.x > lane.right + a.s.scale : a.s.x < lane.left - a.s.scale);
  for (let i = 0; i < n; i++) {
    const size = 19 + d.rand() * 9;
    x -= dir * (size * 0.8 + d.rand() * 9);
    const a = d.add({ x, y: lane.y + d.rand() * 2, size }, 'parade', false, 'Attraper une Noiraude de la procession');
    a.fadeRate = 8;
    const r = d.rand();
    if (r < 0.22) a.load = makeItem('coal', 3.4);
    else if (r < 0.32) a.load = makeItem('konpeito', 3.6, randomTone(d.rand));
    if (a.load) a.load.page = false;
    a.s.walkTo(end, lane.y, { speed: speed * (0.97 + d.rand() * 0.06), onArrive: () => d.remove(a) });
    a.tick = (_a, dt) => {
      if (out(a)) d.remove(a);
      else if (!a.load && a.s.z === 0 && a.s.rand() < dt * 0.12) a.s.bounce(0.3);
    };
  }
  return true;
}
