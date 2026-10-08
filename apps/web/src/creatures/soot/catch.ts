/**
 * Attraper une Noiraude (règle simple d'Arthur) : TOUTE Noiraude visible
 * s'attrape d'un toucher — vagabonde, troupeau, procession, porteuse, celle
 * qui traverse, égarée, dorée (voir taps.ts pour le doigt). Elle s'arrête,
 * fait un petit saut, « kyu », « Noiraudes attrapées : N » augmente, un
 * kompeitō s'envole vers le bocal (cinq pour la dorée), puis elle s'efface.
 * Ce qu'elle portait est lâché (`letGo` : son rôle décide — les autres
 * porteuses reprennent la pièce, le bonbon retombe pour le troupeau — sinon
 * l'objet tombe à ses pieds et s'efface).
 */
import { playCue } from '../../app/sound';
import { fr } from '../../ui/format';
import { getPlay, playCatch } from '../play';
import type { Point } from '../susuwatari';
import type { Actor } from './cast';
import type { SootDirector } from './director';
import { makeItem, randomTone } from './items';

/** Durée de la joie d'une Noiraude attrapée, bulle comprise (ms). */
export const CAUGHT_MS = 1700;

/** Le bocal (ou, sans bocal, un peu au-dessus d'elle). */
function giftTarget(d: SootDirector, a: Actor): Point {
  const jar = d.jar?.();
  if (jar) return { x: jar.x, y: Math.max(-20, jar.y) };
  return { x: a.s.x, y: a.s.y - 90 };
}

/** Lâche ce qu'elle porte : son rôle décide (`letGo`), sinon ça tombe et s'efface. */
export function releaseLoad(d: SootDirector, a: Actor): void {
  if (a.letGo) {
    const letGo = a.letGo;
    a.letGo = null;
    letGo();
  }
  const s = a.s;
  const fall = [...(a.load ? [a.load] : []), ...a.extra];
  a.load = null;
  a.extra = [];
  fall.forEach((item, i) => {
    item.page = a.page;
    const l = d.drop(item, s.x + s.facing * (10 + i * 8), s.y, 14 + i * 10, () => d.later(900, () => (l.fading = true)));
  });
  if (a.mate) {
    a.mate.mate = null;
    a.mate = null;
  }
}

/** La bulle « Noiraudes attrapées : N », au-dessus d'elle. */
function tally(d: SootDirector, a: Actor, total: number): void {
  const b = a.s.body();
  const el = document.createElement('span');
  const align = b.x < 90 ? 'start' : b.x > window.innerWidth - 90 ? 'end' : 'center';
  el.className = `susu-tally is-${align}`;
  el.textContent = fr(`Noiraudes attrapées : ${total}`);
  el.style.left = `${Math.round(b.x)}px`;
  el.style.top = `${Math.round(b.y - a.s.scale * 0.75)}px`;
  d.hits.appendChild(el);
  d.later(CAUGHT_MS, () => el.remove());
}

/** Attrapée : saut, « kyu », compteur, kompeitō vers le bocal (faux si déjà prise ou partie). */
export function catchActor(d: SootDirector, a: Actor): boolean {
  if (a.caught || a.leaving || !d.actors.includes(a)) return false;
  a.caught = true;
  a.tick = null;
  const s = a.s;
  const golden = s.gold;
  playCatch(golden);
  tally(d, a, getPlay().caught);
  releaseLoad(d, a);
  // Elle s'arrête là où on l'a attrapée (même en pleine course), et saute.
  s.wake();
  s.place(s.x, s.y);
  s.held = false;
  s.strain = 0;
  s.bounce(1);
  playCue('squeak');
  s.setArms('cheer');
  s.eyes = 'happy';
  const from = s.body();
  const gifts = golden ? 5 : 1;
  for (let i = 0; i < gifts; i++) {
    d.later(120 + i * 140, () => {
      const item = makeItem('konpeito', 5, randomTone(d.rand));
      item.page = false;
      d.fly(item, { x: from.x, y: from.y - s.scale * 0.6 }, giftTarget(d, a), d.calm ? 0.9 : 0.75, () => d.onGift?.(), 70);
    });
  }
  playCue('konpeito', { delayMs: 650 });
  d.later(CAUGHT_MS - 600, () => d.actors.includes(a) && d.vanish(a, 2.5));
  d.later(CAUGHT_MS, () => d.actors.includes(a) && d.remove(a));
  return true;
}
