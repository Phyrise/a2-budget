/**
 * Étalonnage par LUT : quelle LUT, à quelle intensité, et fondu entre la LUT
 * courante (A) et la cible (B).
 *
 * - Pause : nuit de la saison peinte (LUT propre à la saison, sinon nuit de base), pleine.
 * - Jour : LUT d'humeur (calculée sur l'été) ; atténuée hors été (MOOD_LUT_AMOUNT).
 * La cible suit la saison PEINTE (pas la saison demandée) : l'étalonnage
 * change avec la peinture, pendant son fondu.
 * Nuit de saison indisponible (hors ligne avant sa mise en cache) : repli sur
 * la nuit de base, précachée (loadSlotLut).
 */
import type { Season, WorldManifest, WorldState } from '../types';
import { now, type WorldEngine } from './Engine';
import { cloneParams, MOODS } from './moods';
import { MOOD_LUT_AMOUNT, nightLutUrl } from './paint';

export interface LutSlot {
  url: string | null;
  /** 0..1 : mélange entre l'image d'origine et la LUT. */
  amount: number;
  /** LUT de nuit (pause) : repli possible sur la nuit de base. */
  night?: boolean;
}

export function gradeSlot(m: WorldManifest, s: Pick<WorldState, 'mood' | 'paused'>, painted: Season): LutSlot {
  if (s.paused) return { url: nightLutUrl(m, painted), amount: 1, night: true };
  return { url: m.luts[s.mood], amount: MOOD_LUT_AMOUNT[painted] ?? 1 };
}

const sameSlot = (a: LutSlot, b: LutSlot) => a.url === b.url && Math.abs(a.amount - b.amount) < 1e-3;

/** Recalcule l'ambiance cible (humeur) et la LUT cible ; `initial` = sans fondu (`load` : charge sa LUT). */
export function retargetGrade(e: WorldEngine, initial: boolean, load = false) {
  const s = e.state;
  if (!s) return;
  e.target = cloneParams(MOODS[s.mood]);
  const slot = gradeSlot(e.cfg.manifest, s, e.paintedSeason);
  if (initial) {
    e.mood = cloneParams(e.target);
    e.night = s.paused ? 1 : 0;
    e.lutA = slot;
    e.lutB = slot;
    e.lutStart = -10;
    if (load) void loadSlotLut(e, slot);
    return;
  }
  if (sameSlot(slot, e.lutB)) return;
  const n = now();
  if (e.lutMix(n) > 0.5) e.lutA = e.lutB;
  e.lutB = slot;
  e.lutStart = n;
  void loadSlotLut(e, slot);
}

/**
 * Charge la LUT d'un emplacement ; une nuit de saison qui échoue est remplacée
 * (dans lutA / lutB) par la nuit de base. Ne rejette jamais.
 */
export async function loadSlotLut(e: WorldEngine, slot: LutSlot): Promise<void> {
  const t = await e.res.loadLut(slot.url);
  const base = e.cfg.manifest.luts.night;
  if (!t && slot.night && slot.url && base && slot.url !== base && !e.isDestroyed) {
    const repl: LutSlot = { url: base, amount: slot.amount, night: true };
    if (e.lutA === slot) e.lutA = repl;
    if (e.lutB === slot) e.lutB = repl;
    await e.res.loadLut(base);
  }
  if (!e.isDestroyed) e.requestFrame(true);
}
