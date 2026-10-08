/**
 * Un kompeitō du bocal (Arthur) : on le tire du bocal du bout du doigt, les
 * Noiraudes libres le suivent en troupeau (s'il n'y en a pas, deux ou trois
 * accourent du bord de la feuille) ; lâché, il tombe et rejoint les autres
 * bonbons par terre, que le troupeau ramasse (feast.ts). On peut en lâcher
 * plusieurs d'affilée : chacun est ramassé. Lâcher coûte 1 kompeitō (le
 * bocal s'en charge) ; relâché tout près du bocal, il y retourne, gratuit.
 */
import type { Point } from '../susuwatari';
import { dist } from './cast';
import type { Loose, SootDirector } from './director';
import { BELOW, addCandy, callHerd, setFinger } from './feast';
import { makeItem, randomTone } from './items';

/** Le kompeitō flotte un peu au-dessus du doigt (visible), elles se tiennent dessous. */
const ABOVE = 26;
/** Lâché à moins de ceci du bocal : il y retourne. */
const KEEP = 28;

interface Drag {
  loose: Loose;
  start: Point;
}

const drags = new WeakMap<SootDirector, Drag>();

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
  drags.set(d, { loose, start: p });
  const free = setFinger(d, item);
  if (free < 2) callHerd(d, 3 - free, { x: p.x, y: p.y - ABOVE + BELOW });
}

export function treatMove(d: SootDirector, p: Point): void {
  const drag = drags.get(d);
  if (!drag) return;
  drag.loose.item.x = p.x;
  drag.loose.item.y = p.y - ABOVE;
}

/** Lâché : vrai s'il tombe aux Noiraudes (il coûte alors 1 kompeitō). */
export function treatDrop(d: SootDirector, p: Point): boolean {
  const drag = drags.get(d);
  if (!drag) return false;
  if (dist(p, drag.start) < KEEP) {
    treatCancel(d);
    return false;
  }
  drags.delete(d);
  const item = drag.loose.item;
  d.unloose(drag.loose);
  item.page = true;
  addCandy(d, d.drop(item, p.x, p.y - ABOVE + BELOW, BELOW - item.r * 0.8));
  setFinger(d, null);
  return true;
}

/** Relâché près du bocal (ou geste interrompu) : il y retourne. */
export function treatCancel(d: SootDirector): void {
  const drag = drags.get(d);
  if (!drag) return;
  drags.delete(d);
  d.unloose(drag.loose);
  const item = drag.loose.item;
  const jar = d.jar?.();
  if (jar) d.fly(item, { x: item.x, y: item.y }, jar, 0.35, undefined, 20);
  setFinger(d, null);
}
