/**
 * Mettre la maison en pause / réveiller la forêt, avec une confirmation
 * douce : un message annulable plutôt qu'une boîte de dialogue. Partagé par
 * le bouton lune de l'en-tête et le réglage « Maison en pause ».
 */
import { useCallback } from 'react';
import { useApp } from '../state/store';
import { NBSP, NNBSP, useToast } from '../ui';

export function usePauseToggle(): { paused: boolean; toggle: () => void } {
  const { appState, toggleHomePause } = useApp();
  const toast = useToast();
  const paused = appState?.forest.paused ?? false;

  const toggle = useCallback(() => {
    if (appState === null) return;
    const wasPaused = appState.forest.paused;
    toggleHomePause();
    toast.show({
      message: wasPaused
        ? `La forêt se réveille. Bon retour${NNBSP}!`
        : `Maison en pause${NBSP}: la forêt s’endort, rien ne se perd.`,
      icon: wasPaused ? 'sun' : 'moon',
      action: { label: 'Annuler', onClick: toggleHomePause },
    });
  }, [appState, toggleHomePause, toast]);

  return { paused, toggle };
}
