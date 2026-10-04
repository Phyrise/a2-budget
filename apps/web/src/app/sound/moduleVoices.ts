/**
 * Sons des univers de module (V3.2), mêmes briques et même gamme que la
 * forêt (mi majeur pentatonique) : deux sons qui se chevauchent restent
 * consonants. Courts (≤ 0,9 s), bas, attaques adoucies — un détail, jamais
 * une sonnerie.
 *
 * - Budget (Le Voyage de Chihiro) : pièces d'or qui tintent, kompeitō ;
 * - Courses (Kiki) : coup de balai, clochette de la boulangerie ;
 * - Calendrier : note de bois douce.
 */
import { bell, breath, tone, type Bus } from './synth';

const N = {
  B4: 493.88,
  E5: 659.25,
  Gs5: 830.61,
  B5: 987.77,
  Cs6: 1108.73,
  E6: 1318.51,
  Fs6: 1479.98,
  Gs6: 1661.22,
  B6: 1975.53,
} as const;

/** Petit écart aléatoire (ms → s) : deux pièces ne tombent jamais pile ensemble. */
function jitter(maxMs: number): number {
  return (Math.random() * maxMs) / 1000;
}

/** Pièces d'or qui tintent : trois petites frappes métalliques, la dernière plus claire. */
export function coins(bus: Bus, t: number, gentle: boolean): void {
  const strikes: Array<readonly [number, number, number]> = gentle
    ? [
        [0, N.E6, 0.05],
        [0.09, N.B6, 0.04],
      ]
    : [
        [0, N.E6, 0.05],
        [0.075, N.Gs6, 0.042],
        [0.16, N.B6, 0.038],
      ];
  for (const [at, f, peak] of strikes) {
    const when = t + at + jitter(18);
    // Rapport inharmonique (métal) et éclat bref : « ting », pas « dong ».
    bell(bus, when, f, { peak, decay: 0.42, bright: 1.1, ratio: 2.41, wet: 0.3 });
    tone(bus, when, f * 2.76, { peak: peak * 0.3, attack: 0.002, decay: 0.09, wet: 0.2 });
  }
}

/** Kompeitō : un bonbon de sucre qui rebondit, trois grains de plus en plus serrés. */
export function konpeito(bus: Bus, t: number, gentle: boolean): void {
  const hops = gentle ? [0, 0.11] : [0, 0.1, 0.17, 0.215];
  hops.forEach((at, i) => {
    const f = i % 2 === 0 ? N.Fs6 : N.Cs6;
    tone(bus, t + at, f, { peak: 0.05 - i * 0.009, attack: 0.002, decay: 0.14, wet: 0.45, type: 'triangle' });
  });
  bell(bus, t, N.B5, { peak: 0.04, decay: 0.5, bright: 0.6, wet: 0.45 });
}

/** Coup de balai de Kiki : souffle filtré qui balaie vers l'aigu, puis retombe. */
export function broom(bus: Bus, t: number): void {
  breath(bus, t, {
    sweep: [
      [0, 900],
      [0.16, 3600],
      [0.36, 1500],
    ],
    q: 0.85,
    shape: [
      [0.05, 0.2],
      [0.18, 0.12],
      [0.38, 0],
    ],
    wet: 0.22,
  });
  // Les brindilles : un second souffle plus fin, juste derrière.
  breath(bus, t + 0.05, {
    type: 'highpass',
    sweep: [
      [0, 3200],
      [0.25, 5200],
    ],
    q: 0.5,
    shape: [
      [0.04, 0.05],
      [0.26, 0],
    ],
    wet: 0.2,
  });
}

/** Clochette de la porte de la boulangerie : deux petites cloches qui se balancent. */
export function shopBell(bus: Bus, t: number, gentle: boolean): void {
  const swings: Array<readonly [number, number, number]> = gentle
    ? [
        [0, N.B5, 0.07],
        [0.13, N.E6, 0.05],
      ]
    : [
        [0, N.B5, 0.07],
        [0.11, N.E6, 0.06],
        [0.23, N.B5, 0.045],
        [0.36, N.E6, 0.03],
      ];
  for (const [at, f, peak] of swings) {
    bell(bus, t + at, f, { peak, decay: 0.75, bright: 0.95, ratio: 2.76, wet: 0.4 });
  }
}

/** Note de bois douce (calendrier) : marimba feutré, un « toc » à peine. */
export function woodNote(bus: Bus, t: number): void {
  tone(bus, t, N.Gs5 / 2, { peak: 0.12, attack: 0.004, decay: 0.42, wet: 0.25 });
  tone(bus, t, (N.Gs5 / 2) * 3.9, { peak: 0.025, attack: 0.002, decay: 0.06, wet: 0.1 });
  tone(bus, t + 0.12, N.B4, { peak: 0.06, attack: 0.004, decay: 0.36, wet: 0.3 });
  tone(bus, t + 0.12, N.E5 / 2, { peak: 0.02, attack: 0.01, decay: 0.3, wet: 0.2 });
}
