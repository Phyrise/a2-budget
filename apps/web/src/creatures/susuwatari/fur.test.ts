import { describe, expect, it } from 'vitest';
import { traceHair, type Hair } from './fur';

/** Toile factice : relève les points du tracé. */
function recorder() {
  const pts: Array<{ op: string; x: number; y: number }> = [];
  const ctx = {
    moveTo: (x: number, y: number) => pts.push({ op: 'move', x, y }),
    lineTo: (x: number, y: number) => pts.push({ op: 'line', x, y }),
    quadraticCurveTo: (_cx: number, _cy: number, x: number, y: number) => pts.push({ op: 'quad', x, y }),
    ellipse: (x: number, y: number, rx: number) => pts.push({ op: 'ellipse', x: x + rx, y }),
    closePath: () => undefined,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, pts };
}

// Un poil horizontal, de (1, 0) à (1.5, 0) (× Rd), demi-largeur 0,02.
const hair: Hair = { x: 1, y: 0, dir: 0, len: 0.5, w: 0.02, bend: 0, phase: 0, tone: 0, fine: false, lit: false, over: false };
const Rd = 100;

describe('tracé d’un poil', () => {
  it('effilé (taper = 1) : les deux bords se rejoignent en pointe', () => {
    const { ctx, pts } = recorder();
    traceHair(ctx, hair, 0, 0, Rd, 0, 0, { taper: 1, cap: 0, minW: 0 });
    const tipSide = pts.filter((p) => p.x > 149);
    expect(tipSide.length).toBeGreaterThan(0);
    for (const p of tipSide) expect(Math.abs(p.y)).toBeLessThan(1e-9);
  });

  it('droit (taper = 0) : épaisseur constante jusqu’au bout, bout net', () => {
    const { ctx, pts } = recorder();
    traceHair(ctx, hair, 0, 0, Rd, 0, 0, { taper: 0, cap: 0, minW: 0 });
    const ys = pts.filter((p) => p.op === 'quad' || p.op === 'line').map((p) => Math.abs(p.y));
    for (const y of ys) expect(y).toBeCloseTo(2, 6);
    expect(pts.some((p) => p.op === 'ellipse')).toBe(false);
  });

  it('bout arrondi (cap = 1) et demi-largeur minimale en petit', () => {
    const { ctx, pts } = recorder();
    traceHair(ctx, hair, 0, 0, 10, 0, 0, { taper: 0, cap: 1, minW: 0.5 });
    expect(pts.some((p) => p.op === 'ellipse')).toBe(true);
    // 0,02 × 10 px = 0,2 px < 0,5 : la demi-largeur est portée à 0,5 px.
    expect(Math.abs(pts[0]!.y)).toBeCloseTo(0.5, 6);
  });
});
