/**
 * Briques de synthèse WebAudio (aucun fichier audio ; le seul échantillon,
 * le « hin » de Hin, passe par samples.ts puis route()) : cloche FM
 * cristalline, sinus / triangle à enveloppe, corde pincée (koto), souffle
 * de bruit filtré. Chaque brique ne crée que quelques nœuds légers
 * (oscillateurs, gains, filtres) qui se déconnectent à la fin ; le bruit et
 * la réverbération sont des tampons partagés, créés une seule fois.
 *
 * Fonctionne sur tout BaseAudioContext (temps réel ou OfflineAudioContext,
 * utilisé par la QA pour mesurer niveau et durée de chaque son).
 */

export interface Bus {
  ctx: BaseAudioContext;
  /** Entrée sèche (vers le compresseur). */
  dry: AudioNode;
  /** Envoi vers la réverbération courte. */
  wet: AudioNode;
  /** Bruit blanc partagé (1 s, mono). */
  noise: AudioBuffer;
}

/** Plancher des rampes exponentielles (≈ −80 dB). */
const FLOOR = 0.0001;

/** Enveloppe percussive : 0 → crête (attaque linéaire) → plancher (exponentiel). */
export function percussive(param: AudioParam, t: number, peak: number, attack: number, end: number): void {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(FLOOR, end);
}

/** Relie une voix au bus (sec + envoi réverbération), déconnexion à la fin. */
export function route(bus: Bus, out: GainNode, wet: number, nodes: AudioNode[], last: AudioScheduledSourceNode): void {
  out.connect(bus.dry);
  const send = bus.ctx.createGain();
  send.gain.value = wet;
  out.connect(send).connect(bus.wet);
  nodes.push(out, send);
  last.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* déjà déconnecté */
      }
    }
  };
}

export interface BellOptions {
  peak: number;
  /** Fin de la résonance (s après l'attaque). */
  decay: number;
  /** Éclat de l'attaque (indice FM relatif) : 0 = sinus pur, 1 = verre. */
  bright?: number;
  wet?: number;
  /** Rapport du modulateur (inharmonique = cristallin). */
  ratio?: number;
}

/** Cloche FM : attaque cristalline qui s'adoucit en sinus pur. */
export function bell(bus: Bus, t: number, freq: number, o: BellOptions): void {
  const { ctx } = bus;
  const carrier = ctx.createOscillator();
  carrier.frequency.value = freq;
  const out = ctx.createGain();
  percussive(out.gain, t, o.peak, 0.004, t + o.decay);
  carrier.connect(out);
  const nodes: AudioNode[] = [carrier];
  const bright = o.bright ?? 0.8;
  let mod: OscillatorNode | null = null;
  if (bright > 0) {
    mod = ctx.createOscillator();
    mod.frequency.value = freq * (o.ratio ?? 3.51);
    const index = ctx.createGain();
    index.gain.setValueAtTime(freq * bright * 1.4, t);
    index.gain.exponentialRampToValueAtTime(freq * 0.002 + 0.01, t + Math.min(0.35, o.decay * 0.4));
    mod.connect(index).connect(carrier.frequency);
    nodes.push(mod, index);
    mod.start(t);
    mod.stop(t + o.decay + 0.05);
  }
  carrier.start(t);
  carrier.stop(t + o.decay + 0.05);
  route(bus, out, o.wet ?? 0.35, nodes, carrier);
}

export interface ToneOptions {
  peak: number;
  attack?: number;
  decay: number;
  type?: OscillatorType;
  wet?: number;
  /** Glissement de hauteur vers cette fréquence. */
  glideTo?: number;
  glideTime?: number;
  detune?: number;
  /** Tenue avant le relâchement (nappes) : la crête est tenue jusqu'à `t + hold`. */
  hold?: number;
}

/** Sinus / triangle à enveloppe (corps, notes douces, nappes). */
export function tone(bus: Bus, t: number, freq: number, o: ToneOptions): void {
  const { ctx } = bus;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + (o.glideTime ?? 0.15));
  if (o.detune !== undefined) osc.detune.value = o.detune;
  const out = ctx.createGain();
  const attack = o.attack ?? 0.006;
  if (o.hold !== undefined) {
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(o.peak, t + attack);
    out.gain.setValueAtTime(o.peak, t + Math.max(attack, o.hold));
    out.gain.exponentialRampToValueAtTime(FLOOR, t + o.decay);
  } else {
    percussive(out.gain, t, o.peak, attack, t + o.decay);
  }
  osc.connect(out);
  osc.start(t);
  osc.stop(t + o.decay + 0.05);
  route(bus, out, o.wet ?? 0.3, [osc], osc);
}

/** Corde pincée (koto / bois) : dent de scie dont le filtre se referme vite. */
export function pluck(bus: Bus, t: number, freq: number, o: { peak: number; decay: number; wet?: number }): void {
  const { ctx } = bus;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  // Légère retombée de hauteur à l'attaque, comme une corde de koto.
  osc.frequency.setValueAtTime(freq * 1.008, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.6;
  lp.frequency.setValueAtTime(Math.min(freq * 7, 5000), t);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.3, t + o.decay * 0.5);
  const out = ctx.createGain();
  percussive(out.gain, t, o.peak, 0.003, t + o.decay);
  osc.connect(lp).connect(out);
  osc.start(t);
  osc.stop(t + o.decay + 0.05);
  route(bus, out, o.wet ?? 0.3, [osc, lp], osc);
}

export interface BreathOptions {
  /** Filtre passe-bande : fréquences (Hz) aux instants relatifs (s). */
  sweep: ReadonlyArray<readonly [number, number]>;
  q: number;
  /** Enveloppe : points [instant relatif (s), niveau]. Le dernier tend vers 0. */
  shape: ReadonlyArray<readonly [number, number]>;
  wet?: number;
  type?: BiquadFilterType;
}

/** Souffle de bruit filtré (vent, bruissement, halo lumineux). */
export function breath(bus: Bus, t: number, o: BreathOptions): void {
  const { ctx } = bus;
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.Q.value = o.q;
  o.sweep.forEach(([at, f], i) => {
    if (i === 0) filter.frequency.setValueAtTime(f, t + at);
    else filter.frequency.exponentialRampToValueAtTime(f, t + at);
  });
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  for (const [at, level] of o.shape) out.gain.linearRampToValueAtTime(level, t + at);
  const end = o.shape[o.shape.length - 1]?.[0] ?? 0.5;
  src.connect(filter).connect(out);
  src.start(t, Math.random() * 0.3, end + 0.05);
  route(bus, out, o.wet ?? 0.4, [src, filter], src);
}

/** Bruit blanc partagé (1 s, mono, amplitude 0,5). */
export function createNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  return buffer;
}

/**
 * Réponse impulsionnelle d'une petite clairière (≈ 1,1 s) : bruit stéréo à
 * décroissance exponentielle, assombri au fil du temps (filtre à un pôle).
 */
export function createImpulse(ctx: BaseAudioContext, seconds = 1.1): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const x = i / length;
      const white = Math.random() * 2 - 1;
      // Le filtre se referme avec le temps : la queue est douce, sans sifflement.
      const k = 0.55 - 0.45 * x;
      low += k * (white - low);
      data[i] = low * Math.pow(1 - x, 2.4) * Math.exp(-4.2 * x);
    }
  }
  return buffer;
}
