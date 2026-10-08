/**
 * Aides des tests navigateur pour les Noiraudes vivantes : elles sont
 * dessinées sur une toile (aucun élément par Noiraude), la toile porte son
 * chef d'orchestre (`canvas.noiraudes`) ; on touche une Noiraude là où elle
 * est à l'instant, comme le ferait un doigt.
 */
import type { Page } from '@playwright/test';

export interface SootView {
  role: string;
  /** Centre du corps (là où le doigt la touche). */
  x: number;
  y: number;
  /** Pieds. */
  fx: number;
  fy: number;
  scale: number;
  alpha: number;
  caught: boolean;
}

/** Les Noiraudes de la scène de cet écran (sauf celles qui s'en vont). */
export function sootActors(page: Page, screen = 'budget'): Promise<SootView[]> {
  return page.evaluate((screen) => {
    type A = { role: string; caught: boolean; leaving: boolean; s: { x: number; y: number; scale: number; alpha: number; body(): { x: number; y: number } } };
    const c = document.querySelector(`.soot-stage[data-screen="${screen}"] canvas`) as (HTMLCanvasElement & { noiraudes?: { actors: A[] } }) | null;
    return (c?.noiraudes?.actors ?? [])
      .filter((a) => !a.leaving)
      .map((a) => {
        const b = a.s.body();
        return { role: a.role, x: b.x, y: b.y, fx: a.s.x, fy: a.s.y, scale: a.s.scale, alpha: a.s.alpha, caught: a.caught };
      });
  }, screen);
}

/** Kompeitō lâchés : ramassés (ou mangés en tas), effacés faute de preneuse, encore par terre. */
export function treats(page: Page): Promise<{ picked: number; expired: number; down: number }> {
  return page.evaluate(() => {
    type Scene = {
      score: { picked: number; expired: number };
      loose: Array<{ item: { kind: string }; mode: string; fading?: boolean }>;
    };
    const c = document.querySelector('.soot-stage[data-screen="budget"] canvas') as (HTMLCanvasElement & { noiraudes?: Scene }) | null;
    const d = c?.noiraudes;
    if (!d) return { picked: -1, expired: -1, down: -1 };
    const down = d.loose.filter((l) => l.item.kind === 'konpeito' && (l.mode === 'ground' || l.mode === 'fall') && !l.fading).length;
    return { ...d.score, down };
  });
}

/** Touche (souris, ou doigt) la première Noiraude visible de ce rôle, là où elle est. */
export async function tapNoiraude(page: Page, role: string, how: 'mouse' | 'touch' = 'mouse'): Promise<void> {
  const a = (await sootActors(page)).find((v) => v.role === role && !v.caught && v.alpha > 0.6);
  if (!a) throw new Error(`Aucune Noiraude « ${role} » visible`);
  if (how === 'touch') await page.touchscreen.tap(a.x, a.y);
  else await page.mouse.click(a.x, a.y);
}
