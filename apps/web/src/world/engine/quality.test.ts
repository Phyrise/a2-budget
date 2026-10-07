import { describe, expect, it } from 'vitest';
import { MAX_PIXELS, renderDpr } from './quality';

describe('renderDpr', () => {
  it('téléphone dpr 3 : 2,5 au palier haut, puis 1,5 et 1', () => {
    expect(renderDpr(3, 0, 390, 528)).toBe(2.5);
    expect(renderDpr(3, 1, 390, 528)).toBe(1.5);
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
