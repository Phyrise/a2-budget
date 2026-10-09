/**
 * Échantillons audio (V5.7) : faux contexte WebAudio (Node n'en a pas) et
 * faux fetch. On vérifie le cache (octets une fois, décodage une fois par
 * contexte), l'attente bornée puis le repli synthétisé, et qu'aucune erreur
 * ne remonte (sans fetch, sans décodage, sans AudioContext).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bus } from './synth';

type Samples = typeof import('./samples');
let S: Samples;

interface FakeSource {
  buffer: unknown;
  playbackRate: { value: number };
  start: ReturnType<typeof vi.fn>;
}

function fakeBus(o: { decodeMs?: number; fail?: boolean } = {}) {
  const calls = { decode: 0, sources: [] as FakeSource[], gains: [] as number[] };
  const node = () => ({ connect: (x: unknown) => x, disconnect: () => undefined });
  const ctx = {
    currentTime: 0,
    decodeAudioData(data: ArrayBuffer, ok?: (b: AudioBuffer) => void, err?: (e: Error) => void) {
      calls.decode++;
      return new Promise<AudioBuffer>((resolve, reject) => {
        setTimeout(() => {
          if (o.fail) {
            err?.(new Error('décodage'));
            reject(new Error('décodage'));
            return;
          }
          const b = { duration: 0.3, length: data.byteLength } as unknown as AudioBuffer;
          ok?.(b);
          resolve(b);
        }, o.decodeMs ?? 0);
      });
    },
    createBufferSource() {
      const s = { ...node(), buffer: null, playbackRate: { value: 1 }, start: vi.fn(), onended: null };
      calls.sources.push(s);
      return s;
    },
    createGain() {
      return {
        ...node(),
        gain: {
          value: 1,
          setValueAtTime: (v: number) => {
            calls.gains.push(v);
          },
        },
      };
    },
  };
  const sink = node();
  return { bus: { ctx, dry: sink, wet: sink, noise: {} } as unknown as Bus, calls };
}

const okFetch = () => vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }));

beforeEach(async () => {
  vi.resetModules();
  S = await import('./samples');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('échantillons audio (V5.7)', () => {
  it('octets récupérés une fois, décodés une fois par contexte', async () => {
    const fetch = okFetch();
    vi.stubGlobal('fetch', fetch);
    const one = fakeBus();
    const two = fakeBus();
    const p = S.loadSample(one.bus.ctx, 'hin');
    expect(S.loadSample(one.bus.ctx, 'hin')).toBe(p);
    const buf = await p;
    expect(buf).not.toBeNull();
    expect(S.sampleReady(one.bus.ctx, 'hin')).toBe(buf);
    await S.loadSample(one.bus.ctx, 'hin');
    expect(one.calls.decode).toBe(1);
    // Autre contexte : nouveau décodage, mêmes octets.
    expect(S.sampleReady(two.bus.ctx, 'hin')).toBeNull();
    await S.loadSample(two.bus.ctx, 'hin');
    expect(two.calls.decode).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('préchargement et préfetch : décodé, jamais joué', async () => {
    vi.stubGlobal('fetch', okFetch());
    const { bus, calls } = fakeBus();
    S.prefetchSample('hin');
    S.preloadSamples(bus.ctx);
    await S.loadSample(bus.ctx, 'hin');
    expect(calls.decode).toBe(1);
    expect(calls.sources).toHaveLength(0);
  });

  it('décodé : joué tout de suite, à l’instant demandé, par le bus', async () => {
    vi.stubGlobal('fetch', okFetch());
    const { bus, calls } = fakeBus();
    await S.loadSample(bus.ctx, 'hin');
    const fallback = vi.fn();
    S.withSample(bus, 'hin', 2, (b, at) => S.playSample(bus, b, at, { gain: 0.06, rate: 0.9 }), fallback);
    expect(fallback).not.toHaveBeenCalled();
    expect(calls.sources).toHaveLength(1);
    expect(calls.sources[0]!.start).toHaveBeenCalledWith(2);
    expect(calls.sources[0]!.playbackRate.value).toBe(0.9);
    expect(calls.gains).toContain(0.06);
  });

  it('pas encore décodé mais rapide (≤ 250 ms) : on l’attend', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', okFetch());
    const { bus } = fakeBus({ decodeMs: 60 });
    const play = vi.fn();
    const fallback = vi.fn();
    S.withSample(bus, 'hin', 1, play, fallback);
    expect(play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0]![1]).toBeGreaterThanOrEqual(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('trop lent : repli synthétisé, une seule fois, jamais les deux', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', okFetch());
    const { bus } = fakeBus({ decodeMs: 900 });
    const play = vi.fn();
    const fallback = vi.fn();
    S.withSample(bus, 'hin', 0, play, fallback);
    await vi.advanceTimersByTimeAsync(S.SAMPLE_WAIT_MS - 10);
    expect(fallback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(fallback).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(play).not.toHaveBeenCalled();
    // Le suivant, lui, a l'échantillon.
    expect(S.sampleReady(bus.ctx, 'hin')).not.toBeNull();
  });

  it('introuvable ou indécodable : null, repli, aucune exception, on retente plus tard', async () => {
    const broken = vi.fn(async () => {
      throw new Error('hors ligne');
    });
    vi.stubGlobal('fetch', broken);
    const { bus } = fakeBus();
    await expect(S.loadSample(bus.ctx, 'hin')).resolves.toBeNull();
    const fallback = vi.fn();
    S.withSample(bus, 'hin', 0, vi.fn(), fallback);
    await new Promise((r) => setTimeout(r, 10));
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(broken.mock.calls.length).toBeGreaterThanOrEqual(2);

    vi.stubGlobal('fetch', okFetch());
    const bad = fakeBus({ fail: true });
    await expect(S.loadSample(bad.bus.ctx, 'hin')).resolves.toBeNull();
    // Le fichier revient : le décodage est retenté.
    const good = fakeBus();
    await expect(S.loadSample(good.bus.ctx, 'hin')).resolves.not.toBeNull();
  });

  it('sans fetch (Node nu) : aucune exception', async () => {
    vi.stubGlobal('fetch', undefined);
    const { bus } = fakeBus();
    expect(() => S.preloadSamples(bus.ctx)).not.toThrow();
    expect(() => S.prefetchSample('hin')).not.toThrow();
    await expect(S.loadSample(bus.ctx, 'hin')).resolves.toBeNull();
  });
});
