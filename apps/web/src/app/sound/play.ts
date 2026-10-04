/**
 * Lecture des sons à travers UNE porte anti-rafale commune (`gate.ts`) :
 * la coquille (useSoundEvents) et les écrans qui jouent un son que l'état ne
 * dit pas (ex. l'article qui ressort du panier aux Courses) partagent les
 * mêmes créneaux. Deux sons ne se marchent donc jamais dessus, d'où qu'ils
 * viennent. Préférence « Petits sons » coupée ou page cachée : rien.
 */
import type { PlannedSound, SoundCue, SoundVoice } from './cues';
import { soundEngine } from './engine';
import { createSoundGate } from './gate';
import { getSoundPrefs } from './prefs';

const sharedGate = createSoundGate();

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function canPlay(): boolean {
  return getSoundPrefs().enabled && document.visibilityState !== 'hidden';
}

/** Joue un enchaînement planifié (planSounds) à travers la porte commune. */
export function playPlan(plan: readonly PlannedSound[], reduced: boolean): void {
  if (plan.length === 0 || !canPlay()) return;
  for (const p of sharedGate.admit(plan, performance.now(), { reduced })) {
    soundEngine.play(p.cue, { who: p.who ?? 'none', delayMs: p.delayMs, gentle: reduced });
  }
}

/** Un son isolé, joué par un écran (même porte que la coquille). */
export function playCue(cue: SoundCue, opts: { who?: SoundVoice; delayMs?: number } = {}): void {
  const planned: PlannedSound = { cue, delayMs: opts.delayMs ?? 0 };
  if (opts.who !== undefined) planned.who = opts.who;
  playPlan([planned], prefersReducedMotion());
}
