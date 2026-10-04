/**
 * Données du mode développeur : tous les chiffres cachés de la forêt et
 * les constantes du domaine, lus via l'API publique de @a2/core (rien n'est
 * recalculé ici), plus l'instantané JSON du bouton « Copier l'état ».
 * Lecture seule : rien n'est écrit dans les données.
 */
import {
  CREATURES,
  DAILY_CREDIT_CAP,
  DAILY_DECAY,
  ENVIRONMENTS,
  GROWTH_THRESHOLDS,
  GUARDIAN_STREAK,
  INACTIVITY_GRACE_DAYS,
  VITALITY_MAX,
  VITALITY_PER_CREDIT,
  VITALITY_STATE_THRESHOLDS,
  WEEKLY_GOAL_LEVELS,
  WEEKLY_GOAL_TARGET,
  forestProgress,
  weeklyBalance,
  weeklyCareGoal,
  type AppState,
  type ForestProgress,
  type VitalityState,
  type WeeklyBalance,
  type WeeklyCareGoal,
} from '@a2/core';
import type { WorldPreview } from '../../world/worldState';

export interface DevData {
  progress: ForestProgress;
  goal: WeeklyCareGoal;
  balance: WeeklyBalance;
  lastRareEvent: string | null;
  lastProcessedDay: string | null;
  ledger: { active: number; tombstoned: number; uncredited: number };
  creatures: Array<{ id: string; stage: number; unlocked: boolean }>;
  environments: Array<{ id: string; stage: number; unlocked: boolean }>;
}

export const VITALITY_LABELS: Record<VitalityState, string> = {
  quiet: 'calme',
  peaceful: 'paisible',
  lively: 'vivante',
  flourishing: 'florissante',
};

export const CONSTANTS = {
  GROWTH_THRESHOLDS,
  DAILY_CREDIT_CAP,
  VITALITY_PER_CREDIT,
  VITALITY_MAX,
  DAILY_DECAY,
  INACTIVITY_GRACE_DAYS,
  GUARDIAN_STREAK,
  VITALITY_STATE_THRESHOLDS,
  WEEKLY_GOAL_TARGET,
  WEEKLY_GOAL_LEVELS,
} as const;

export function devData(app: AppState, now: Date): DevData {
  const forest = app.forest;
  const credits = Object.values(forest.creditLedger);
  const unlockedCreatures = new Set(forest.unlockedCreatureIds);
  const unlockedEnvironments = new Set(forest.unlockedEnvironmentIds);
  return {
    progress: forestProgress(forest, now),
    goal: weeklyCareGoal(forest, now),
    balance: weeklyBalance(app.chores.tasks, app.chores.completions, now),
    lastRareEvent: forest.lastRareEvent ?? null,
    lastProcessedDay: forest.lastProcessedDay ?? null,
    ledger: {
      active: credits.filter((c) => c.status === 'active').length,
      tombstoned: credits.filter((c) => c.status === 'tombstoned').length,
      uncredited: credits.filter((c) => c.status === 'uncredited').length,
    },
    creatures: CREATURES.map((c) => ({ ...c, unlocked: unlockedCreatures.has(c.id) })),
    environments: ENVIRONMENTS.map((e) => ({ ...e, unlocked: unlockedEnvironments.has(e.id) })),
  };
}

/** Instantané à coller dans une discussion de réglage (sans données personnelles du budget). */
export function devSnapshot(data: DevData, preview: WorldPreview | null, now: Date): string {
  return JSON.stringify(
    {
      app: 'A² Home',
      generatedAt: now.toISOString(),
      forestProgress: data.progress,
      weeklyCareGoal: data.goal,
      weeklyBalance: data.balance,
      lastRareEvent: data.lastRareEvent,
      lastProcessedDay: data.lastProcessedDay,
      creditLedger: data.ledger,
      creatures: data.creatures,
      environments: data.environments,
      constants: CONSTANTS,
      preview,
    },
    null,
    2,
  );
}

/** Copie dans le presse-papiers (repli : zone de texte + execCommand). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Repli ci-dessous (contexte non sécurisé, permission refusée).
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

const nf = new Intl.NumberFormat('fr-FR');

export function num(n: number): string {
  return nf.format(n);
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}
