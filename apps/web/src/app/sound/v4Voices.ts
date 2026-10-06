/**
 * Sons V4, mêmes briques et même gamme que la forêt (mi majeur
 * pentatonique) : consonants avec tout le reste. Courts (≤ 1,2 s), bas,
 * attaques adoucies — un détail, jamais une sonnerie.
 *
 * - Budget : un paiement coché, les pièces tombent dans la bouche du
 *   Sans-Visage (« nom » doux) ; le solde recalé, une petite cloche ;
 * - Lanternes de pierre : allumette frottée puis souffle chaud quand la
 *   lanterne s'allume ; carillon pour un nouveau modèle débloqué.
 */
import { bell, breath, tone, type Bus } from './synth';

const N = {
  E3: 164.81,
  Gs3: 207.65,
  B3: 246.94,
  E4: 329.63,
  B4: 493.88,
  E5: 659.25,
  Gs5: 830.61,
  B5: 987.77,
  E6: 1318.51,
  Gs6: 1661.22,
  B6: 1975.53,
} as const;

/**
 * Le Sans-Visage mange l'argent : deux pièces qui tombent (la seconde un
 * peu plus grave, comme si elle s'enfonçait), puis un « nom » rond et feutré
 * — un sinus grave qui glisse vers le bas, la bouche qui se referme.
 */
export function nom(bus: Bus, t: number, gentle: boolean): void {
  const drops: Array<readonly [number, number, number]> = gentle
    ? [[0, N.B6, 0.04]]
    : [
        [0, N.B6, 0.04],
        [0.07, N.Gs6, 0.034],
      ];
  for (const [at, f, peak] of drops) {
    bell(bus, t + at, f, { peak, decay: 0.3, bright: 1, ratio: 2.41, wet: 0.28 });
  }
  const m = t + (gentle ? 0.12 : 0.17);
  // « n- » : murmure nasal très court, puis « -om » qui s'arrondit et descend.
  tone(bus, m, N.B3, { peak: 0.05, attack: 0.025, decay: 0.2, glideTo: N.Gs3, glideTime: 0.16, wet: 0.12 });
  tone(bus, m, N.B3 * 2, { peak: 0.012, attack: 0.03, decay: 0.14, glideTo: N.Gs3 * 2, glideTime: 0.12, wet: 0.1, type: 'triangle' });
  if (!gentle) {
    // Petit « mm » satisfait, plus bas encore.
    tone(bus, m + 0.2, N.Gs3, { peak: 0.028, attack: 0.04, decay: 0.26, glideTo: N.E3, glideTime: 0.22, wet: 0.15 });
  }
}

/** Le solde recalé : une petite cloche claire, et son écho plus doux. */
export function balanceBell(bus: Bus, t: number, gentle: boolean): void {
  bell(bus, t, N.B5, { peak: 0.085, decay: 1.05, bright: 0.7, ratio: 2.76, wet: 0.45 });
  bell(bus, t, N.E5, { peak: 0.03, decay: 0.9, bright: 0.2, wet: 0.4 });
  if (!gentle) bell(bus, t + 0.24, N.E6, { peak: 0.035, decay: 0.75, bright: 0.5, ratio: 2.76, wet: 0.55 });
}

/**
 * La lanterne de pierre s'allume : l'allumette frottée (bruit aigu bref,
 * deux crépitements), puis la flamme qui prend — un souffle chaud et grave
 * qui s'ouvre, et une note tiède à peine audible.
 */
export function lanternLit(bus: Bus, t: number, gentle: boolean): void {
  // Le frottement.
  breath(bus, t, {
    type: 'highpass',
    sweep: [
      [0, 2400],
      [0.08, 5600],
    ],
    q: 0.6,
    shape: [
      [0.012, 0.09],
      [0.05, 0.05],
      [0.1, 0],
    ],
    wet: 0.15,
  });
  if (!gentle) {
    // Deux crépitements de la tête d'allumette.
    breath(bus, t + 0.09, { type: 'bandpass', sweep: [[0, 4200]], q: 2.5, shape: [[0.006, 0.07], [0.03, 0]], wet: 0.1 });
    breath(bus, t + 0.15, { type: 'bandpass', sweep: [[0, 3600]], q: 2.5, shape: [[0.006, 0.045], [0.028, 0]], wet: 0.1 });
  }
  // La flamme prend : souffle chaud (passe-bas qui s'ouvre puis se pose).
  const f = t + 0.12;
  breath(bus, f, {
    type: 'lowpass',
    sweep: [
      [0, 260],
      [0.32, 900],
      [0.95, 520],
    ],
    q: 0.7,
    shape: [
      [0.18, 0.13],
      [0.5, 0.08],
      [1.0, 0],
    ],
    wet: 0.35,
  });
  tone(bus, f + 0.08, N.E4, { peak: 0.028, attack: 0.25, decay: 1.05, wet: 0.5 });
  tone(bus, f + 0.08, N.B4, { peak: 0.012, attack: 0.3, decay: 0.95, wet: 0.6, detune: 4 });
}

/** Un nouveau modèle de lanterne : carillon qui monte, puis un éclat suspendu. */
export function lanternNew(bus: Bus, t: number, gentle: boolean): void {
  const notes = gentle ? [N.E5, N.B5, N.E6] : [N.E5, N.Gs5, N.B5, N.E6, N.Gs6];
  notes.forEach((f, i) =>
    bell(bus, t + i * 0.09, f, { peak: 0.08 - i * 0.008, decay: 0.95, bright: 0.75, ratio: 3.51, wet: 0.5 }),
  );
  if (!gentle) bell(bus, t + 0.62, N.B6, { peak: 0.022, decay: 0.6, bright: 0.4, wet: 0.7 });
}
