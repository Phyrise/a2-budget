/**
 * Hook monté UNE fois par la coquille : observe l'AppState (useApp) et joue
 * les petits sons des transitions faites pendant la session.
 *
 * - Rien au premier rendu (chargement, rechargement) ni pour un état
 *   remplacé d'un bloc (import, remise à zéro) : voir `detect.ts`.
 * - Les éléments retirés pendant la session sont mémorisés : s'ils
 *   reviennent (« Annuler »), ce n'est pas un ajout, rien ne sonne.
 * - Anti-rafale : porte commune (`play.ts`, `gate.ts` : ≥ 120 ms entre deux
 *   sons, regroupement), partagée avec les sons joués par les écrans.
 * - Mouvement réduit : un seul son par geste, pas de répétition rapprochée,
 *   grains de scintillement / feuilles allégés.
 * - Préférence « Petits sons » coupée, page cachée : rien.
 * - V4 (`detectV4.ts`) : paiement coché (« nom » du Sans-Visage), solde
 *   recalé (cloche), nouvelle lanterne débloquée (carillon, après la
 *   floraison) ; la lanterne de pierre allumée (allumette + souffle) suit
 *   l'état du minuteur (lanternStore), pas l'AppState.
 */
import type { AppState } from '@a2/core';
import { useEffect, useRef } from 'react';
import { useLantern } from '../../features/rituals/lantern/lanternStore';
import { useApp } from '../../state/store';
import type { PlannedSound } from './cues';
import { detectSoundEvents, planSounds, removedKeys } from './detect';
import { LANTERN_NEW_DELAY_MS, detectV4SoundEvents, lanternLitNow, type LanternTimerView } from './detectV4';
import { soundEngine } from './engine';
import { playPlan, prefersReducedMotion } from './play';

/** Nombre d'éléments retirés gardés en mémoire (les plus récents). */
const REMOVED_MEMORY = 64;

export function useSoundEvents(): void {
  const { appState } = useApp();
  const previous = useRef<AppState | null>(null);
  const removed = useRef(new Set<string>());

  useEffect(() => soundEngine.install(), []);

  useEffect(() => {
    const prev = previous.current;
    previous.current = appState;
    if (prev === null || appState === null || prev === appState) return;
    const events = detectSoundEvents(prev, appState, removed.current);
    const memory = removed.current;
    for (const key of removedKeys(prev, appState)) {
      memory.delete(key);
      memory.add(key);
    }
    while (memory.size > REMOVED_MEMORY) memory.delete(memory.values().next().value!);
    const v4 = detectV4SoundEvents(prev, appState);
    const later = v4.filter((e) => e.cue === 'lanternNew');
    events.push(...v4.filter((e) => e.cue !== 'lanternNew'));
    if (events.length === 0 && later.length === 0) return;
    const reduced = prefersReducedMotion();
    const plan: PlannedSound[] = planSounds(events, { reduced });
    // Mouvement réduit : un seul son par geste — la nouvelle lanterne l'emporte.
    if (later.length > 0) {
      const chime: PlannedSound = { cue: 'lanternNew', delayMs: reduced ? 0 : LANTERN_NEW_DELAY_MS };
      playPlan(reduced ? [chime] : [...plan, chime], reduced);
    } else {
      playPlan(plan, reduced);
    }
  }, [appState]);

  // La lanterne de pierre s'allume : nouvelle session du minuteur (jamais au montage).
  const timer = useLantern();
  const timerSeen = useRef<LanternTimerView | null>(null);
  useEffect(() => {
    const prev = timerSeen.current;
    const next: LanternTimerView = { phase: timer.phase, sessionId: timer.sessionId };
    timerSeen.current = next;
    if (lanternLitNow(prev, next)) playPlan([{ cue: 'lanternLit', delayMs: 0 }], prefersReducedMotion());
  }, [timer.phase, timer.sessionId]);
}
