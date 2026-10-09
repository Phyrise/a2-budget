/**
 * Sons des compagnons (V5.6) : synthèse rejouée sur un faux contexte
 * WebAudio (Node n'en a pas). On vérifie le graphe — des nœuds créés, tous
 * démarrés et arrêtés —, une durée bornée, des niveaux bas, des rampes
 * exponentielles jamais vers 0 (WebAudio lèverait), et le branchement du
 * registre. Le rendu réel (niveau, durée audible) reste à la QA Chromium
 * (scripts/qa-sons.mjs).
 */
import { describe, expect, it } from 'vitest';
import { COMPANIONS, COMPANION_IDS } from '../../ui/companions';
import { ALL_CUES, type SoundCue } from './cues';
import { soundEngine } from './engine';
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

/** Faux BaseAudioContext : juste ce que synth.ts touche, tout est noté. */
function fakeBus(): { bus: Bus; trace: Trace } {
  const trace: Trace = { nodes: 0, sources: 0, started: 0, stopped: 0, end: 0, peakGain: 0, badRamps: 0 };
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
    const n = {
      connect: (target: unknown) => target,
      disconnect: () => undefined,
    };
    return n;
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
    createOscillator: () => ({ ...source(), type: 'sine', frequency: param(), detune: param() }),
    createBufferSource: () => ({ ...source(), buffer: null, loop: false }),
    createGain: () => ({ ...node(), gain: param(true) }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
  };
  const noise = {} as AudioBuffer;
  const sink = node() as unknown as AudioNode;
  return { bus: { ctx: ctx as unknown as BaseAudioContext, dry: sink, wet: sink, noise }, trace };
}

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

  it('sans AudioContext (Node) : aucun son, aucune exception', () => {
    expect(soundEngine.supported()).toBe(false);
    for (const cue of NEW_CUES) expect(() => soundEngine.play(cue)).not.toThrow();
    expect(soundEngine.play('huff')).toBe(false);
    expect(soundEngine.state()).toBe('absent');
  });
});
