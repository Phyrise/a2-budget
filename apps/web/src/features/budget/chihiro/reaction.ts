/**
 * Réaction en cours du Sans-Visage (V4.2), partagée par le Sans-Visage du
 * solde et son double en visite sans passer par l'écran :
 * - 'gain' : le compte monte, il reçoit l'argent, mâche, s'arrondit, content ;
 * - 'loss' : le compte descend, les pièces le quittent, il se tasse, triste.
 * Déclenchée par un paiement coché / décoché (useFeeding) ou un montant
 * modifié (useMonthEdits). Petit magasin observable, hors AppState.
 */
import { useSyncExternalStore } from 'react';
import type { AccountReaction } from './mood';

export const REACT_MS = 1500;

let current: AccountReaction | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Le Sans-Visage réagit pendant `ms` (une nouvelle réaction remplace la précédente). */
export function react(kind: AccountReaction, ms = REACT_MS): void {
  current = kind;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    current = null;
    notify();
  }, ms);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReaction(): AccountReaction | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
