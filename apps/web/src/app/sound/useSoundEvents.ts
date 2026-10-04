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
 */
import type { AppState } from '@a2/core';
import { useEffect, useRef } from 'react';
import { useApp } from '../../state/store';
import { detectSoundEvents, planSounds, removedKeys } from './detect';
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
    if (events.length === 0) return;
    const reduced = prefersReducedMotion();
    playPlan(planSounds(events, { reduced }), reduced);
  }, [appState]);
}
