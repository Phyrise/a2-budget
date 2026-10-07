/**
 * État de la lanterne en cours, hors de React (module) : il survit au
 * démontage de Maison (changement de module) le temps de la session.
 * Le temps est toujours calculé depuis l'horloge (Date.now), jamais en
 * comptant des ticks : une mise en arrière-plan ne fausse rien.
 * V4.2 : la session en cours (ou finie mais pas encore mémorisée) est aussi
 * gardée sous une clé dédiée `a2-budget:lantern:v1` (comme les petits sons) :
 * un rechargement, une app tuée en arrière-plan ou une mise à jour ne font
 * plus perdre une lanterne menée au bout. Lecture et écriture protégées ;
 * rien d'illisible n'est restauré.
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

const KEY = 'a2-budget:lantern:v1';

/** Ce qui est gardé d'une session : de quoi la reprendre, ou la mémoriser. */
type SavedLantern = Pick<
  LanternState,
  'phase' | 'config' | 'sessionId' | 'startedAt' | 'pausedMs' | 'pausedAt' | 'endedAt' | 'completed' | 'minutesSpent'
>;

/**
 * À garder : une lanterne qui brûle (ou en pause), ou finie et pas encore
 * mémorisée (au moins une minute). Sinon null (la clé est effacée).
 */
export function savedLantern(s: LanternState): SavedLantern | null {
  const live = s.phase === 'running' || s.phase === 'paused';
  const pending = s.phase === 'done' && !s.recorded && s.minutesSpent >= 1;
  if ((!live && !pending) || s.config === null || s.sessionId === null) return null;
  const { phase, config, sessionId, startedAt, pausedMs, pausedAt, endedAt, completed, minutesSpent } = s;
  return { phase, config, sessionId, startedAt, pausedMs, pausedAt, endedAt, completed, minutesSpent };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Relit une session gardée ; null si absente ou illisible. Pur. */
export function restoreLantern(raw: unknown): LanternState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const c = v.config as Record<string, unknown> | null | undefined;
  if (v.phase !== 'running' && v.phase !== 'paused' && v.phase !== 'done') return null;
  if (typeof v.sessionId !== 'string' || v.sessionId === '' || typeof c !== 'object' || c === null) return null;
  if (!isInt(c.minutes, 1, 120) || (c.who !== 'a' && c.who !== 'b' && c.who !== 'both')) return null;
  if (c.taskId !== undefined && typeof c.taskId !== 'string') return null;
  if (c.label !== undefined && typeof c.label !== 'string') return null;
  if (!isNum(v.startedAt) || v.startedAt <= 0 || !isNum(v.pausedMs) || v.pausedMs < 0) return null;
  if (v.pausedAt !== null && !isNum(v.pausedAt)) return null;
  if (v.phase === 'paused' && v.pausedAt === null) return null;
  if (v.phase === 'done' && (!isNum(v.endedAt) || typeof v.completed !== 'boolean' || !isInt(v.minutesSpent, 1, 120))) return null;
  const config: LanternConfig = { minutes: c.minutes, who: c.who };
  if (typeof c.taskId === 'string') config.taskId = c.taskId;
  if (typeof c.label === 'string') config.label = c.label;
  const done = v.phase === 'done';
  return {
    ...INITIAL,
    phase: v.phase,
    config,
    sessionId: v.sessionId,
    startedAt: v.startedAt,
    pausedMs: v.pausedMs,
    pausedAt: v.phase === 'paused' ? (v.pausedAt as number) : null,
    endedAt: done ? (v.endedAt as number) : null,
    completed: done ? (v.completed as boolean) : false,
    minutesSpent: done ? (v.minutesSpent as number) : 0,
  };
}

function load(): LanternState {
  try {
    if (typeof window === 'undefined') return INITIAL;
    const raw = window.localStorage.getItem(KEY);
    return (raw === null ? null : restoreLantern(JSON.parse(raw))) ?? INITIAL;
  } catch {
    return INITIAL;
  }
}

/** Dernier texte écrit (undefined : rien encore, la première écriture passe toujours). */
let written: string | null | undefined;

function save(s: LanternState) {
  const saved = savedLantern(s);
  const text = saved === null ? null : JSON.stringify(saved);
  if (text === written) return;
  written = text;
  try {
    if (text === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, text);
  } catch {
    // Stockage indisponible (navigation privée…) : la lanterne vit en mémoire.
  }
}

let state: LanternState = load();
if (state.config) lastMinutes = state.config.minutes;
const listeners = new Set<() => void>();

function set(patch: Partial<LanternState>) {
  state = { ...state, ...patch };
  if (typeof window !== 'undefined') save(state);
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
