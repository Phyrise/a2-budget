/**
 * Hook monté UNE fois par la coquille : observe l'AppState (useApp) et joue
 * les petits sons des transitions faites pendant la session.
 *
 * - Rien au premier rendu (chargement, rechargement) ni pour un état
 *   remplacé d'un bloc (import, remise à zéro) : voir `detect.ts`.
 * - Anti-rafale : `gate.ts` (≥ 120 ms entre deux sons, regroupement).
 * - Mouvement réduit : un seul son par geste, pas de répétition rapprochée,
 *   grains de scintillement / feuilles allégés.
 * - Préférence « Petits sons » coupée, page cachée : rien.
 */
import type { AppState } from '@a2/core';
import { useEffect, useRef } from 'react';
import { useApp } from '../../state/store';
import { detectSoundEvents, planSounds } from './detect';
import { soundEngine } from './engine';
import { createSoundGate } from './gate';
import { getSoundPrefs } from './prefs';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useSoundEvents(): void {
  const { appState } = useApp();
  const previous = useRef<AppState | null>(null);
  const gate = useRef(createSoundGate());

  useEffect(() => soundEngine.install(), []);

  useEffect(() => {
    const prev = previous.current;
    previous.current = appState;
    if (prev === null || appState === null || prev === appState) return;
    if (!getSoundPrefs().enabled || document.visibilityState === 'hidden') return;
    const events = detectSoundEvents(prev, appState);
    if (events.length === 0) return;
    const reduced = prefersReducedMotion();
    const plan = gate.current.admit(planSounds(events, { reduced }), performance.now(), { reduced });
    for (const p of plan) {
      soundEngine.play(p.cue, { who: p.who ?? 'none', delayMs: p.delayMs, gentle: reduced });
    }
  }, [appState]);
}
