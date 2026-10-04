/**
 * Chef d'orchestre de la lanterne, monté avec la barre des rituels (Maison) :
 * - vérifie l'horloge (4×/s) et passe en « done » au bout du temps ;
 * - met à jour la lanterne de la forêt ~1×/s (useWorld().focus) ;
 * - floraison à la fin (focus(1) puis extinction), carillon si le son est
 *   activé, mémorise la session (addFocusSession) une seule fois ;
 * - ambiance sonore (coupée en arrière-plan) et Wake Lock pendant la lanterne.
 */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../state/store';
import { useWorld } from '../../../world/WorldContext';
import { ambience } from './ambience';
import { getLantern, lantern, progressOf, useLantern } from './lanternStore';
import { getSoundPrefs } from '../../../app/sound/prefs';
import { soundEngine } from '../../../app/sound/engine';

const BLOOM_MS = 2600;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) void s.release().catch(() => undefined);
        else sentinel = s;
      } catch {
        // Refusé (économie d'énergie…) : sans conséquence.
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
}

export function useLanternController({ onFinished }: { onFinished: () => void }) {
  const s = useLantern();
  const { addFocusSession } = useApp();
  const { focus } = useWorld();
  const visible = usePageVisible();
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const active = s.phase === 'running' || s.phase === 'paused';
  // La forêt montre-t-elle une lanterne ? + minuteur d'extinction, gardé hors
  // des effets pour survivre au passage « done » → « idle » (reset immédiat
  // après un arrêt avant 1 min, « Fermer » ou « Rallumer » pendant la floraison).
  const litRef = useRef(false);
  const offTimerRef = useRef<number | null>(null);

  // Horloge : la fin se décide sur Date.now(), y compris au retour d'arrière-plan.
  useEffect(() => {
    if (s.phase !== 'running') return;
    lantern.tick();
    const timer = window.setInterval(() => lantern.tick(), 250);
    return () => window.clearInterval(timer);
  }, [s.phase, visible]);

  // Lanterne de la forêt : ~1×/s pendant la session.
  useEffect(() => {
    if (!active || s.config === null) return;
    const who = s.config.who;
    const push = () => {
      litRef.current = true;
      focus(progressOf(getLantern()), who);
    };
    push();
    if (s.phase === 'paused') return;
    const timer = window.setInterval(push, 1000);
    return () => window.clearInterval(timer);
  }, [active, s.phase, s.config, focus]);

  // Fin : floraison, carillon, mémoire (une seule fois par session, même si
  // la lanterne s'est achevée pendant que Maison n'était pas affichée).
  useEffect(() => {
    if (s.phase !== 'done' || s.config === null || s.celebrated) return;
    lantern.markCelebrated();
    const config = s.config;
    if (s.completed) {
      litRef.current = true;
      focus(1, config.who);
      // Son de floraison : seulement pour une lanterne menée au bout, jamais
      // si son son est coupé. Petits sons actifs → leur floraison (un seul
      // carillon) ; sinon le carillon de l'ambiance.
      if (s.sound !== 'off') {
        if (getSoundPrefs().enabled) soundEngine.play('lantern', { gentle: prefersReducedMotion(), maxWakeLagMs: 1500 });
        else ambience.chime();
      }
    }
    if (!s.recorded && s.minutesSpent >= 1) {
      addFocusSession({
        minutes: Math.min(120, s.minutesSpent),
        who: config.who,
        label: config.label,
        taskId: config.taskId,
        startedAt: new Date(s.startedAt).toISOString(),
      });
      lantern.markRecorded();
    }
    if (s.completed) onFinishedRef.current();
  }, [s, focus, addFocusSession]);

  // Après la floraison (ou un arrêt), la lanterne de la forêt s'éteint en
  // douceur — quelle que soit la phase suivante. Une nouvelle session annule
  // l'extinction prévue.
  useEffect(() => {
    const clear = () => {
      if (offTimerRef.current !== null) window.clearTimeout(offTimerRef.current);
      offTimerRef.current = null;
    };
    const extinguish = () => {
      offTimerRef.current = null;
      litRef.current = false;
      focus(null);
    };
    if (s.phase === 'running' || s.phase === 'paused') {
      clear();
    } else if (s.phase === 'done') {
      clear();
      offTimerRef.current = window.setTimeout(extinguish, s.completed ? BLOOM_MS : 400);
    } else if (offTimerRef.current === null && litRef.current) {
      extinguish();
    }
  }, [s.phase, s.completed, focus]);

  // Ambiance : seulement pendant que la lanterne brûle et que la page est visible.
  const wantSound = s.sound !== 'off' && s.phase === 'running' && visible;
  useEffect(() => {
    if (wantSound && s.sound !== 'off') ambience.play(s.sound);
    else if (!visible) ambience.sleep();
    else ambience.stop();
  }, [wantSound, s.sound, visible]);

  useWakeLock(s.phase === 'running' && visible);

  // Démontage (autre module) : la forêt éteint sa lanterne, le son se tait ;
  // l'état survit et tout reprend au retour.
  useEffect(
    () => () => {
      if (offTimerRef.current !== null) window.clearTimeout(offTimerRef.current);
      offTimerRef.current = null;
      litRef.current = false;
      focus(null);
      ambience.stop(0.4);
    },
    [focus],
  );
}
