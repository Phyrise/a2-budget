import { describe, expect, it } from 'vitest';
import { Susuwatari, type SusuwatariEnv } from './creature';

const VIEW = { left: 0, top: 0, right: 390, bottom: 600 };

/** Fait vivre une Noiraude `seconds` secondes à 60 i/s. */
function run(s: Susuwatari, seconds: number, from = 0, env: Partial<SusuwatariEnv> = {}): number {
  let t = from;
  for (let i = 0; i < seconds * 60; i++) {
    t += 1 / 60;
    s.update(1 / 60, { time: t, reduced: false, gaze: null, view: VIEW, ...env });
  }
  return t;
}

describe('Noiraude', () => {
  it('marche jusqu’au but, pattes sorties, puis prévient', () => {
    const s = new Susuwatari({ x: 100, y: 400, size: 44, seed: 7 });
    let arrived = false;
    s.walkTo(180, 410, { onArrive: () => (arrived = true) });
    run(s, 0.4);
    expect(s.legs).toBeGreaterThan(0.9);
    expect(s.facing).toBe(1);
    run(s, 3, 0.4);
    expect(arrived).toBe(true);
    expect(s.state).toBe('idle');
    expect(Math.hypot(s.x - 180, s.y - 410)).toBeLessThan(2);
  });

  it('rebondit puis retombe au sol, yeux plissés pendant le saut', () => {
    const s = new Susuwatari({ x: 100, y: 400, size: 44, seed: 3 });
    s.bounce();
    let top = 0;
    let happy = false;
    let t = 0;
    for (let i = 0; i < 60; i++) {
      t = run(s, 1 / 60, t);
      top = Math.max(top, s.z);
      happy ||= s.eyes === 'happy';
    }
    expect(top).toBeGreaterThan(20);
    expect(happy).toBe(true);
    expect(s.z).toBe(0);
    run(s, 0.5, t);
    expect(s.eyes).toBe('open');
  });

  it('tremble, puis s’enfuit hors de la vue et disparaît', () => {
    const s = new Susuwatari({ x: 120, y: 400, size: 44, seed: 5 });
    let gone = false;
    s.shiver(500, () => s.flee({ x: 160, y: 400 }, { view: VIEW, onGone: () => (gone = true) }));
    let t = run(s, 0.3);
    expect(s.state).toBe('shiver');
    expect(Math.abs(s.jitterX) + Math.abs(s.jitterY)).toBeGreaterThan(0);
    t = run(s, 0.4, t);
    expect(s.state).toBe('flee');
    expect(s.armPose).toBe('flail');
    run(s, 3, t);
    expect(gone).toBe(true);
    expect(s.state).toBe('gone');
    expect(s.x).toBeLessThan(0);
  });

  it('dort les yeux fermés, puis se réveille', () => {
    const s = new Susuwatari({ x: 100, y: 400, seed: 2 });
    s.sleep(1);
    run(s, 0.5);
    expect(s.state).toBe('sleep');
    expect(s.eyes).toBe('closed');
    run(s, 1, 0.5);
    expect(s.state).toBe('idle');
    expect(s.eyes).toBe('open');
  });

  it('regarde le doigt', () => {
    const s = new Susuwatari({ x: 100, y: 400, size: 44, seed: 4 });
    run(s, 0.5, 0, { gaze: { x: 300, y: 380 } });
    expect(s.look.x).toBeGreaterThan(0.8);
    run(s, 0.5, 0.5, { gaze: { x: 100, y: 200 } });
    expect(s.look.y).toBeLessThan(-0.8);
  });
});
