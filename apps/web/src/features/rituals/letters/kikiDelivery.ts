/**
 * Kiki, service de livraison (V5.10) : quand une lettre de l'autre ARRIVE
 * pendant que l'app est ouverte, Kiki traverse le haut de l'écran sur son
 * balai avec l'enveloppe cachetée (le toast « ✉ » et la pastille restent).
 *
 * - Une lettre déjà connue au chargement ne la fait pas voler (comme le toast).
 * - Calme (mouvement réduit, Forêt « Immobile ») : pas de traversée.
 * - Lettre arrivée app en arrière-plan : pas de traversée, ni au retour
 *   (toast et pastille suffisent ; une traversée « en retard » surprendrait).
 * - Une seule traversée à la fois : une lettre pendant le vol est ignorée.
 *
 * État hors de React (module), lu par <KikiPost> (calque monté une fois).
 */
import { useSyncExternalStore } from 'react';
import { readPrefs } from '../../../app/prefs';

/** Durée de la traversée (gardée en phase avec kiki-post.css). */
export const KIKI_POST_MS = 3000;

export interface KikiFlightView {
  /** Compte des envols : remonte l'animation à chaque traversée. */
  id: number;
  /** Expéditeur : le cachet de l'enveloppe suit son compagnon. */
  from: 'a' | 'b';
}

export interface PostGate {
  calm: boolean;
  hidden: boolean;
  /** Une lettre est déjà ouverte : ni toast ni Kiki. */
  reading: boolean;
}

/**
 * Une lettre arrive (ou est complétée) : la clé change après un premier
 * calcul (`undefined` = rien encore vu, donc chargement).
 */
export function letterArrived(before: string | null | undefined, key: string | null): boolean {
  return before !== undefined && key !== null && key !== before;
}

/** Kiki peut-elle partir ? (calme, arrière-plan, lecture, ou déjà en vol : non). */
export function kikiMayFly(gate: PostGate, flying: boolean): boolean {
  return !gate.calm && !gate.hidden && !gate.reading && !flying;
}

/** Mouvement réduit ou Forêt « Immobile », lu à l'instant. */
export function calmNow(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || readPrefs().forestMotion === 'still';
  } catch {
    return false;
  }
}

let flight: KikiFlightView | null = null;
let count = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export const kikiPost = {
  get: (): KikiFlightView | null => flight,
  /** Une lettre à livrer : vrai si Kiki décolle. */
  deliver(from: 'a' | 'b', gate: PostGate): boolean {
    if (!kikiMayFly(gate, flight !== null)) return false;
    count += 1;
    flight = { id: count, from };
    emit();
    return true;
  },
  /** Fin de la traversée (ou app passée en arrière-plan). */
  land(id: number): void {
    if (flight === null || flight.id !== id) return;
    flight = null;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Garde ouverte de l'app, au moment présent. */
export function postGateNow(reading = false): PostGate {
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  return { calm: calmNow(), hidden, reading };
}

export function useKikiPost(): KikiFlightView | null {
  return useSyncExternalStore(kikiPost.subscribe, kikiPost.get, kikiPost.get);
}
