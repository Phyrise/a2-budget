/**
 * Allumer une lanterne (menu ⋯ d'une tâche, carte Lanterne) : le minuteur
 * démarre, puis — sur téléphone — la page remonte doucement vers la forêt
 * pour qu'on voie la lanterne de pierre s'allumer.
 */
import type { TaskAssignee } from '@a2/core';
import { ambience } from './ambience';
import { lantern, type LanternConfig, type LanternWho } from './lanternStore';

/** Délai laissé à une feuille qui se ferme avant de remonter vers la forêt. */
const AFTER_SHEET_MS = 280;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Remonter vers la forêt (téléphone ; sur ordinateur, elle est toujours visible). */
export function revealForest(isDesktop: boolean): void {
  if (isDesktop || window.scrollY < 4) return;
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Qui allume la lanterne d'une tâche : la personne dont c'est le tour, sinon à deux. */
export function lanternWhoFor(turn: TaskAssignee): LanternWho {
  return turn === 'a' || turn === 'b' ? turn : 'both';
}

export function startLantern(config: LanternConfig, isDesktop: boolean): void {
  ambience.unlock();
  lantern.start(config);
  window.setTimeout(() => revealForest(isDesktop), AFTER_SHEET_MS);
}
