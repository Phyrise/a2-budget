/**
 * Sons des compagnons (V4.3), mêmes briques et même gamme que la forêt (mi
 * majeur pentatonique). Courts, bas, attaques adoucies — un détail joué
 * seulement quand on touche un compagnon, jamais une sonnerie.
 *
 * - kodama : « karakara », le cliquetis de bois des têtes qui claquent ;
 * - Calcifer : crépitement qui s'élève ; grognement de braise s'il s'agace ;
 * - Totoro : long bâillement grave et feutré.
 * - Teto (V5.6) : pépiement de renard-écureuil, petit crachotement agacé,
 *   trille doux à la caresse ;
 * - Hin (V5.6) : « hin » respiré, double soupir sifflant, souffle satisfait.
 *   V5.7 : son vrai « hin » asthmatique, extrait du film — le seul son de
 *   l'app qui soit un fichier audio (samples.ts) ; la synthèse V5.6 reste
 *   le repli tant que l'échantillon n'est pas décodé.
 *
 * Tous les autres sons sont synthétisés (WebAudio, synth.ts).
 */
import { playSample, withSample } from './samples';
import { breath, route, tone, type Bus } from './synth';

const N = {
  E2: 82.41,
  Gs2: 103.83,
  B2: 123.47,
  E3: 164.81,
  Fs3: 185.0,
  Gs5: 830.61,
  B5: 987.77,
  Cs6: 1108.73,
  E6: 1318.51,
  Gs6: 1661.22,
} as const;

/** Petit « toc » de bois creux (triangle très bref, partiel boisé en option). */
function knock(bus: Bus, t: number, f: number, level: number, wood: boolean): void {
  tone(bus, t, f, { peak: 0.09 * level, attack: 0.002, decay: 0.07, wet: 0.14, type: 'triangle' });
  if (wood) tone(bus, t, f * 2.76, { peak: 0.018 * level, attack: 0.001, decay: 0.03, wet: 0.08 });
}

/**
 * Karakara : la tête claque de gauche à droite (deux hauteurs alternées, au
 * rythme de la secousse), puis deux voisins répondent, plus haut et plus loin.
 */
export function karakara(bus: Bus, t: number, gentle: boolean): void {
  const voices: Array<readonly [number, number, number, number, number]> = gentle
    ? [[0, 1, N.B5, N.Gs5, 7]]
    : [
        [0, 1, N.B5, N.Gs5, 11],
        [0.28, 0.5, N.Cs6, N.B5, 7],
        [0.44, 0.32, N.E6, N.Cs6, 6],
      ];
  voices.forEach(([start, level, hi, lo, clicks], v) => {
    for (let i = 0; i < clicks; i++) {
      const fade = 1 - (i / clicks) * 0.7;
      knock(bus, t + start + i * 0.076 + Math.random() * 0.008, i % 2 === 0 ? hi : lo, level * fade, v === 0);
    }
  });
}

/** Calcifer touché : quelques braises qui crépitent, la flamme qui s'élève. */
export function crackle(bus: Bus, t: number, gentle: boolean): void {
  const pops = gentle ? 3 : 6;
  const shape: Array<readonly [number, number]> = [];
  for (let i = 0; i < pops; i++) {
    const at = 0.02 + i * 0.06 + Math.random() * 0.025;
    shape.push([at, 0.002], [at + 0.006, 0.07 + Math.random() * 0.05], [at + 0.03, 0.002]);
  }
  shape.push([0.5, 0]);
  breath(bus, t, { type: 'highpass', sweep: [[0, 1800], [0.5, 2600]], q: 0.7, shape, wet: 0.22 });
  // Souffle chaud qui monte.
  breath(bus, t, { type: 'lowpass', sweep: [[0, 300], [0.45, 900], [0.7, 500]], q: 0.8, shape: [[0.12, 0.07], [0.4, 0.045], [0.72, 0]], wet: 0.3 });
}

/** Calcifer agacé : grognement de braise (dents de scie étouffées, roulement), bouffée de fumée. */
export function grumble(bus: Bus, t: number, gentle: boolean): void {
  const { ctx } = bus;
  const len = gentle ? 0.55 : 0.8;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(N.B2, t);
  osc.frequency.exponentialRampToValueAtTime(N.E2, t + len);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.8;
  lp.frequency.setValueAtTime(380, t);
  lp.frequency.linearRampToValueAtTime(620, t + 0.15);
  lp.frequency.exponentialRampToValueAtTime(260, t + len);
  // Roulement : le grognement tremble.
  const trem = ctx.createGain();
  trem.gain.value = 0.55;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 16;
  const depth = ctx.createGain();
  depth.gain.value = 0.45;
  lfo.connect(depth).connect(trem.gain);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.11, t + 0.07);
  out.gain.setValueAtTime(0.11, t + len * 0.45);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(lp).connect(trem).connect(out);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + len + 0.05);
  lfo.stop(t + len + 0.05);
  route(bus, out, 0.18, [osc, lp, trem, lfo, depth], osc);
  // Petite bouffée de fumée.
  breath(bus, t + len * 0.6, { sweep: [[0, 500], [0.25, 1300], [0.5, 700]], q: 0.9, shape: [[0.1, 0.06], [0.5, 0]], wet: 0.4 });
}

/** Totoro bâille : une voix grave qui s'ouvre puis se referme, un long souffle feutré. */
export function yawn(bus: Bus, t: number, gentle: boolean): void {
  const { ctx } = bus;
  const level = gentle ? 0.7 : 1;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(N.Gs2, t);
  osc.frequency.exponentialRampToValueAtTime(N.B2, t + 0.4);
  osc.frequency.exponentialRampToValueAtTime(N.E2, t + 0.95);
  const mouth = ctx.createBiquadFilter();
  mouth.type = 'lowpass';
  mouth.Q.value = 3;
  mouth.frequency.setValueAtTime(320, t);
  mouth.frequency.exponentialRampToValueAtTime(880, t + 0.42);
  mouth.frequency.exponentialRampToValueAtTime(300, t + 0.95);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.13 * level, t + 0.28);
  out.gain.linearRampToValueAtTime(0.09 * level, t + 0.65);
  out.gain.linearRampToValueAtTime(0, t + 1.0);
  osc.connect(mouth).connect(out);
  osc.start(t);
  osc.stop(t + 1.05);
  route(bus, out, 0.3, [osc, mouth], osc);
  tone(bus, t + 0.08, N.E3, { peak: 0.02 * level, attack: 0.25, hold: 0.45, decay: 0.95, wet: 0.35 });
  breath(bus, t, { sweep: [[0, 500], [0.4, 900], [0.9, 380]], q: 1.2, shape: [[0.25, 0.05 * level], [0.65, 0.035 * level], [0.98, 0]], wet: 0.35 });
}

/**
 * Jiji caressé : ronron. Un souffle grave et feutré, battu à ~24 Hz (le
 * roulement du chat), qui inspire puis expire.
 */
export function purr(bus: Bus, t: number, gentle: boolean): void {
  const { ctx } = bus;
  const level = gentle ? 0.6 : 1;
  const len = 1.1;
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.9;
  lp.frequency.setValueAtTime(240, t);
  lp.frequency.linearRampToValueAtTime(320, t + len * 0.4);
  lp.frequency.linearRampToValueAtTime(200, t + len);
  const trem = ctx.createGain();
  trem.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(trem.gain);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.16 * level, t + 0.18);
  out.gain.linearRampToValueAtTime(0.07 * level, t + len * 0.5);
  out.gain.linearRampToValueAtTime(0.13 * level, t + len * 0.7);
  out.gain.linearRampToValueAtTime(0, t + len);
  src.connect(lp).connect(trem).connect(out);
  src.start(t, Math.random() * 0.3, len + 0.05);
  lfo.start(t);
  lfo.stop(t + len + 0.05);
  route(bus, out, 0.12, [src, lp, trem, lfo, depth], src);
  tone(bus, t, N.E2, { peak: 0.025 * level, attack: 0.2, hold: 0.5, decay: 1, wet: 0.1, type: 'triangle' });
}

/**
 * Teto touché : pépiement de renard-écureuil, deux notes vives qui montent
 * (chacune glisse vers le haut, très brève).
 */
export function chirp(bus: Bus, t: number, gentle: boolean): void {
  tone(bus, t, N.B5, { peak: 0.045, attack: 0.005, decay: 0.08, glideTo: N.E6, glideTime: 0.03, wet: 0.2 });
  tone(bus, t + 0.085, N.Cs6, { peak: 0.04, attack: 0.005, decay: 0.1, glideTo: N.Gs6, glideTime: 0.035, wet: 0.22 });
  // Petit corps : la gorge, pas seulement le sifflet.
  tone(bus, t, N.Gs5, { peak: 0.008, attack: 0.008, decay: 0.16, wet: 0.15, type: 'triangle' });
  if (!gentle) tone(bus, t + 0.2, N.E6, { peak: 0.018, attack: 0.006, decay: 0.07, glideTo: N.Gs6, glideTime: 0.03, wet: 0.25 });
}

/**
 * Teto agacé : petit crachotement (deux bouffées de bruit aigu, la seconde
 * plus longue), comme un renard qui siffle entre ses dents.
 */
export function hiss(bus: Bus, t: number, gentle: boolean): void {
  const shape: Array<readonly [number, number]> = gentle
    ? [[0.012, 0.055], [0.1, 0.02], [0.2, 0]]
    : [[0.01, 0.05], [0.06, 0.012], [0.09, 0.006], [0.11, 0.06], [0.24, 0.03], [0.38, 0]];
  breath(bus, t, { type: 'highpass', sweep: [[0, 3200], [0.12, 4200], [0.38, 3600]], q: 0.8, shape, wet: 0.15 });
  // Un peu de souffle plus bas : la bouche, pas un pneu.
  breath(bus, t, { sweep: [[0, 1800], [0.3, 1400]], q: 1.4, shape: [[0.02, 0.025], [0.12, 0.03], [0.3, 0]], wet: 0.15 });
}

/** Teto caressé : trille doux, deux notes qui alternent vite et s'éteignent. */
export function trill(bus: Bus, t: number, gentle: boolean): void {
  const notes = gentle ? 5 : 9;
  for (let i = 0; i < notes; i++) {
    const fade = 1 - (i / notes) * 0.75;
    tone(bus, t + i * 0.05, i % 2 === 0 ? N.Cs6 : N.E6, { peak: 0.026 * fade, attack: 0.01, decay: 0.09, wet: 0.3 });
  }
  tone(bus, t, N.Gs5, { peak: 0.01, attack: 0.04, hold: 0.2, decay: notes * 0.05 + 0.1, wet: 0.3, type: 'triangle' });
}

/**
 * Le nez de Hin : une note grave nasale (dents de scie dans un filtre étroit
 * vers 700 Hz) qui retombe un peu, très courte.
 */
function nasal(bus: Bus, t: number, f: number, len: number, level: number): void {
  const { ctx } = bus;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f * 1.06, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.94, t + len);
  const nose = ctx.createBiquadFilter();
  nose.type = 'bandpass';
  nose.Q.value = 4;
  nose.frequency.setValueAtTime(760, t);
  nose.frequency.exponentialRampToValueAtTime(560, t + len);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.09 * level, t + 0.03);
  out.gain.setValueAtTime(0.09 * level, t + len * 0.4);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(nose).connect(out);
  osc.start(t);
  osc.stop(t + len + 0.05);
  route(bus, out, 0.15, [osc, nose], osc);
}

/** Un « hin » : souffle par le nez (bruit filtré, petit sifflement) + la note nasale. */
function hinBreath(bus: Bus, t: number, f: number, len: number, level: number): void {
  breath(bus, t, {
    sweep: [[0, 900], [len * 0.35, 1400], [len, 700]],
    q: 1.6,
    shape: [[0.025, 0.07 * level], [len * 0.45, 0.045 * level], [len, 0]],
    wet: 0.18,
  });
  // Le sifflement du vieux nez.
  breath(bus, t + 0.02, { sweep: [[0, 2500], [len, 2200]], q: 9, shape: [[0.04, 0.03 * level], [len * 0.7, 0]], wet: 0.2 });
  nasal(bus, t, f, len * 0.75, level);
}

/**
 * V5.7 : le vrai « hin » de Hin, extrait du film (échantillon, samples.ts).
 * Gain de voix réglé pour une crête comparable aux autres compagnons au
 * niveau de l'app (mesure hors ligne, bus maître : toucher et agacé
 * ≈ −28 dBFS, caresse ≈ −29,5, modes doux −31 à −32 ; Jiji ≈ −30,
 * Calcifer ≈ −25, l'ancien « hin » synthétisé ≈ −31). La synthèse ci-dessus reste le repli tant que
 * l'échantillon n'est pas décodé.
 */
export const HIN_GAIN = 0.06;

/** Hin touché : son « hin », une seule fois, sans s'émouvoir. Doux : plus bas. */
export function huff(bus: Bus, t: number, gentle: boolean): void {
  withSample(
    bus,
    'hin',
    t,
    (buffer, at) => playSample(bus, buffer, at, { gain: HIN_GAIN * (gentle ? 0.7 : 1) }),
    (at) => hinBreath(bus, at, N.E3, 0.3, gentle ? 0.7 : 1),
  );
}

/** Hin agacé : « hin… hin », le second plus grave et un peu traîné. Doux : un seul, plus bas. */
export function sigh(bus: Bus, t: number, gentle: boolean): void {
  withSample(
    bus,
    'hin',
    t,
    (buffer, at) => {
      if (gentle) {
        playSample(bus, buffer, at, { gain: HIN_GAIN * 0.7, rate: 0.94 });
        return;
      }
      playSample(bus, buffer, at, { gain: HIN_GAIN });
      playSample(bus, buffer, at + 0.45, { gain: HIN_GAIN * 0.85, rate: 0.9, wet: 0.24 });
    },
    (at) => sighSynth(bus, at, gentle),
  );
}

/** Repli synthétisé du soupir (V5.6) : deux soupirs sifflants, le second plus bas et plus long. */
function sighSynth(bus: Bus, t: number, gentle: boolean): void {
  if (gentle) {
    hinBreath(bus, t, N.E3, 0.42, 0.75);
    return;
  }
  hinBreath(bus, t, N.Fs3, 0.36, 1);
  hinBreath(bus, t + 0.52, N.E3, 0.6, 0.85);
}

/**
 * Hin caressé : le « hin » ralenti et plus doux, puis un souffle satisfait
 * très bas par le nez. Doux : le « hin » seul, plus bas.
 */
export function snuffle(bus: Bus, t: number, gentle: boolean): void {
  withSample(
    bus,
    'hin',
    t,
    (buffer, at) => {
      playSample(bus, buffer, at, { gain: HIN_GAIN * (gentle ? 0.6 : 0.8), rate: 0.87, wet: 0.26 });
      if (!gentle) contentBreath(bus, at + 0.28, 0.75, 0.35);
    },
    (at) => snuffleSynth(bus, at, gentle),
  );
}

/** Souffle satisfait par le nez : passe-bas qui s'ouvre puis retombe lentement. */
function contentBreath(bus: Bus, t: number, len: number, level: number): void {
  breath(bus, t, {
    type: 'lowpass',
    sweep: [[0, 420], [len * 0.29, 900], [len, 320]],
    q: 0.8,
    shape: [[len * 0.21, 0.09 * level], [len * 0.52, 0.06 * level], [len, 0]],
    wet: 0.25,
  });
}

/** Repli synthétisé de la caresse (V5.6) : un long souffle satisfait, qui retombe lentement. */
function snuffleSynth(bus: Bus, t: number, gentle: boolean): void {
  const level = gentle ? 0.65 : 1;
  contentBreath(bus, t, 1.05, level);
  breath(bus, t + 0.05, { sweep: [[0, 2300], [0.8, 2000]], q: 8, shape: [[0.25, 0.018 * level], [0.8, 0]], wet: 0.25 });
  tone(bus, t + 0.04, N.E2, { peak: 0.03 * level, attack: 0.2, hold: 0.45, decay: 1.05, wet: 0.15, type: 'triangle' });
}
