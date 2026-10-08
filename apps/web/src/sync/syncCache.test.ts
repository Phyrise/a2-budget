import { describe, expect, it } from 'vitest';
import { CURSOR_OVERLAP_MS, FULL_RESYNC_AFTER_MS, advanceCursor, listenFrom, needsFullResync } from './syncCache';

describe('curseurs des écouteurs delta', () => {
  it('écoute à partir du curseur moins deux minutes ; sans curseur, depuis le début', () => {
    expect(listenFrom({ tasks: 10 * 60_000 }, 'tasks')).toBe(10 * 60_000 - CURSOR_OVERLAP_MS);
    expect(listenFrom({ tasks: 1_000 }, 'tasks')).toBe(0);
    expect(listenFrom({}, 'completions')).toBe(0);
  });

  it('le curseur ne recule jamais', () => {
    expect(advanceCursor(undefined, [])).toBeUndefined();
    expect(advanceCursor(undefined, [5, 9, 3])).toBe(9);
    expect(advanceCursor(12, [5, 9])).toBe(12);
    expect(advanceCursor(12, [Number.NaN, 13])).toBe(13);
  });

  it('tout relire : jamais relu, vieux de plus de 25 jours, modèle changé, cache du SDK vidé', () => {
    const cache = { syncedAt: 1_000_000, schema: 1, cursors: { tasks: 900_000 } };
    const ok = { now: 1_000_000 + FULL_RESYNC_AFTER_MS, schema: 1, cacheAlive: true };
    expect(needsFullResync(cache, ok)).toBe(false);
    expect(needsFullResync(null, ok)).toBe(true);
    expect(needsFullResync({ ...cache, syncedAt: null }, ok)).toBe(true);
    expect(needsFullResync(cache, { ...ok, now: ok.now + 1 })).toBe(true);
    expect(needsFullResync(cache, { ...ok, schema: 2 })).toBe(true);
    expect(needsFullResync(cache, { ...ok, cacheAlive: false })).toBe(true);
  });
});
