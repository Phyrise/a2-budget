/**
 * Mode développeur : présence simulée, en local, pour voir l'avatar de
 * l'autre seul (invité compris). Le visiteur suit l'onglet affiché ; rien
 * n'est écrit, ni dans les données ni sur le serveur.
 */
import { useSyncExternalStore } from 'react';
import type { AvatarWho } from './avatarModel';

export interface DevVisit {
  who: AvatarWho;
  /** Coucous reçus simulés. */
  pokes: number;
}

let visit: DevVisit | null = null;
const listeners = new Set<() => void>();

function set(next: DevVisit | null): void {
  visit = next;
  for (const l of listeners) l();
}

export function devVisitCome(who: AvatarWho): void {
  set({ who, pokes: visit?.pokes ?? 0 });
}

export function devVisitLeave(): void {
  set(null);
}

/** L'autre (simulé) t'envoie un coucou. */
export function devVisitPoke(): void {
  if (visit !== null) set({ ...visit, pokes: visit.pokes + 1 });
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDevVisit(): DevVisit | null {
  return useSyncExternalStore(
    subscribe,
    () => visit,
    () => null,
  );
}
