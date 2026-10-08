/**
 * Attraper une Noiraude (règle simple d'Arthur) : TOUTE Noiraude visible
 * s'attrape d'un toucher — vagabonde, troupeau, procession, porteuse,
 * égarée, dorée. Elle s'arrête, saute de joie, un kompeitō s'envole vers
 * le bocal (cinq pour la dorée), « Noiraudes attrapées : N » augmente, puis
 * elle s'efface. Ce qu'elle portait est lâché (`letGo` : son rôle décide,
 * sinon l'objet tombe et s'efface).
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

/** Lâche ce qu'elle porte (attrapée, enfuie) : son rôle décide, sinon ça tombe. */
export function releaseLoad(d: SootDirector, a: Actor): void {
  if (!a.load && a.extra.length === 0) return;
  if (a.letGo) {
    a.letGo();
    a.letGo = null;
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

/** Attrapée : joie, kompeitō vers le bocal, compteur. */
export function catchActor(d: SootDirector, a: Actor): void {
  if (a.caught || a.leaving || a.busy === 'flee') return;
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
  releaseLoad(d, a);
  // Elle s'arrête là où on l'a attrapée (même en pleine course).
  s.place(s.x, s.y);
  s.held = false;
  s.strain = 0;
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
