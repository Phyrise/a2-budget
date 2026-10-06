import { describe, expect, it } from 'vitest';
import { DayLights } from './lights';

const anchors = [{ x: 0.4, y: 0.7, depth: 0.6 }];

describe('vol réservé (coché depuis une feuille)', () => {
  it('la lumière n’est pas posée à son ancre avant son envol', () => {
    const lights = new DayLights(anchors);
    lights.reserve('c1', 12.5);
    lights.sync([{ id: 'c1', who: 'a' }], 10, true);
    expect(lights.size).toBe(0);
    expect(lights.flying(10)).toEqual([]);
    // L'envol arrive : la lumière part de la case, sans avoir été visible avant.
    lights.pulse('c1', 'a', { x: 0.5, y: 1.0 }, 10.6);
    expect(lights.size).toBe(1);
    expect(lights.flying(10.6)).toHaveLength(1);
    expect(lights.isReserved('c1', 10.6)).toBe(false);
  });

  it('passé l’échéance, la lumière est posée normalement', () => {
    const lights = new DayLights(anchors);
    lights.reserve('c1', 12.5);
    lights.sync([{ id: 'c1', who: 'a' }], 13, true);
    expect(lights.size).toBe(1);
  });

  it('les autres lumières ne sont pas retenues', () => {
    const lights = new DayLights(anchors);
    lights.reserve('c1', 12.5);
    lights.sync([{ id: 'c0', who: 'b' }, { id: 'c1', who: 'a' }], 10, true);
    expect(lights.size).toBe(1);
  });
});
