/**
 * État de la lanterne en cours, hors de React (module) : il survit au
 * démontage de Maison (changement de module) le temps de la session.
 * Le temps est toujours calculé depuis l'horloge (Date.now), jamais en
 * comptant des ticks : une mise en arrière-plan ne fausse rien.
 */
import { useSyncExternalStore } from 'react';

export type LanternWho = 'a' | 'b' | 'both';
export type LanternSound = 'off' | 'rain' | 'stream';
export type LanternPhase = 'idle' | 'running' | 'paused' | 'done';

export interface LanternConfig {
  minutes: number;
  who: LanternWho;
  taskId?: string;
  label?: string;
}

export interface LanternState {
  phase: LanternPhase;
  config: LanternConfig | null;
  /** Identifiant de la session (mémorisée une seule fois). */
  sessionId: string | null;
  /** Début (ms, horloge murale). */
  startedAt: number;
  /** Temps cumulé en pause (ms). */
  pausedMs: number;
  /** Début de la pause en cours (ms) ou null. */
  pausedAt: number | null;
  /** Fin (ms) : arrivée au bout ou arrêt. */
  endedAt: number | null;
  /** true : la lanterne est allée au bout ; false : arrêtée plus tôt. */
  completed: boolean;
  /** Minutes réellement passées (fin), pour le carnet. */
  minutesSpent: number;
  /** La session a été confiée au store (addFocusSession). */
  recorded: boolean;
  /** La fin a été célébrée (floraison, carillon) : une seule fois. */
  celebrated: boolean;
  sound: LanternSound;
  /** Modèle de lanterne débloqué par cette session (annonce), ou null. */
  unlocked: string | null;
}

const INITIAL: LanternState = {
  phase: 'idle',
  config: null,
  sessionId: null,
  startedAt: 0,
  pausedMs: 0,
  pausedAt: null,
  endedAt: null,
  completed: false,
  minutesSpent: 0,
  recorded: false,
  celebrated: false,
  sound: 'off',
  unlocked: null,
};

/** Dernière durée choisie (menu ⋯ d'une tâche, préparation) : le temps de la visite. */
let lastMinutes = 10;

let state: LanternState = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<LanternState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLantern(): LanternState {
  return state;
}

export function useLantern(): LanternState {
  return useSyncExternalStore(subscribe, getLantern, getLantern);
}

export function durationMs(s: LanternState): number {
  return (s.config?.minutes ?? 0) * 60_000;
}

/** Temps écoulé (ms), pauses exclues. */
export function elapsedMs(s: LanternState, now = Date.now()): number {
  if (s.phase === 'idle') return 0;
  const until = s.endedAt ?? s.pausedAt ?? now;
  return Math.max(0, Math.min(durationMs(s), until - s.startedAt - s.pausedMs));
}

export function remainingMs(s: LanternState, now = Date.now()): number {
  return Math.max(0, durationMs(s) - elapsedMs(s, now));
}

export function progressOf(s: LanternState, now = Date.now()): number {
  const d = durationMs(s);
  return d === 0 ? 0 : Math.min(1, elapsedMs(s, now) / d);
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `lantern-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const LANTERN_MINUTES = [5, 10, 15, 25] as const;

export function lastLanternMinutes(): number {
  return lastMinutes;
}

export const lantern = {
  start(config: LanternConfig) {
    lastMinutes = config.minutes;
    set({
      ...INITIAL,
      sound: state.sound,
      phase: 'running',
      config,
      sessionId: makeId(),
      startedAt: Date.now(),
    });
  },
  pause() {
    if (state.phase !== 'running') return;
    set({ phase: 'paused', pausedAt: Date.now() });
  },
  resume() {
    if (state.phase !== 'paused' || state.pausedAt === null) return;
    set({ phase: 'running', pausedMs: state.pausedMs + (Date.now() - state.pausedAt), pausedAt: null });
  },
  /** Vérifie l'horloge : passe en « done » si le temps est écoulé. */
  tick(now = Date.now()) {
    if (state.phase !== 'running') return;
    if (now - state.startedAt - state.pausedMs >= durationMs(state)) {
      set({
        phase: 'done',
        completed: true,
        endedAt: state.startedAt + state.pausedMs + durationMs(state),
        minutesSpent: state.config?.minutes ?? 0,
      });
    }
  },
  /** Arrêter plus tôt : la lanterne s'éteint doucement, sans reproche. */
  stop() {
    if (state.phase !== 'running' && state.phase !== 'paused') return;
    const now = Date.now();
    const spent = Math.floor(elapsedMs(state, now) / 60_000);
    set({ phase: 'done', completed: false, endedAt: state.pausedAt ?? now, minutesSpent: spent });
  },
  markRecorded() {
    set({ recorded: true });
  },
  markCelebrated() {
    set({ celebrated: true });
  },
  markUnlocked(id: string) {
    set({ unlocked: id });
  },
  reset() {
    set({ ...INITIAL, sound: state.sound });
  },
  setSound(sound: LanternSound) {
    set({ sound });
  },
};
