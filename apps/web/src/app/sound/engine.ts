/**
 * Moteur des petits sons (WebAudio, aucun fichier audio).
 *
 * - AudioContext **paresseux** : créé au premier geste (pointerdown,
 *   touchend, keydown…) si les sons sont activés — c'est ce qui le débloque
 *   sur iOS (un tampon silencieux est joué dans le geste).
 * - Bus maître : entrée sèche + réverbération courte (convolution générée
 *   une fois) → compresseur doux → adoucissement des aigus → volume bas.
 * - Coupé quand la page est cachée (contexte mis en veille) ; un son demandé
 *   pendant que le contexte dort n'est jamais rejoué en retard.
 * - Au repos, le contexte se met en veille (~4 s après la fin du dernier son
 *   prévu, ou d'un réveil par un geste resté sans son), et tout de suite
 *   quand les petits sons sont coupés : rien ne tourne pour rien sur le
 *   téléphone. Le geste suivant le réveille avant que le son ne soit joué.
 * - Ne lève jamais d'erreur : sans WebAudio, tout devient sans effet.
 *
 * Contexte distinct de l'ambiance de la lanterne (features/rituals/lantern),
 * qui garde le sien : les deux cohabitent sans se gêner.
 */
import type { SoundCue, SoundVoice } from './cues';
import { getSoundPrefs, subscribeSoundPrefs } from './prefs';
import { createImpulse, createNoise, type Bus } from './synth';
import { renderCue } from './voices';

/** Volume maître (bas : un détail, pas une sonnerie). */
export const MASTER_VOLUME = 0.42;

/** Construit le bus maître sur n'importe quel contexte (temps réel ou hors ligne). */
export function buildBus(ctx: BaseAudioContext, destination: AudioNode): Bus {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = createImpulse(ctx);
  const wetReturn = ctx.createGain();
  wetReturn.gain.value = 0.3;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 18;
  comp.ratio.value = 3;
  comp.attack.value = 0.006;
  comp.release.value = 0.25;
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 7800;
  soften.Q.value = 0.5;
  const master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  dry.connect(comp);
  wet.connect(reverb).connect(wetReturn).connect(comp);
  comp.connect(soften).connect(master).connect(destination);
  return { ctx, dry, wet, noise: createNoise(ctx) };
}

export interface PlayOptions {
  who?: SoundVoice;
  delayMs?: number;
  gentle?: boolean;
  /** Joue même si la préférence est coupée (bouton « Écouter »). */
  force?: boolean;
  /**
   * Retard toléré au réveil du contexte (défaut 250 ms) : au-delà, le son
   * ne sonne pas. Plus long pour un son attendu hors geste (fin de lanterne).
   */
  maxWakeLagMs?: number;
}

export interface CueRecord {
  cue: SoundCue;
  who: SoundVoice;
  delayMs: number;
}

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
let failed = false;
let primed = false;
let sleepTimer: number | null = null;
let idleTimer: number | null = null;
let suspending = false;
let busyUntil = 0;
/** Durée laissée à un son (réverbération comprise) avant la veille. */
const CUE_TAIL_MS = 2500;
/** Repos avant la mise en veille du contexte. */
const IDLE_MS = 1500;
const listeners = new Set<(record: CueRecord) => void>();

function contextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function ensure(): AudioContext | null {
  if (ctx !== null) return ctx;
  if (failed) return null;
  const Ctor = contextCtor();
  if (Ctor === null) {
    failed = true;
    return null;
  }
  try {
    const c = new Ctor({ latencyHint: 'interactive' });
    bus = buildBus(c, c.destination);
    ctx = c;
  } catch {
    failed = true;
    ctx = null;
    bus = null;
  }
  return ctx;
}

function cancelSleep(): void {
  if (sleepTimer !== null) window.clearTimeout(sleepTimer);
  sleepTimer = null;
}

function cancelIdle(): void {
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = null;
}

/** Met le contexte en veille (sans effet s'il dort déjà). */
function suspendNow(c: AudioContext): void {
  cancelIdle();
  if (c.state !== 'running' || suspending) return;
  suspending = true;
  c.suspend().then(
    () => {
      suspending = false;
    },
    () => {
      suspending = false;
    },
  );
}

/** Prévoit la veille après le dernier son prévu (réarmé à chaque son). */
function armIdle(soundMs: number): void {
  if (typeof window === 'undefined') return;
  const now = performance.now();
  busyUntil = Math.max(busyUntil, now + soundMs);
  cancelIdle();
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    if (ctx !== null) suspendNow(ctx);
  }, busyUntil - now + IDLE_MS);
}

/** iOS : un tampon silencieux joué dans le geste débloque la sortie audio. */
function prime(c: AudioContext): void {
  if (primed) return;
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start(0);
    primed = true;
  } catch {
    /* sans conséquence */
  }
}

function wake(c: AudioContext): Promise<void> {
  cancelSleep();
  cancelIdle();
  if (c.state === 'running' && !suspending) return Promise.resolve();
  if (c.state === 'closed') return Promise.reject(new Error('closed'));
  return c.resume();
}

function schedule(cue: SoundCue, o: PlayOptions): void {
  if (ctx === null || bus === null) return;
  try {
    const delayMs = Math.max(0, o.delayMs ?? 0);
    armIdle(delayMs + CUE_TAIL_MS);
    const t = ctx.currentTime + 0.015 + delayMs / 1000;
    renderCue(bus, cue, t, { who: o.who ?? 'none', gentle: o.gentle === true });
  } catch {
    /* jamais d'erreur visible pour un son */
  }
}

export const soundEngine = {
  supported(): boolean {
    return contextCtor() !== null;
  },

  /** État du contexte (« absent » tant qu'aucun geste ne l'a créé). */
  state(): AudioContextState | 'absent' {
    return ctx?.state ?? 'absent';
  },

  /** À appeler dans un geste : crée / réveille le contexte. */
  unlock(force = false): void {
    if (!force && !getSoundPrefs().enabled) return;
    if (hidden()) return;
    const c = ensure();
    if (c === null) return;
    prime(c);
    // Réveillé par un geste : se rendort s'il ne sert pas.
    wake(c).then(() => armIdle(0), () => undefined);
  },

  /** Joue un son ; retourne false s'il est ignoré (coupé, caché, indisponible). */
  play(cue: SoundCue, o: PlayOptions = {}): boolean {
    if (o.force !== true && !getSoundPrefs().enabled) return false;
    if (hidden()) return false;
    const c = ensure();
    if (c === null) return false;
    const record: CueRecord = { cue, who: o.who ?? 'none', delayMs: o.delayMs ?? 0 };
    listeners.forEach((l) => l(record));
    if (c.state === 'running' && !suspending) {
      cancelSleep();
      schedule(cue, o);
      return true;
    }
    // Contexte endormi : on le réveille, mais un son en retard ne sonne pas.
    const asked = performance.now();
    wake(c).then(
      () => {
        if (performance.now() - asked < (o.maxWakeLagMs ?? 250) && !hidden()) schedule(cue, o);
        else armIdle(0);
      },
      () => undefined,
    );
    return true;
  },

  /**
   * Installe le déblocage au premier geste et la veille quand la page est
   * cachée. Retourne la désinstallation.
   */
  install(): () => void {
    if (typeof window === 'undefined') return () => undefined;
    const onGesture = () => {
      if (ctx === null || ctx.state !== 'running') soundEngine.unlock();
    };
    const onVisibility = () => {
      const c = ctx;
      if (c === null) return;
      if (hidden()) {
        cancelSleep();
        sleepTimer = window.setTimeout(() => {
          sleepTimer = null;
          if (hidden()) suspendNow(c);
        }, 300);
      } else {
        cancelSleep();
      }
    };
    const events = ['pointerdown', 'touchend', 'keydown', 'click'] as const;
    events.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    // Petits sons coupés : veille immédiate (le bouton « Écouter » réveille).
    const offPrefs = subscribeSoundPrefs(() => {
      if (!getSoundPrefs().enabled && ctx !== null) suspendNow(ctx);
    });
    return () => {
      events.forEach((e) => window.removeEventListener(e, onGesture, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      offPrefs();
      cancelIdle();
    };
  },

  /** Observe les sons demandés (QA, débogage). */
  subscribe(listener: (record: CueRecord) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
