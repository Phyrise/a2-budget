import { describe, expect, it } from 'vitest';
import { Festival, festivalKodama, festivalOf } from './festival';

const ASPECT = 1024 / 1536;

describe('matsuri — kodama', () => {
  it('un peu plus nombreux les jours de fête, sans dépasser les places', () => {
    expect(festivalKodama(2, 8, 0)).toBe(2);
    expect(festivalKodama(2, 8, 1)).toBe(4);
    expect(festivalKodama(0, 8, 1)).toBe(3);
    expect(festivalKodama(7, 8, 1)).toBe(8);
    expect(festivalKodama(0, 2, 1)).toBe(2);
  });
});

describe('matsuri — niveau de fête', () => {
  it('image fixe (Immobile, mouvement réduit) : tout de suite allumé, tout de suite éteint', () => {
    const f = new Festival(ASPECT);
    expect(f.update(true, 10, 0.016, 10, false)).toBe(1);
    expect(f.update(false, 10.1, 0.016, 10.1, false)).toBe(0);
  });

  it('animé : fondu doux vers la fête, puis retour au calme', () => {
    const f = new Festival(ASPECT);
    let level = f.update(true, 0, 1 / 60, 0, true);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(0.1);
    for (let i = 1; i <= 240; i++) level = f.update(true, i / 60, 1 / 60, i / 60, true);
    expect(level).toBe(1);
    for (let i = 241; i <= 600; i++) level = f.update(false, i / 60, 1 / 60, i / 60, true);
    expect(level).toBe(0);
  });

  it('un seul matsuri par moteur', () => {
    const engine = {};
    expect(festivalOf(engine, ASPECT)).toBe(festivalOf(engine, ASPECT));
    expect(festivalOf({}, ASPECT)).not.toBe(festivalOf(engine, ASPECT));
  });
});
