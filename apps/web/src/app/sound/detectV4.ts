/**
 * Détection PURE des sons V4 (testée par vitest, `detectV4.test.ts`), à
 * partir de deux états successifs — mêmes règles que `detect.ts` : seules
 * les transitions pas à pas d'un geste sonnent, jamais le premier rendu ni
 * un état remplacé d'un bloc (import, remise à zéro).
 *
 * - `nom`         : un paiement coché (virement d'AL / d'AC fait, dépense
 *                   payée) dans un mois qui existait déjà. Décocher : rien.
 * - `balanceBell` : « Recaler sur le compte » (une correction ajoutée ou
 *                   changée). Rien si les mois changent en même temps
 *                   (« Effacer l'historique » pose une correction : pas de
 *                   cloche pour un effacement), rien pour un retrait.
 * - `lanternNew`  : la collection de lanternes s'agrandit (une session
 *                   terminée de plus a passé un seuil).
 * - `lanternLit`  : la lanterne de pierre s'allume — transition de l'état
 *                   du minuteur (hors AppState) : une NOUVELLE session passe
 *                   en cours. Reprendre après une pause ne rallume rien.
 */
import { unlockedLanterns, type AppState, type MonthRecord } from '@a2/core';
import type { SoundEvent } from './cues';
import { isWholesaleChange } from './detect';

/** Au-delà de ce nombre de cases cochées d'un coup : changement en bloc, silence. */
const MAX_STEP_PAID = 3;

function newlyPaid(prev: MonthRecord, next: MonthRecord): number {
  const pp = prev.paid;
  const np = next.paid;
  if (pp === np || np === undefined) return 0;
  let count = 0;
  if (np.transferA === true && pp?.transferA !== true) count += 1;
  if (np.transferB === true && pp?.transferB !== true) count += 1;
  const known = new Set(prev.expenses.map((e) => e.id));
  for (const [id, paid] of Object.entries(np.expenses ?? {})) {
    if (paid === true && pp?.expenses?.[id] !== true && known.has(id)) count += 1;
  }
  return count;
}

function paymentEvents(prev: AppState, next: AppState): SoundEvent[] {
  const pm = prev.budget.months;
  const nm = next.budget.months;
  if (pm === nm) return [];
  const before = new Map(pm.map((m) => [m.monthKey, m]));
  let count = 0;
  for (const month of nm) {
    const old = before.get(month.monthKey);
    if (old !== undefined && old !== month) count += newlyPaid(old, month);
  }
  return count > 0 && count <= MAX_STEP_PAID ? [{ cue: 'nom' }] : [];
}

function balanceEvents(prev: AppState, next: AppState): SoundEvent[] {
  const pb = prev.budget;
  const nb = next.budget;
  if (pb === nb || pb.balance === nb.balance || pb.months !== nb.months) return [];
  const before = new Map((pb.balance?.corrections ?? []).map((c) => [c.monthKey, c]));
  const changed = (nb.balance?.corrections ?? []).filter((c) => {
    const old = before.get(c.monthKey);
    return old === undefined || old.balanceCents !== c.balanceCents || old.recordedAt !== c.recordedAt;
  });
  return changed.length === 1 ? [{ cue: 'balanceBell' }] : [];
}

function lanternUnlockEvents(prev: AppState, next: AppState): SoundEvent[] {
  if (prev.focus === next.focus) return [];
  const added = (next.focus?.sessions.length ?? 0) - (prev.focus?.sessions.length ?? 0);
  if (added < 1 || added > 1) return [];
  return unlockedLanterns(next.focus).length > unlockedLanterns(prev.focus).length ? [{ cue: 'lanternNew' }] : [];
}

/** Sons V4 d'une transition d'AppState (vide au premier rendu et pour un remplacement). */
export function detectV4SoundEvents(prev: AppState | null, next: AppState | null): SoundEvent[] {
  if (prev === null || next === null || prev === next) return [];
  if (isWholesaleChange(prev, next)) return [];
  return [...paymentEvents(prev, next), ...balanceEvents(prev, next), ...lanternUnlockEvents(prev, next)];
}

/** Ce que la détection lit de l'état du minuteur (lanternStore). */
export interface LanternTimerView {
  phase: 'idle' | 'running' | 'paused' | 'done';
  sessionId: string | null;
}

/** Vrai quand une nouvelle session de lanterne commence (allumette + souffle). */
export function lanternLitNow(prev: LanternTimerView | null, next: LanternTimerView): boolean {
  if (prev === null || next.phase !== 'running' || next.sessionId === null) return false;
  if (prev.sessionId === next.sessionId && (prev.phase === 'running' || prev.phase === 'paused')) return false;
  return true;
}

/**
 * Le carillon d'une nouvelle lanterne arrive après la floraison de fin de
 * session (jouée par le contrôleur de la lanterne, ≈ 0,9 s).
 */
export const LANTERN_NEW_DELAY_MS = 950;
