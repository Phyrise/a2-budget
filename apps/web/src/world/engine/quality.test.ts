import { describe, expect, it } from 'vitest';
import { MAX_PIXELS, QualityMeter, renderDpr } from './quality';

describe('renderDpr', () => {
  it('téléphone dpr 3 : 2,5 au palier 0 « net », puis 1,5, 1,25 et 1', () => {
    expect(renderDpr(3, 0, 390, 528)).toBe(2.5);
    expect(renderDpr(3, 0, 390, 528, false)).toBe(1.5);
    expect(renderDpr(3, 1, 390, 528)).toBe(1.25);
    expect(renderDpr(3, 2, 390, 528)).toBe(1);
  });

  it("jamais au-delà de l'écran", () => {
    expect(renderDpr(2, 0, 390, 844)).toBe(2);
    expect(renderDpr(1, 0, 1280, 800)).toBe(1);
  });

  it('grand écran de bureau : plafond de pixels, jamais sous 1', () => {
    const d = renderDpr(2, 0, 1440, 900);
    expect(d).toBeLessThan(2);
    expect(1440 * d * 900 * d).toBeLessThanOrEqual(MAX_PIXELS + 1);
    expect(renderDpr(2, 0, 3840, 2160)).toBe(1);
  });
});

describe('QualityMeter.step', () => {
  it("renonce d'abord à la densité « nette », puis descend d'un palier", () => {
    const m = new QualityMeter();
    expect(m.step(0, 2.5)).toBe(0);
    expect(m.sharp).toBe(false);
    expect(m.step(0, 1.5)).toBe(1);
    expect(m.reset(0)).toBe(0);
    expect(m.sharp).toBe(true);
  });

  it("écran peu dense : la densité « nette » n'apporte rien, palier suivant", () => {
    expect(new QualityMeter().step(0, 1.5)).toBe(1);
  });
});

describe('QualityMeter.interval', () => {
  /** Images régulières pendant `secs` ; vrai si le moteur doit descendre d'un palier. */
  const run = (m: QualityMeter, gapMs: number, fps: number, secs = 6) => {
    let at = 0;
    for (let t = 0; t < secs; t += gapMs / 1000) {
      at += gapMs / 1000;
      if (m.interval(gapMs / 1000, at, true, fps)) return true;
    }
    return false;
  };

  it('60 fps : 33 ms entre images, trop lent', () => {
    expect(run(new QualityMeter(), 33, 60)).toBe(true);
  });

  it('plafond à 30 : 33 ms est la cadence normale, 55 ms trop lent', () => {
    const m = new QualityMeter();
    m.retarget(30);
    expect(run(m, 33, 30)).toBe(false);
    expect(run(new QualityMeter(), 55, 30)).toBe(true);
  });
});
