/**
 * Anti-rafale PUR (testé par Node, `detect.check.mjs`) : jamais deux sons à
 * moins de 120 ms d'écart, le même son répété de près est regroupé en un
 * seul, et rien ne s'accumule en file d'attente (cocher dix tâches d'affilée
 * ne déroule pas dix carillons en retard).
 *
 * Mouvement réduit : pas de sons répétitifs — le même son n'est pas rejoué
 * avant 1,5 s.
 */
import type { PlannedSound } from './cues';

export interface SoundGateOptions {
  /** Écart minimal entre deux débuts de sons. */
  minGapMs?: number;
  /** Même son à moins de cet écart : regroupé (un seul). */
  coalesceMs?: number;
  /** Même son, mouvement réduit. */
  reducedRepeatMs?: number;
  /** Retard maximal accepté : au-delà, le son est abandonné. */
  maxLagMs?: number;
}

export interface SoundGate {
  /**
   * Admet un enchaînement planifié à l'instant `nowMs` (horloge monotone) ;
   * retourne les sons à jouer, avec leurs décalages ajustés.
   */
  admit(plan: readonly PlannedSound[], nowMs: number, opts?: { reduced?: boolean }): PlannedSound[];
}

export function createSoundGate(options: SoundGateOptions = {}): SoundGate {
  const minGap = options.minGapMs ?? 120;
  const coalesce = options.coalesceMs ?? 400;
  const reducedRepeat = options.reducedRepeatMs ?? 1500;
  const maxLag = options.maxLagMs ?? 1600;
  let scheduled: Array<{ cue: PlannedSound['cue']; at: number }> = [];

  return {
    admit(plan, nowMs, opts = {}) {
      scheduled = scheduled.filter((s) => s.at > nowMs - 3000);
      const window = opts.reduced === true ? reducedRepeat : coalesce;
      const out: PlannedSound[] = [];
      for (const item of plan) {
        const wanted = nowMs + Math.max(0, item.delayMs);
        if (scheduled.some((s) => s.cue === item.cue && Math.abs(s.at - wanted) < window)) continue;
        // Premier créneau libre à partir de l'instant voulu (± minGap).
        let at = wanted;
        for (const s of [...scheduled].sort((x, y) => x.at - y.at)) {
          if (Math.abs(s.at - at) < minGap) at = s.at + minGap;
        }
        // Le retard s'apprécie par rapport à l'instant voulu (un enchaînement
        // prévu loin reste valable ; un son repoussé trop loin ne l'est plus).
        if (at - wanted > maxLag) continue;
        scheduled.push({ cue: item.cue, at });
        out.push({ ...item, delayMs: at - nowMs });
      }
      return out;
    },
  };
}
