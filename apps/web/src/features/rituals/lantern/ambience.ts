/**
 * Ambiance sonore procédurale de la lanterne (WebAudio, aucun fichier) :
 * - pluie douce : bruit rose filtré (bruissement) + gouttes aléatoires
 *   (éclats de bruit très courts, filtrés en bande étroite) ;
 * - ruisseau : bruit brun filtré, dont le filtre et le volume ondulent
 *   lentement (deux bandes, LFO indépendants) ;
 * - carillon : deux notes de cloche douces à la fin de la lanterne.
 * Fondu à l'entrée et à la sortie ; tout est coupé si l'API est absente.
 */
import type { LanternSound } from './lanternStore';

type Kind = Exclude<LanternSound, 'off'>;

interface Layer {
  kind: Kind;
  gain: GainNode;
  stop: () => void;
}

const LEVEL: Record<Kind, number> = { rain: 0.55, stream: 0.5 };
const FADE_IN = 2.2;
const FADE_OUT = 1.4;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: Layer | null = null;
const buffers = new Map<string, AudioBuffer>();

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function noiseBuffer(c: AudioContext, color: 'pink' | 'brown' | 'white'): AudioBuffer {
  const cached = buffers.get(color);
  if (cached) return cached;
  const length = Math.floor(c.sampleRate * 5);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'white') data[i] = white * 0.5;
    else if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    } else {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  // Raccord de boucle sans clic : fondu sur les 50 dernières ms.
  const fade = Math.floor(c.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[length - fade + i] = data[length - fade + i]! * (1 - t) + data[i]! * t;
  }
  buffers.set(color, buffer);
  return buffer;
}

function loop(c: AudioContext, color: 'pink' | 'brown' | 'white'): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, color);
  src.loop = true;
  src.loopStart = Math.random() * 2;
  return src;
}

function lfo(c: AudioContext, rate: number, depth: number, target: AudioParam): OscillatorNode {
  const osc = c.createOscillator();
  osc.frequency.value = rate;
  const g = c.createGain();
  g.gain.value = depth;
  osc.connect(g).connect(target);
  osc.start();
  return osc;
}

function buildRain(c: AudioContext, out: GainNode): () => void {
  const hiss = loop(c, 'pink');
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 500;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  const hissGain = c.createGain();
  hissGain.gain.value = 0.42;
  hiss.connect(hp).connect(lp).connect(hissGain).connect(out);
  const swell = lfo(c, 0.07, 0.12, hissGain.gain);
  hiss.start();

  // Gouttes : planifiées un peu à l'avance sur l'horloge audio.
  const white = noiseBuffer(c, 'white');
  let nextAt = c.currentTime + 0.1;
  const schedule = () => {
    const horizon = c.currentTime + 0.3;
    while (nextAt < horizon) {
      const drop = c.createBufferSource();
      drop.buffer = white;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 3800;
      bp.Q.value = 6 + Math.random() * 10;
      const env = c.createGain();
      const peak = 0.05 + Math.random() * 0.22;
      const decay = 0.025 + Math.random() * 0.06;
      env.gain.setValueAtTime(0, nextAt);
      env.gain.linearRampToValueAtTime(peak, nextAt + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, nextAt + decay);
      drop.connect(bp).connect(env).connect(out);
      drop.start(nextAt, Math.random() * 4, decay + 0.02);
      nextAt += 0.03 + Math.random() * (Math.random() < 0.2 ? 0.35 : 0.12);
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 120);
  return () => {
    window.clearInterval(timer);
    try {
      hiss.stop();
      swell.stop();
    } catch {
      /* déjà arrêté */
    }
  };
}

function buildStream(c: AudioContext, out: GainNode): () => void {
  const stops: Array<() => void> = [];
  const band = (freq: number, q: number, level: number, rate: number, color: 'brown' | 'pink') => {
    const src = loop(c, color);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.value = level;
    src.connect(bp).connect(g).connect(out);
    const f = lfo(c, rate, freq * 0.35, bp.frequency);
    const v = lfo(c, rate * 1.7, level * 0.35, g.gain);
    src.start();
    stops.push(() => {
      src.stop();
      f.stop();
      v.stop();
    });
  };
  band(420, 0.7, 0.9, 0.11, 'brown');
  band(1300, 1.4, 0.32, 0.23, 'brown');
  band(3200, 2.2, 0.06, 0.37, 'pink');
  return () => {
    try {
      stops.forEach((s) => s());
    } catch {
      /* déjà arrêté */
    }
  };
}

function fadeOut(layer: Layer, seconds = FADE_OUT) {
  if (!ctx) return;
  const t = ctx.currentTime;
  layer.gain.gain.cancelScheduledValues(t);
  layer.gain.gain.setValueAtTime(layer.gain.gain.value, t);
  layer.gain.gain.linearRampToValueAtTime(0, t + seconds);
  window.setTimeout(() => {
    layer.stop();
    layer.gain.disconnect();
  }, seconds * 1000 + 80);
}

export const ambience = {
  supported(): boolean {
    return audioContextCtor() !== null;
  },
  /** À appeler dans un geste (clic) : crée / réveille le contexte audio. */
  unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
  },
  play(kind: Kind) {
    const c = ensure();
    if (!c || !master) return;
    if (c.state === 'suspended') void c.resume().catch(() => undefined);
    if (current?.kind === kind) return;
    if (current) fadeOut(current);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(LEVEL[kind], c.currentTime + FADE_IN);
    gain.connect(master);
    const stop = kind === 'rain' ? buildRain(c, gain) : buildStream(c, gain);
    current = { kind, gain, stop };
  },
  stop(seconds = FADE_OUT) {
    if (!current) return;
    fadeOut(current, seconds);
    current = null;
  },
  /** Arrière-plan : coupe en douceur puis met le contexte en veille. */
  sleep() {
    this.stop(0.25);
    const c = ctx;
    if (c && c.state === 'running') window.setTimeout(() => void c.suspend().catch(() => undefined), 400);
  },
  /** Carillon doux (fin de la lanterne). */
  chime() {
    const c = ensure();
    if (!c || !master) return;
    if (c.state === 'suspended') void c.resume().catch(() => undefined);
    const notes = [659.25, 987.77];
    notes.forEach((f, n) => {
      const t0 = c.currentTime + 0.05 + n * 0.32;
      [1, 2.76, 5.4].forEach((ratio, k) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * ratio;
        const g = c.createGain();
        const peak = [0.16, 0.05, 0.018][k]!;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2 - k * 0.8);
        osc.connect(g).connect(master!);
        osc.start(t0);
        osc.stop(t0 + 3.4);
      });
    });
  },
};
