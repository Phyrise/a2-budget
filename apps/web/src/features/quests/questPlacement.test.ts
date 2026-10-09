import { describe, expect, it } from 'vitest';
import { PERCHES, QUEST_SIZE, fallbackPlace, findPlace, overlaps, slide, type Perch } from './questPlacement';

const bounds = { left: 4, right: 386, top: 6, bottom: 900 };
const head: Perch = { sel: '.h', edge: 'bottom', align: 'end', inset: 56, sink: 0.1 };

describe('questPlacement', () => {
  it('trois emplacements par onglet, chacun avec au moins un perchoir', () => {
    for (const tab of ['budget', 'courses', 'calendar'] as const) {
      expect(PERCHES[tab]).toHaveLength(3);
      for (const perches of PERCHES[tab]) expect(perches.length).toBeGreaterThan(0);
    }
  });

  it('posé sur le bord bas, depuis la droite, en laissant la place du bocal', () => {
    const place = findPlace([head], [{ x: 20, y: 240, w: 350, h: 30 }], [], bounds);
    expect(place).toEqual({ x: 254, y: 240 + 30 - Math.round(QUEST_SIZE.h * 0.9), perch: 0 });
  });

  it('glisse le long du bord pour éviter un bouton ou du texte', () => {
    const anchor = { x: 20, y: 240, w: 350, h: 30 };
    const button = { x: 230, y: 200, w: 80, h: 60 };
    const place = findPlace([head], [anchor], [button], bounds)!;
    expect(place.perch).toBe(0);
    expect(overlaps({ ...place, w: QUEST_SIZE.w, h: QUEST_SIZE.h }, button)).toBe(false);
    expect(place.x).toBeLessThan(230);
  });

  it('repère absent ou masqué : perchoir suivant', () => {
    const next: Perch = { sel: '.n', edge: 'top', align: 'start', inset: 8, sink: 0.2 };
    const place = findPlace([head, next], [null, { x: 20, y: 500, w: 350, h: 200 }], [], bounds);
    expect(place).toEqual({ x: 28, y: Math.round(500 - QUEST_SIZE.h * 0.8), perch: 1 });
  });

  it('trop bas pour se voir sans long défilement : pas de place', () => {
    expect(findPlace([head], [{ x: 20, y: 1200, w: 350, h: 30 }], [], bounds)).toBeNull();
  });

  it('tout est pris : pas de place (le composant se replie sur le bord de la feuille)', () => {
    const wall = { x: 0, y: 0, w: 400, h: 1000 };
    expect(findPlace([head], [{ x: 20, y: 240, w: 350, h: 30 }], [wall], bounds)).toBeNull();
    const f = fallbackPlace(2, 390);
    expect(f.perch).toBe(-1);
    expect(f.y).toBeLessThan(0);
  });

  it('« after » : juste à droite du repère, jamais hors de la feuille', () => {
    const p: Perch = { sel: '.t', edge: 'bottom', align: 'after', inset: 2 };
    const rs = slide({ x: 300, y: 100, w: 70, h: 40 }, p, { left: 4, right: 386 });
    expect(rs).toHaveLength(0);
    const ok = slide({ x: 30, y: 100, w: 70, h: 40 }, p, { left: 4, right: 386 });
    expect(ok[0]!.x).toBe(102);
    expect(ok.every((r) => r.x + r.w <= 386)).toBe(true);
  });
});
