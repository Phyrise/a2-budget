/**
 * Univers Kiki de l'écran Courses : règles pures (panier, poses de Jiji),
 * salut du jour, mouvement réduit et petits sons.
 *
 * - Le salut de Kiki n'est montré qu'à la première ouverture du jour :
 *   mémorisé sous une clé dédiée `a2-budget:courses:v1` (comme les petits
 *   sons, `a2-budget:ui:v1` appartenant à la coquille), lecture et écriture
 *   protégées. Jamais `localStorage.clear()`.
 * - Les sons réutilisent le vocabulaire existant (`soundEngine`) : un souffle
 *   pour le coup de balai, un carillon discret quand l'article tombe dans le
 *   panier, une note douce quand on le ressort, deux notes pour l'envol.
 */
import { localDateKey, type GroceryItem } from '@a2/core';
import { soundEngine } from '../../app/sound';
import type { BasketFill, JijiPose } from '../../themes/types';

/** À partir de ce nombre d'articles cochés, le panier est plein. */
export const BASKET_FULL_AT = 5;
/** Durée de la pose « dans le sac » de Jiji après un ajout. */
export const JIJI_BAG_MS = 1800;
/** Durée de l'envol de Kiki quand on vide le panier. */
export const FLIGHT_MS = 1400;

/** Remplissage du panier selon le nombre d'articles cochés. */
export function basketFill(done: number, total: number): BasketFill {
  if (done <= 0) return 'empty';
  if (done >= BASKET_FULL_AT || done >= total) return 'full';
  return 'half';
}

/**
 * Pose de Jiji : endormi quand la liste est vide, sur le panier quand tout
 * est coché, dans le sac juste après un ajout, dans le panier quand celui-ci
 * est vide, et sa tasse de thé au repos.
 */
export function jijiPose(total: number, done: number, justAdded: boolean): JijiPose {
  if (total === 0) return 'sleeping';
  if (done === total) return 'onBasket';
  if (justAdded) return 'inBag';
  if (done === 0) return 'inBasket';
  return 'teacup';
}

/** Nombre d'articles cochés. */
export function doneCount(items: readonly GroceryItem[]): number {
  return items.reduce((n, item) => n + (item.done ? 1 : 0), 0);
}

const KEY = 'a2-budget:courses:v1';

interface CoursesPrefs {
  /** Jour (AAAA-MM-JJ) du dernier salut de Kiki. */
  greetedOn?: string;
}

function readCoursesPrefs(): CoursesPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return {};
    const value = JSON.parse(raw) as { greetedOn?: unknown };
    return typeof value.greetedOn === 'string' ? { greetedOn: value.greetedOn } : {};
  } catch {
    return {};
  }
}

/** Vrai si Kiki n'a pas encore salué aujourd'hui. */
export function shouldGreet(today: Date): boolean {
  return readCoursesPrefs().greetedOn !== localDateKey(today);
}

/** Mémorise le salut du jour (sans effet si le stockage est indisponible). */
export function markGreeted(today: Date): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readCoursesPrefs(), greetedOn: localDateKey(today) }));
  } catch {
    // Stockage indisponible : Kiki resaluera, sans conséquence.
  }
}

/** `prefers-reduced-motion: reduce`, lu à l'instant (aucun abonnement nécessaire). */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Petits sons des courses (sans effet si les sons sont coupés). */
export const coursesSounds = {
  /** Coup de balai, puis l'article tombe dans le panier. */
  sweep(reduced: boolean): void {
    if (!reduced) soundEngine.play('skip');
    soundEngine.play('done', { delayMs: reduced ? 0 : 480 });
  },
  /** L'article ressort du panier. */
  unsweep(): void {
    soundEngine.play('undo');
  },
  /** Kiki s'envole avec le sac de provisions. */
  flight(reduced: boolean): void {
    if (!reduced) soundEngine.play('skip');
    soundEngine.play('circle', { delayMs: reduced ? 0 : 520 });
  },
};
