/**
 * Ce que l'écran dessine sur la toile des Noiraudes, autour d'elles :
 * dessous, les kompeitō au sol ; dessus, ce qu'elles portent au-dessus de
 * la tête (une seule fois pour un portage à deux), ce qui vole et le
 * kompeitō au bout du doigt, et les étincelles de la dorée. La nuit, seuls
 * les yeux (et ce que tient le doigt) restent.
 */
import { loadPoint } from './cast';
import type { SootDirector } from './director';
import { drawGlint, drawItem } from './items';

export function paintUnder(d: SootDirector, ctx: CanvasRenderingContext2D, dpr: number): void {
  if (d.night) return;
  for (const l of d.loose) {
    if (l.mode !== 'fall' && l.mode !== 'ground') continue;
    drawItem(ctx, l.item, l.item.x, l.item.y - l.item.z - l.item.r * 0.8, dpr);
  }
}

export function paintOver(d: SootDirector, ctx: CanvasRenderingContext2D, dpr: number, time: number): void {
  const params = d.layer.params;
  for (const a of d.actors) {
    if (a.s.gold && !d.night) {
      // Étincelles autour de la dorée.
      const b = a.s.body();
      for (let i = 0; i < 3; i++) {
        const ph = time * 1.3 + i * 2.1 + a.s.seed;
        const r = a.s.scale * (0.55 + 0.15 * Math.sin(ph * 1.7));
        drawGlint(ctx, b.x + Math.cos(ph) * r, b.y + Math.sin(ph * 0.8) * r * 0.8, 2 + Math.sin(ph * 3) ** 2 * 2.5, a.s.alpha * (0.4 + 0.6 * Math.sin(ph * 2.3) ** 2), dpr);
      }
    }
    if (!a.load || d.night) continue;
    // Portage à deux : l'objet n'est dessiné qu'une fois.
    if (a.mate && a.mate.load === a.load && a.mate.s.id < a.s.id) continue;
    const p = loadPoint(a, params);
    if (!p) continue;
    const alpha = a.load.alpha;
    a.load.alpha = alpha * a.s.alpha;
    drawItem(ctx, a.load, p.x, p.y, dpr);
    a.load.alpha = alpha;
  }
  for (const l of d.loose) {
    if (l.mode === 'fly') drawItem(ctx, l.item, l.item.x, l.item.y, dpr, d.night ? 0.6 : 0);
    else if (l.mode === 'finger') drawItem(ctx, l.item, l.item.x, l.item.y, dpr, 1);
  }
}
