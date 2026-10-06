/**
 * Les petits sons de la forêt, composés à partir des briques de `synth.ts`.
 * Tous en mi majeur pentatonique (mi, fa♯, sol♯, si, do♯) — consonants
 * entre eux et avec le carillon de la lanterne (mi 5 / si 5) : deux sons
 * qui se chevauchent ne créent jamais de dissonance.
 *
 * Durées : ≤ 1,2 s (le gardien, exception : ≤ 3 s). Niveaux bas, attaques
 * douces, aigus brefs : jamais criards.
 */
import type { SoundCue, SoundVoice } from './cues';
import { broom, coins, konpeito, shopBell, woodNote } from './moduleVoices';
import { bell, breath, pluck, tone, type Bus } from './synth';
import { balanceBell, lanternLit, lanternNew, nom } from './v4Voices';

const N = {
  B3: 246.94,
  E4: 329.63,
  Gs4: 415.3,
  B4: 493.88,
  E5: 659.25,
  Fs5: 739.99,
  Gs5: 830.61,
  B5: 987.77,
  Cs6: 1108.73,
  E6: 1318.51,
  Fs6: 1479.98,
  Gs6: 1661.22,
} as const;

export interface VoiceOptions {
  who?: SoundVoice;
  /** Mouvement réduit : moins de grains répétés (scintillement, feuilles). */
  gentle?: boolean;
}

/** Carillon cristallin : la lumière qui s'allume, teinté selon qui. */
function chime(bus: Bus, t: number, who: SoundVoice, level = 1): void {
  if (who === 'a') {
    // AL : aérien, montant, clair.
    [N.Gs5, N.B5, N.E6].forEach((f, i) =>
      bell(bus, t + i * 0.075, f, { peak: (0.11 - i * 0.012) * level, decay: 0.85, bright: 0.9, wet: 0.42 }),
    );
  } else if (who === 'b') {
    // AC : plus chaud, plus bas, attaque ronde et un peu de corps.
    [N.B4, N.E5, N.Gs5].forEach((f, i) =>
      bell(bus, t + i * 0.085, f, { peak: (0.13 - i * 0.012) * level, decay: 0.95, bright: 0.45, wet: 0.32 }),
    );
    tone(bus, t, N.B4 / 2, { peak: 0.05 * level, attack: 0.02, decay: 0.7, wet: 0.2 });
  } else if (who === 'both') {
    // Ensemble : les deux couleurs à la fois, en deux temps.
    bell(bus, t, N.E5, { peak: 0.085 * level, decay: 0.95, bright: 0.45, wet: 0.32 });
    bell(bus, t, N.B5, { peak: 0.075 * level, decay: 0.85, bright: 0.85, wet: 0.42 });
    bell(bus, t + 0.09, N.Gs5, { peak: 0.08 * level, decay: 0.95, bright: 0.5, wet: 0.35 });
    bell(bus, t + 0.09, N.E6, { peak: 0.06 * level, decay: 0.8, bright: 0.9, wet: 0.45 });
  } else {
    [N.E5, N.B5].forEach((f, i) =>
      bell(bus, t + i * 0.08, f, { peak: 0.11 * level, decay: 0.9, bright: 0.65, wet: 0.38 }),
    );
  }
}

/** Petit bol tibétain doux (corvée) : partiels de bol, léger battement. */
function bowl(bus: Bus, t: number): void {
  const f = N.B3;
  tone(bus, t, f, { peak: 0.13, attack: 0.025, decay: 1.15, wet: 0.45 });
  tone(bus, t, f, { peak: 0.07, attack: 0.03, decay: 1.1, wet: 0.45, detune: 6 });
  tone(bus, t, f * 2.76, { peak: 0.045, attack: 0.02, decay: 0.8, wet: 0.5 });
  tone(bus, t, f * 5.4, { peak: 0.016, attack: 0.015, decay: 0.45, wet: 0.5 });
}

/** Scintillement magique : quelques grains très brefs, très bas. */
function sparkle(bus: Bus, t: number, gentle: boolean): void {
  const notes = gentle ? [N.E6, N.B5] : [N.E6, N.Gs6, N.Cs6, N.Fs6, N.B5];
  notes.forEach((f, i) =>
    tone(bus, t + i * 0.048, f, { peak: 0.034 - i * 0.003, attack: 0.003, decay: 0.32, wet: 0.7 }),
  );
}

/** Note boisée (marimba) : sinus + partiel 3,9 très bref pour le « toc ». */
function woody(bus: Bus, t: number, f: number): void {
  tone(bus, t, f, { peak: 0.14, attack: 0.003, decay: 0.48, wet: 0.25 });
  tone(bus, t, f * 3.9, { peak: 0.035, attack: 0.002, decay: 0.07, wet: 0.1 });
}

/** Bruissement de feuilles : bruit aigu en petites bouffées. */
function leaves(bus: Bus, t: number, gentle: boolean): void {
  const puffs = gentle ? 3 : 6;
  const shape: Array<readonly [number, number]> = [];
  for (let i = 0; i < puffs; i++) {
    const at = 0.08 + i * (0.72 / puffs) + Math.random() * 0.04;
    shape.push([at, 0.006], [at + 0.025, 0.035 + Math.random() * 0.025], [at + 0.09, 0.006]);
  }
  shape.push([0.95, 0]);
  breath(bus, t, { type: 'highpass', sweep: [[0, 2600], [0.9, 3400]], q: 0.5, shape, wet: 0.35 });
}

/** Joue un son à l'instant `t` (horloge du contexte). */
export function renderCue(bus: Bus, cue: SoundCue, t: number, o: VoiceOptions = {}): void {
  const who = o.who ?? 'none';
  const gentle = o.gentle === true;
  switch (cue) {
    case 'done':
      chime(bus, t, who);
      return;
    case 'chore':
      bowl(bus, t);
      chime(bus, t + 0.12, who, 0.85);
      return;
    case 'undo':
      // Note douce qui redescend, à peine.
      tone(bus, t, N.B4, { peak: 0.2, attack: 0.012, decay: 0.36, glideTo: N.Fs5 / 2, glideTime: 0.16, wet: 0.25 });
      return;
    case 'skip':
      // Souffle de vent léger : monte, puis s'en va.
      breath(bus, t, {
        sweep: [[0, 420], [0.38, 1100], [0.85, 600]],
        q: 0.9,
        shape: [[0.32, 0.3], [0.6, 0.13], [0.9, 0]],
        wet: 0.45,
      });
      return;
    case 'creature':
      sparkle(bus, t, gentle);
      woody(bus, t + (gentle ? 0.1 : 0.22), N.Gs4);
      return;
    case 'growth':
      // Accord grave et chaud, égrené comme sur un koto.
      [N.B3, N.E4, N.B4].forEach((f, i) => pluck(bus, t + i * 0.055, f, { peak: 0.085, decay: 1.05, wet: 0.35 }));
      tone(bus, t, N.E4 / 2, { peak: 0.06, attack: 0.03, decay: 0.95, wet: 0.2 });
      leaves(bus, t + 0.05, gentle);
      return;
    case 'guardian':
      // Nappe éthérée, longue mais discrète (≤ 3 s).
      [N.E4, N.B4, N.E5, N.Gs5].forEach((f, i) => {
        const peak = 0.026 - i * 0.003;
        tone(bus, t, f, { peak, attack: 0.9, hold: 1.5, decay: 2.9, wet: 0.85, detune: -5 });
        tone(bus, t, f, { peak: peak * 0.8, attack: 1.0, hold: 1.5, decay: 2.9, wet: 0.85, detune: 5, type: 'triangle' });
      });
      [N.B5, N.E6, N.Gs6].forEach((f, i) =>
        tone(bus, t + 0.7 + i * 0.4, f, { peak: 0.022, attack: 0.01, decay: 0.6, wet: 0.9 }),
      );
      return;
    case 'circle':
      // Deux notes qui se répondent : une claire, puis une plus chaude.
      bell(bus, t, N.Gs5, { peak: 0.1, decay: 0.85, bright: 0.85, wet: 0.42 });
      bell(bus, t + 0.32, N.E5, { peak: 0.11, decay: 0.85, bright: 0.45, wet: 0.36 });
      return;
    case 'lantern':
      // Floraison lumineuse : arpège qui s'ouvre, halo de souffle.
      [N.E5, N.Gs5, N.B5, N.E6].forEach((f, i) =>
        bell(bus, t + i * 0.065, f, { peak: 0.085 - i * 0.008, decay: 0.9, bright: 0.4, wet: 0.55 }),
      );
      breath(bus, t, { sweep: [[0, 1800], [0.9, 3000]], q: 0.7, shape: [[0.35, 0.04], [1.0, 0]], wet: 0.7 });
      return;
    case 'coins':
      coins(bus, t, gentle);
      return;
    case 'konpeito':
      konpeito(bus, t, gentle);
      return;
    case 'broom':
      broom(bus, t, gentle);
      return;
    case 'shopBell':
      shopBell(bus, t, gentle);
      return;
    case 'woodNote':
      woodNote(bus, t);
      return;
    case 'nom':
      nom(bus, t, gentle);
      return;
    case 'balanceBell':
      balanceBell(bus, t, gentle);
      return;
    case 'lanternLit':
      lanternLit(bus, t, gentle);
      return;
    case 'lanternNew':
      lanternNew(bus, t, gentle);
      return;
  }
}
