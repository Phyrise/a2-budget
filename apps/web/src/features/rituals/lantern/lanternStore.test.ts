import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLantern, lantern, progressOf, remainingMs, restoreLantern, savedLantern } from './lanternStore';

/** Ce qu'un rechargement relirait de la clé `a2-budget:lantern:v1`. */
const reload = () => restoreLantern(JSON.parse(JSON.stringify(savedLantern(getLantern()))));

describe('lanterne gardée au-delà d’un rechargement', () => {
  afterEach(() => {
    lantern.reset();
    vi.useRealTimers();
  });

  it('une lanterne qui brûle se reprend, au bon temps', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 20, 0) });
    lantern.start({ minutes: 10, who: 'a', taskId: 't-1', label: 'Ranger' });
    vi.advanceTimersByTime(4 * 60_000);
    const back = reload();
    expect(back).toMatchObject({ phase: 'running', config: { minutes: 10, who: 'a', taskId: 't-1', label: 'Ranger' }, recorded: false });
    expect(back!.sessionId).toBe(getLantern().sessionId);
    expect(remainingMs(back!)).toBe(6 * 60_000);
    // Finie pendant que l'app était fermée : pleine au retour.
    expect(progressOf(back!, Date.now() + 7 * 60_000)).toBe(1);
  });

  it('en pause : le temps reste figé', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 20, 0) });
    lantern.start({ minutes: 5, who: 'both' });
    vi.advanceTimersByTime(60_000);
    lantern.pause();
    vi.advanceTimersByTime(30 * 60_000);
    const back = reload();
    expect(back?.phase).toBe('paused');
    expect(remainingMs(back!)).toBe(4 * 60_000);
  });

  it('finie mais pas encore mémorisée : gardée, puis oubliée une fois mémorisée', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 7, 20, 0) });
    lantern.start({ minutes: 5, who: 'b' });
    vi.advanceTimersByTime(5 * 60_000 + 100);
    lantern.tick();
    expect(reload()).toMatchObject({ phase: 'done', completed: true, minutesSpent: 5, celebrated: false });
    lantern.markRecorded();
    expect(savedLantern(getLantern())).toBeNull();
  });

  it('arrêtée avant la première minute, ou au repos : rien à garder', () => {
    expect(savedLantern(getLantern())).toBeNull();
    lantern.start({ minutes: 5, who: 'a' });
    lantern.stop();
    expect(savedLantern(getLantern())).toBeNull();
  });

  it('rien d’illisible n’est restauré', () => {
    const ok = { phase: 'running', config: { minutes: 5, who: 'a' }, sessionId: 's', startedAt: 1, pausedMs: 0, pausedAt: null, endedAt: null, completed: false, minutesSpent: 0 };
    expect(restoreLantern(ok)?.phase).toBe('running');
    for (const bad of [null, 'x', { ...ok, phase: 'idle' }, { ...ok, sessionId: '' }, { ...ok, config: { minutes: 0, who: 'a' } }, { ...ok, config: { minutes: 5, who: 'c' } }, { ...ok, startedAt: 'hier' }, { ...ok, phase: 'paused' }, { ...ok, phase: 'done' }]) {
      expect(restoreLantern(bad)).toBeNull();
    }
  });
});
