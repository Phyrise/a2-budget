/**
 * Sons des compagnons (V4.3), mêmes briques et même gamme que la forêt (mi
 * majeur pentatonique). Courts, bas, attaques adoucies — un détail joué
 * seulement quand on touche un compagnon, jamais une sonnerie.
 *
 * - kodama : « karakara », le cliquetis de bois des têtes qui claquent ;
 * - Calcifer : crépitement qui s'élève ; grognement de braise s'il s'agace ;
 * - Totoro : long bâillement grave et feutré.
 */
import { breath, route, tone, type Bus } from './synth';

const N = {
  E2: 82.41,
  Gs2: 103.83,
  B2: 123.47,
  E3: 164.81,
  Gs5: 830.61,
  B5: 987.77,
  Cs6: 1108.73,
  E6: 1318.51,
} as const;

/** Petit « toc » de bois creux (triangle très bref, partiel boisé en option). */
function knock(bus: Bus, t: number, f: number, level: number, wood: boolean): void {
  tone(bus, t, f, { peak: 0.07 * level, attack: 0.002, decay: 0.07, wet: 0.14, type: 'triangle' });
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
        [0, 1, N.B5, N.Gs5, 12],
        [0.3, 0.5, N.Cs6, N.B5, 9],
        [0.48, 0.32, N.E6, N.Cs6, 8],
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
  osc.frequency.exponentialRampToValueAtTime(N.B2, t + 0.5);
  osc.frequency.exponentialRampToValueAtTime(N.E2, t + 1.4);
  const mouth = ctx.createBiquadFilter();
  mouth.type = 'lowpass';
  mouth.Q.value = 3;
  mouth.frequency.setValueAtTime(320, t);
  mouth.frequency.exponentialRampToValueAtTime(880, t + 0.55);
  mouth.frequency.exponentialRampToValueAtTime(300, t + 1.4);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.13 * level, t + 0.35);
  out.gain.linearRampToValueAtTime(0.1 * level, t + 0.9);
  out.gain.linearRampToValueAtTime(0, t + 1.5);
  osc.connect(mouth).connect(out);
  osc.start(t);
  osc.stop(t + 1.55);
  route(bus, out, 0.3, [osc, mouth], osc);
  tone(bus, t + 0.1, N.E3, { peak: 0.02 * level, attack: 0.3, hold: 0.6, decay: 1.3, wet: 0.35 });
  breath(bus, t, { sweep: [[0, 500], [0.5, 900], [1.3, 380]], q: 1.2, shape: [[0.3, 0.05 * level], [0.9, 0.035 * level], [1.45, 0]], wet: 0.35 });
}
