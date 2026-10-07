import { describe, expect, it } from 'vitest';
import { bucketRadius } from './sprites';

describe('paliers de rayon des sprites', () => {
  it('construit toujours au-dessus du besoin, de 20 % au plus (au pixel près)', () => {
    for (let r = 6; r < 400; r += 0.7) {
      const b = bucketRadius(r);
      expect(b).toBeGreaterThanOrEqual(r);
      expect(b).toBeLessThanOrEqual(r * 1.2 + 1);
    }
  });

  it('regroupe les rayons proches', () => {
    const set = new Set<number>();
    for (let r = 60; r <= 100; r += 1) set.add(bucketRadius(r));
    expect(set.size).toBeLessThanOrEqual(4);
  });
});
