import { describe, expect, it } from 'vitest';
import {
  OFF_LEFT,
  OFF_RIGHT,
  ROAM,
  SLEEP_AFTER_MS,
  arrive,
  avatarMood,
  avatarMotion,
  comeBack,
  interact,
  isMoving,
  leave,
  lookAt,
  rand,
  step,
  type AvatarState,
} from './avatarModel';

/** Fait tourner l'automate à 60 images/s pendant `ms`. */
function run(s: AvatarState, from: number, ms: number, calm = false): { s: AvatarState; now: number; phases: Set<string> } {
  const phases = new Set<string>();
  let cur = s;
  let now = from;
  for (let t = 0; t < ms; t += 16) {
    now += 16;
    cur = step(cur, now, 16, calm);
    phases.add(cur.phase);
  }
  return { s: cur, now, phases };
}

describe('avatar de l’autre', () => {
  it('le hasard est déterministe (même graine, même suite)', () => {
    expect(rand(42)).toEqual(rand(42));
    expect(rand(42)[0]).not.toBe(rand(43)[0]);
    const a = run(arrive('a', 0, 7, false), 0, 60_000);
    const b = run(arrive('a', 0, 7, false), 0, 60_000);
    expect(a.s).toEqual(b.s);
  });

  it('entre par un bord, hors écran, puis s’assoit dans la zone', () => {
    const s = arrive('a', 0, 1, false);
    expect(s.phase).toBe('enter');
    expect([OFF_LEFT, OFF_RIGHT]).toContain(s.x);
    expect(isMoving(s)).toBe(true);
    const { s: after } = run(s, 0, 5_000);
    expect(after.phase).not.toBe('enter');
    expect(after.x).toBeGreaterThanOrEqual(ROAM[0]);
    expect(after.x).toBeLessThanOrEqual(ROAM[1]);
  });

  it('Jiji trottine plus vite que Calcifer ne flotte', () => {
    const a = step(arrive('a', 0, 3, false), 500, 500, false);
    const b = step(arrive('b', 0, 3, false), 500, 500, false);
    expect(Math.abs(a.x - arrive('a', 0, 3, false).x)).toBeGreaterThan(Math.abs(b.x - arrive('b', 0, 3, false).x));
  });

  it('la démarche suit le compagnon choisi, pas le rôle (V5.6)', () => {
    const float = { gait: 'float', caressMood: 'proud' } as const;
    const trot = { gait: 'trot', caressMood: 'happy' } as const;
    // AL a choisi Calcifer : il flotte (lent), AC a choisi Jiji : il trotte.
    const a = arrive('a', 0, 3, false, float);
    const b = arrive('b', 0, 3, false, trot);
    expect(avatarMotion(a)).toBe('float');
    expect(avatarMotion(b)).toBe('trot');
    const da = Math.abs(step(a, 500, 500, false).x - a.x);
    const db = Math.abs(step(b, 500, 500, false).x - b.x);
    expect(db).toBeGreaterThan(da);
    // Caresse : la pose du compagnon (Calcifer fier).
    expect(avatarMood(interact(a, 'purr', 0))).toBe('proud');
    expect(avatarMood(interact(b, 'purr', 0))).toBe('happy');
    // Scurry et waddle s'animent comme le trot en attendant les leurs.
    expect(avatarMotion(arrive('a', 0, 3, false, { gait: 'scurry', caressMood: 'happy' }))).toBe('trot');
    expect(avatarMotion(arrive('b', 0, 3, false, { gait: 'waddle', caressMood: 'happy' }))).toBe('trot');
  });

  it('erre : marche, s’assoit et regarde, sans quitter la zone', () => {
    const { phases, s } = run(arrive('b', 0, 11, false), 0, 60_000);
    expect(phases.has('walk')).toBe(true);
    expect(phases.has('sit')).toBe(true);
    expect(s.x).toBeGreaterThanOrEqual(ROAM[0]);
    expect(s.x).toBeLessThanOrEqual(ROAM[1]);
  });

  it('s’endort quand il ne se passe rien, et se réveille au toucher', () => {
    const { s, now } = run(arrive('a', 0, 5, false), 0, SLEEP_AFTER_MS + 20_000);
    expect(s.phase).toBe('sleep');
    expect(avatarMood(s)).toBe('sleepy');
    const woke = interact(s, 'hop', now);
    expect(woke.phase).toBe('sit');
    expect(woke.react).toBe('hop');
    expect(avatarMood(woke)).toBe('happy');
    expect(step(woke, now + 2_000, 16, false).react).toBeNull();
  });

  it('ne bouge pas pendant une réaction', () => {
    const s = interact(arrive('a', 0, 2, false), 'purr', 0);
    expect(step(s, 100, 100, false).x).toBe(s.x);
  });

  it('regarde ton doigt quand il est assis', () => {
    const sit: AvatarState = { ...arrive('a', 0, 2, true), x: 0.5 };
    expect(lookAt(sit, 0.1, 0)).toMatchObject({ phase: 'look', facing: -1 });
    expect(lookAt(sit, 0.9, 0)).toMatchObject({ phase: 'look', facing: 1 });
  });

  it('sort par le bord le plus proche, puis disparaît ; demi-tour s’il revient', () => {
    const { s, now } = run(arrive('a', 0, 9, false), 0, 8_000);
    const out = leave(s, false);
    expect(out.phase).toBe('exit');
    expect(out.target).toBe(s.x < 0.5 ? OFF_LEFT : OFF_RIGHT);
    expect(interact(out, 'hop', now).react).toBeNull();
    const back = comeBack(out, now);
    expect(back.phase).toBe('walk');
    expect(run(out, now, 10_000).s.phase).toBe('gone');
  });

  it('calme : apparaît assis, ne se déplace jamais, disparaît d’un coup', () => {
    const s = arrive('b', 0, 4, true);
    expect(s.phase).toBe('sit');
    expect(s.x).toBeGreaterThan(0.2);
    const { phases, s: later } = run(s, 0, 60_000, true);
    expect(phases.has('walk')).toBe(false);
    expect(later.x).toBe(s.x);
    expect(leave(later, true).phase).toBe('gone');
  });
});
