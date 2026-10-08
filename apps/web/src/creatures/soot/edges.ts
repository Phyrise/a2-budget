/**
 * Arriver et repartir par le bord de la FEUILLE (sur ordinateur, la feuille
 * est au milieu de la fenêtre : les Noiraudes ne traversent pas le fond) :
 * sur téléphone, la feuille touche les bords, elles entrent et sortent de
 * l'écran ; sur ordinateur, elles apparaissent (fondu) juste à son bord et
 * s'y effacent.
 */
import type { Actor } from './cast';
import type { SootDirector } from './director';

/** Bords gauche et droit de la feuille, bornés à la fenêtre. */
export function sheetEdges(d: SootDirector): { left: number; right: number } {
  const { left, right } = d.lane();
  return { left, right };
}

/** Abscisse d'arrivée (ou de départ) d'une Noiraude de taille `size` par ce bord. */
export function edgeX(d: SootDirector, right: boolean, size: number, edges = sheetEdges(d)): number {
  const W = window.innerWidth;
  if (right) return edges.right < W - 4 ? edges.right - size * 0.5 : W + size * 0.7;
  return edges.left > 4 ? edges.left + size * 0.5 : -size * 0.7;
}

/** Repart par le bord de la feuille le plus proche, puis s'efface. */
export function leaveBy(d: SootDirector, a: Actor, speed: number): void {
  const edges = sheetEdges(d);
  const right = a.s.x > (edges.left + edges.right) / 2;
  const x = edgeX(d, right, a.s.scale, edges);
  a.s.walkTo(x, a.s.y + (d.rand() - 0.5) * 30, { speed, onArrive: () => d.vanish(a, 8) });
  d.later(4500, () => d.actors.includes(a) && !a.leaving && d.vanish(a, 3));
}
