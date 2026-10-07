/**
 * Détection PURE des sons V4 (testée par vitest, `detectV4.test.ts`), à
 * partir de deux états successifs — mêmes règles que `detect.ts` : seules
 * les transitions pas à pas d'un geste sonnent, jamais le premier rendu ni
 * un état remplacé d'un bloc (import, remise à zéro).
 *
 * - `nom` / `spend` : une case du mois cochée ou décochée, dans un mois qui
 *                   existait déjà, selon le sens du compte (V4.2) : il monte
 *                   (virement coché, dépense décochée) → `nom` ; il descend
 *                   (dépense cochée, virement décoché) → `spend`.
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
import { isExpensePaid, isTransferPaid, unlockedLanterns, type AppState, type MonthRecord } from '@a2/core';
import type { SoundEvent } from './cues';
import { isWholesaleChange } from './detect';

/** Au-delà de ce nombre de cases changées d'un coup : changement en bloc, silence. */
const MAX_STEP_PAID = 3;

/** Cases changées entre deux versions d'un mois : combien font monter / descendre le compte. */
function paidSteps(prev: MonthRecord, next: MonthRecord): { up: number; down: number } {
  const steps = { up: 0, down: 0 };
  if (prev.paid === next.paid) return steps;
  for (const who of ['A', 'B'] as const) {
    const now = isTransferPaid(next, who);
    if (now !== isTransferPaid(prev, who)) steps[now ? 'up' : 'down'] += 1;
  }
  // Seules les dépenses présentes avant et après (un retrait n'est pas un décochage).
  const known = new Set(prev.expenses.map((e) => e.id));
  for (const e of next.expenses) {
    if (!known.has(e.id)) continue;
    const now = isExpensePaid(next, e.id);
    if (now !== isExpensePaid(prev, e.id)) steps[now ? 'down' : 'up'] += 1;
  }
  return steps;
}

function paymentEvents(prev: AppState, next: AppState): SoundEvent[] {
  const pm = prev.budget.months;
  const nm = next.budget.months;
  if (pm === nm) return [];
  const before = new Map(pm.map((m) => [m.monthKey, m]));
  let up = 0;
  let down = 0;
  for (const month of nm) {
    const old = before.get(month.monthKey);
    if (old === undefined || old === month) continue;
    const steps = paidSteps(old, month);
    up += steps.up;
    down += steps.down;
  }
  if (up + down === 0 || up + down > MAX_STEP_PAID || up === down) return [];
  return [{ cue: up > down ? 'nom' : 'spend' }];
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
