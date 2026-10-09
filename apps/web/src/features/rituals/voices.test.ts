import { COMPANION_IDS } from '@a2/core';
import { describe, expect, it } from 'vitest';
import { circleClosingLine, companionsGesture, lanternDoneLine } from './voices';

const SEEDS = ['s1', 's2', 's3', 's4', 's5', 's6'];

describe('mots des rituels (V5.6)', () => {
  it('nomment les compagnons choisis, avec le geste de chacun', () => {
    expect(companionsGesture({ a: 'jiji', b: 'calcifer' })).toBe('Jiji hoche la tête, Calcifer crépite');
    expect(companionsGesture({ a: 'teto', b: 'hin' })).toBe('Teto agite la queue, Hin soupire');
    const both = SEEDS.map((s) => lanternDoneLine('both', 25, true, s, { a: 'hin', b: 'teto' }));
    expect(both.some((l) => l.startsWith('Hin soupire, Teto agite la queue'))).toBe(true);
    expect(both.join(' ')).not.toMatch(/Jiji|Calcifer/);
  });

  it('chaque compagnon a ses mots de lanterne et de cercle', () => {
    for (const id of COMPANION_IDS) {
      const other = id === 'jiji' ? 'calcifer' : 'jiji';
      for (const completed of [true, false]) {
        for (const s of SEEDS) expect(lanternDoneLine('a', 25, completed, s, { a: id, b: other }).length).toBeGreaterThan(0);
      }
      const c = circleClosingLine('c1', { a: id, b: other });
      expect(c.a.length).toBeGreaterThan(0);
    }
  });

  it('la voix suit le compagnon choisi (et non le rôle)', () => {
    const asHin = SEEDS.map((s) => lanternDoneLine('a', 25, true, s, { a: 'hin', b: 'calcifer' }));
    expect(asHin.join(' ')).toMatch(/Hin|soupire/);
    const asTeto = SEEDS.map((s) => circleClosingLine(s, { a: 'jiji', b: 'teto' }).b);
    const asCalcifer = SEEDS.map((s) => circleClosingLine(s).b);
    expect(asTeto).not.toEqual(asCalcifer);
  });
});
