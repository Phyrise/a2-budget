/**
 * Portage, comme dans le film (les Noiraudes portent le charbon au-dessus
 * de la tête) : quand on coche un virement, deux ou trois Noiraudes sortent
 * de la case et apportent chacune une pièce au Sans-Visage ; quand on le
 * décoche, elles viennent de lui et la rapportent à la case. Parfois l'une
 * peine sous une pièce trop grosse (tassée, elle tremble, avance à peine) :
 * une autre accourt et elles la portent à deux.
 * Le Sans-Visage hors de l'écran : elles partent (ou arrivent) par le bord
 * droit, là où il vient en visite. Décoratif ; rien au calme.
 */
import type { Point } from '../susuwatari';
import { dist, handsUp, type Actor } from './cast';
import { busy, type SootDirector } from './director';
import { makeItem } from './items';

/** Le Sans-Visage à l'écran : ses pieds (sol) et sa bouche (fenêtre, px). */
export interface PortTarget {
  ground: Point;
  mouth: Point;
}

/** Point de la page (suit le défilement d'ici l'arrivée). */
const toPage = (p: Point): Point => ({ x: p.x + window.scrollX, y: p.y + window.scrollY });
const toView = (p: Point): Point => ({ x: p.x - window.scrollX, y: p.y - window.scrollY });

export function porters(d: SootDirector, origin: Point, paid: boolean, target: PortTarget | null): void {
  if (d.calm || busy()) return;
  const view = d.view();
  const away = { x: window.innerWidth + 50, y: Math.min(view.bottom - 10, Math.max(view.top + 50, origin.y)) };
  const home = toPage(target ? target.ground : away);
  const box = toPage(origin);
  const mouth = target ? toPage(target.mouth) : null;
  const start = paid ? box : home;
  const end = paid ? home : box;
  const n = d.rand() < 0.5 ? 2 : 3;
  const strain = d.rand() < 0.35;
  const speed = Math.max(75, Math.min(160, dist(start, end) / 3.6));
  const crew: Actor[] = [];
  const offset = (i: number) => ({ x: (i - (n - 1) / 2) * 24, y: (i % 2) * 7 - 3 });

  const arrive = (a: Actor) => {
    const s = a.s;
    if (s.x > window.innerWidth) {
      d.remove(a);
      if (a.mate) d.remove(a.mate);
      return;
    }
    const item = a.load;
    a.load = null;
    const team = a.mate ? [a, a.mate] : [a];
    if (a.mate) a.mate.load = null;
    if (item) {
      const hands = handsUp(s, d.layer.params);
      if (paid && mouth) {
        // Dans la bouche du Sans-Visage.
        d.fly(item, { x: hands.x, y: hands.y - item.r }, toView(mouth), 0.45, undefined, 26);
      } else {
        // Posée sur la case : elle s'y efface.
        const l = d.drop(item, s.x + s.facing * 6, s.y, s.scale * 0.9, () => (l.fading = true));
      }
    }
    for (const t of team) {
      t.s.setArms('cheer');
      t.s.strain = 0;
      t.s.bounce(0.6);
      d.later(750, () => d.actors.includes(t) && d.vanish(t, 3));
    }
  };

  const walk = (a: Actor, i: number, pace: number) => {
    const o = offset(i);
    const to = toView(end);
    a.s.walkTo(to.x + o.x, to.y + o.y, { speed: pace, onArrive: () => arrive(a) });
  };

  for (let i = 0; i < n; i++) {
    const big = strain && i === 0;
    const helper = strain && i === n - 1;
    d.later(helper ? 900 : i * 170, () => {
      if (busy()) return;
      const o = offset(i);
      const from = toView(start);
      const a = d.add({ x: from.x + o.x, y: from.y + o.y, size: 26 + d.rand() * 4 }, 'porter');
      a.fadeRate = 5;
      crew[i] = a;
      if (!helper) {
        a.load = makeItem('coin', big ? 9.5 : 5.5);
        a.s.setArms('up');
        a.s.strain = big ? 1 : 0;
        walk(a, i, big ? 30 : speed * (0.92 + d.rand() * 0.16));
        return;
      }
      a.tick = () => help(a);
    });
  }

  /** L'aide accourt sous la grosse pièce, puis elles la portent à deux. */
  const help = (a: Actor) => {
    const lead = crew[0];
    if (!lead || !d.actors.includes(lead) || lead.leaving || !lead.load) {
      if (!a.leaving && !a.mate) d.vanish(a, 3);
      return;
    }
    const side = { x: lead.s.x - lead.s.facing * lead.s.scale * 0.85, y: lead.s.y + 2 };
    if (a.mate !== lead) {
      if (dist(a.s, side) < 8) {
        a.mate = lead;
        lead.mate = a;
        a.load = lead.load;
        a.s.setArms('up');
        lead.s.strain = 0.15;
        walk(lead, 0, speed * 0.85);
      } else if (!a.s.goal || dist(a.s.goal, side) > 6) a.s.walkTo(side.x, side.y, { speed: 150 });
      return;
    }
    // À deux : elle reste à côté de la meneuse.
    if (dist(a.s, side) > 3 && (!a.s.goal || dist(a.s.goal, side) > 3)) a.s.walkTo(side.x, side.y, { speed: 220 });
  };
}

/**
 * La Noiraude qui traverse (un montant a changé) : en bas de l'écran, un
 * kompeitō au-dessus de la tête, de gauche à droite (≈ 2 s).
 */
export function runner(d: SootDirector, tone: Parameters<typeof makeItem>[2]): Actor | null {
  if (d.calm || busy()) return null;
  const lane = d.lane();
  const size = 30;
  const a = d.add({ x: lane.left - size, y: lane.y, size }, 'runner', false);
  a.fadeRate = 8;
  a.load = makeItem('konpeito', 5.5, tone);
  a.load.page = false;
  a.s.setArms('up');
  a.s.walkTo(lane.right + size * 2, lane.y, { speed: 200, onArrive: () => d.remove(a) });
  a.tick = () => {
    if (a.s.x > lane.right + size) d.remove(a);
  };
  return a;
}
