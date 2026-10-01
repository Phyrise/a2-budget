import type { ViewId } from './BottomNav';

/**
 * Navigation interne entre vues.
 *
 * Les vues n'ont pas de props (App.tsx, propriété du lead, détient l'état de
 * vue) : une vue qui doit ouvrir une autre vue (ex. Historique → Ce mois)
 * émet cet événement, et BottomNav — qui reçoit `onChange` d'App — l'applique.
 */
export const NAVIGATE_EVENT = 'a2-budget:navigate';

export function requestViewChange(view: ViewId): void {
  window.dispatchEvent(new CustomEvent<ViewId>(NAVIGATE_EVENT, { detail: view }));
}
