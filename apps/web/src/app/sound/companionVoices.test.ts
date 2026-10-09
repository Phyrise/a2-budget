/**
 * Sons des compagnons (V5.6) : synthèse rejouée sur un faux contexte
 * WebAudio (Node n'en a pas). On vérifie le graphe — des nœuds créés, tous
 * démarrés et arrêtés —, une durée bornée, des niveaux bas, des rampes
 * exponentielles jamais vers 0 (WebAudio lèverait), et le branchement du
 * registre. V5.7 : Hin joue son échantillon (le vrai « hin » du film),
 * décodé d'avance dans le faux contexte. Le rendu réel (niveau, durée
 * audible) reste à la QA Chromium (scripts/qa-sons.mjs).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { COMPANIONS, COMPANION_IDS } from '../../ui/companions';
import { ALL_CUES, type SoundCue } from './cues';
import { soundEngine } from './engine';
import { HIN_GAIN } from './companionVoices';
import { loadSample } from './samples';
import type { Bus } from './synth';
import { renderCue } from './voices';

interface Trace {
  nodes: number;
  sources: number;
  started: number;
  stopped: number;
  /** Dernier instant planifié (rampes, arrêts, fins de lecture). */
  end: number;
  /** Plus haute valeur de gain planifiée. */
  peakGain: number;
  badRamps: number;
}

/**
 * Faux BaseAudioContext : juste ce que synth.ts et samples.ts touchent, tout
 * est noté dans la trace courante. Un seul contexte pour tout le fichier :
 * l'échantillon de Hin y est décodé une fois (cache par contexte).
 */
let trace: Trace;
const bufferSources: Array<{ rate: number; at: number }> = [];
const HIN_BUFFER = { duration: 0.32 } as unknown as AudioBuffer;
const at = (t: number) => {
  trace.end = Math.max(trace.end, t);
};
const param = (gain = false) => {
  const p = {
    value: 0,
    setValueAtTime(v: number, t: number) {
      if (gain) trace.peakGain = Math.max(trace.peakGain, v);
      at(t);
      return p;
    },
    linearRampToValueAtTime(v: number, t: number) {
      if (gain) trace.peakGain = Math.max(trace.peakGain, v);
      at(t);
      return p;
    },
    exponentialRampToValueAtTime(v: number, t: number) {
      if (!(v > 0)) trace.badRamps++;
      if (gain) trace.peakGain = Math.max(trace.peakGain, v);
      at(t);
      return p;
    },
  };
  return p;
};
const node = () => {
  trace.nodes++;
  return {
    connect: (target: unknown) => target,
    disconnect: () => undefined,
  };
};
const source = () => {
  trace.sources++;
  return {
    ...node(),
    onended: null as null | (() => void),
    start(t: number, _offset?: number, duration?: number) {
      trace.started++;
      at(t + (duration ?? 0));
    },
    stop(t: number) {
      trace.stopped++;
      at(t);
    },
  };
};
const ctx = {
  currentTime: 0,
  createOscillator: () => ({ ...source(), type: 'sine', frequency: param(), detune: param() }),
  createBufferSource: () => {
    const s = { ...source(), buffer: null as unknown, loop: false, playbackRate: param() };
    const start = s.start;
    s.start = (t: number, offset?: number, duration?: number) => {
      // Échantillon : fin = début + durée du tampon (ralenti : plus long).
      if (s.buffer === HIN_BUFFER) {
        const rate = s.playbackRate.value || 1;
        bufferSources.push({ rate, at: t });
        at(t + HIN_BUFFER.duration / rate);
      }
      start(t, offset, duration);
    };
    return s;
  },
  createGain: () => ({ ...node(), gain: param(true) }),
  createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
  decodeAudioData: (_data: ArrayBuffer, ok?: (b: AudioBuffer) => void) => {
    ok?.(HIN_BUFFER);
    return Promise.resolve(HIN_BUFFER);
  },
};

function fakeBus(): { bus: Bus; trace: Trace } {
  trace = { nodes: 0, sources: 0, started: 0, stopped: 0, end: 0, peakGain: 0, badRamps: 0 };
  bufferSources.length = 0;
  const sink = { connect: (x: unknown) => x, disconnect: () => undefined } as unknown as AudioNode;
  return { bus: { ctx: ctx as unknown as BaseAudioContext, dry: sink, wet: sink, noise: {} as AudioBuffer }, trace };
}

beforeAll(async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }));
  fakeBus();
  await loadSample(ctx as unknown as BaseAudioContext, 'hin');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const NEW_CUES: readonly SoundCue[] = ['chirp', 'hiss', 'trill', 'huff', 'sigh', 'snuffle'];

function play(cue: SoundCue, gentle: boolean): Trace {
  const { bus, trace } = fakeBus();
  renderCue(bus, cue, 1, { gentle });
  return trace;
}

describe('sons de Teto et Hin (V5.6)', () => {
  it('chaque son est déclaré dans le vocabulaire', () => {
    for (const cue of NEW_CUES) expect(ALL_CUES).toContain(cue);
  });

  it('un graphe de nœuds, chaque source démarrée puis arrêtée', () => {
    for (const cue of NEW_CUES) {
      for (const gentle of [false, true]) {
        const t = play(cue, gentle);
        expect(t.nodes, cue).toBeGreaterThan(2);
        expect(t.started, cue).toBe(t.sources);
        // Les sources de bruit s'arrêtent par leur durée (start(t, offset, durée)).
        expect(t.stopped, cue).toBeLessThanOrEqual(t.sources);
        expect(t.badRamps, cue).toBe(0);
      }
    }
  });

  it('courts : ≤ 1,2 s (soupir de Hin compris), plus courts encore en mode doux', () => {
    for (const cue of NEW_CUES) {
      const full = play(cue, false).end - 1;
      const gentle = play(cue, true).end - 1;
      expect(full, cue).toBeLessThanOrEqual(1.2);
      expect(gentle, cue).toBeLessThanOrEqual(full + 1e-9);
    }
    // Toucher : un détail bref ; agacé / caresse un peu plus longs.
    expect(play('chirp', false).end - 1).toBeLessThan(0.4);
    expect(play('huff', false).end - 1).toBeLessThan(0.45);
  });

  it('niveaux bas, comme les sons voisins (gain de voix ≤ 0,16, celui du ronron)', () => {
    const ref = play('purr', false).peakGain;
    for (const cue of NEW_CUES) expect(play(cue, false).peakGain, cue).toBeLessThanOrEqual(Math.max(ref, 0.16));
  });

  it('le registre donne à chaque compagnon un son pour toucher, agacer, caresser', () => {
    expect(COMPANIONS.teto.sounds).toEqual({ poke: 'chirp', upset: 'hiss', caress: 'trill' });
    expect(COMPANIONS.hin.sounds).toEqual({ poke: 'huff', upset: 'sigh', caress: 'snuffle' });
    for (const id of COMPANION_IDS) {
      for (const cue of Object.values(COMPANIONS[id].sounds ?? {})) expect(ALL_CUES).toContain(cue);
    }
  });

  it('Hin (V5.7) : son vrai « hin », tel quel, doublé plus grave, ralenti à la caresse', () => {
    const plays = (cue: SoundCue, gentle: boolean) => {
      play(cue, gentle);
      return bufferSources.map((b) => [+(b.at - 1).toFixed(2), b.rate]);
    };
    expect(plays('huff', false)).toEqual([[0, 1]]);
    expect(plays('huff', true)).toEqual([[0, 1]]);
    expect(plays('sigh', false)).toEqual([
      [0, 1],
      [0.45, 0.9],
    ]);
    expect(plays('sigh', true)).toHaveLength(1);
    expect(plays('snuffle', false)).toEqual([[0, 0.87]]);
    expect(plays('snuffle', true)).toEqual([[0, 0.87]]);
    // Mode doux : plus bas.
    for (const cue of ['huff', 'sigh', 'snuffle'] as const) {
      expect(play(cue, true).peakGain, cue).toBeLessThan(play(cue, false).peakGain);
    }
    expect(play('huff', false).peakGain).toBeCloseTo(HIN_GAIN);
  });

  it('sans AudioContext (Node) : aucun son, aucune exception', () => {
    expect(soundEngine.supported()).toBe(false);
    for (const cue of NEW_CUES) expect(() => soundEngine.play(cue)).not.toThrow();
    expect(soundEngine.play('huff')).toBe(false);
    expect(soundEngine.state()).toBe('absent');
  });
});
