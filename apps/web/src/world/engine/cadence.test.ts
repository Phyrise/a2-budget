import { describe, expect, it } from 'vitest';
import { cadence, type CadenceInput } from './cadence';

const base: CadenceInput = { animated: true, busy: false, idle: 0, lanternActive: false, slow: false, maxFps: 60 };
const IDLES = [0, 1, 2.9, 3, 10, 14.9, 15, 30, 44.9, 45, 120];

describe('cadence', () => {
  it('60 : politique inchangée (60 → 30 → 15 → gel)', () => {
    expect(IDLES.map((idle) => cadence({ ...base, idle }))).toEqual([60, 60, 60, 30, 30, 30, 15, 15, 15, 0, 0]);
    expect(cadence({ ...base, idle: 100, busy: true })).toBe(60);
  });

  it('60 : lanterne allumée, jamais de gel (30, 20 sur appareil lent)', () => {
    expect(cadence({ ...base, idle: 100, lanternActive: true })).toBe(30);
    expect(cadence({ ...base, idle: 100, lanternActive: true, slow: true })).toBe(20);
    expect(cadence({ ...base, idle: 20, lanternActive: true })).toBe(30);
  });

  it('60 : images uniques seulement pendant une transition', () => {
    expect(cadence({ ...base, animated: false, busy: true })).toBe(60);
    expect(cadence({ ...base, animated: false })).toBe(0);
  });

  it('30 : jamais plus de 30, mêmes paliers bas et même gel', () => {
    const capped = { ...base, maxFps: 30 as const };
    for (const idle of IDLES) {
      for (const busy of [false, true]) {
        for (const lanternActive of [false, true]) {
          for (const animated of [false, true]) {
            const fps = cadence({ ...capped, idle, busy, lanternActive, animated });
            expect(fps).toBeLessThanOrEqual(30);
            expect(fps).toBe(Math.min(30, cadence({ ...base, idle, busy, lanternActive, animated })));
          }
        }
      }
    }
    expect(IDLES.map((idle) => cadence({ ...capped, idle }))).toEqual([30, 30, 30, 30, 30, 30, 15, 15, 15, 0, 0]);
    expect(cadence({ ...capped, idle: 100, lanternActive: true, slow: true })).toBe(20);
    expect(cadence({ ...capped, animated: false, busy: true })).toBe(30);
  });
});
