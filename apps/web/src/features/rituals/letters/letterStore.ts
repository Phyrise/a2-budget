/**
 * Lettres du cercle (V5.2) : état d'affichage, hors de React (module).
 *
 * - `unread` : la lettre non lue de l'autre (calculée par LetterWatcher) ;
 *   l'enveloppe sur le rituel et la pastille de l'onglet la lisent.
 * - `reading` : la lettre ouverte (gardée telle quelle pendant la lecture,
 *   même une fois marquée lue).
 * - `writeRequest` : « Écrire ma part » demandé depuis la lettre ; la barre
 *   des rituels ouvre alors le cercle.
 */
import type { Circle } from '@a2/core';
import { useSyncExternalStore } from 'react';

export interface LetterView {
  unread: Circle | null;
  reading: Circle | null;
  writeRequest: number;
  /** Marque « lu » ramenée en arrière (mode développeur) : la relire. */
  seenResets: number;
}

let state: LetterView = { unread: null, reading: null, writeRequest: 0, seenResets: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<LetterView>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const letters = {
  get: (): LetterView => state,
  setUnread(unread: Circle | null): void {
    if (unread?.id === state.unread?.id && unread?.heldAt === state.unread?.heldAt) return;
    set({ unread });
  },
  /** Ouvre la lettre non lue (rien s'il n'y en a pas). */
  open(): void {
    if (state.unread !== null) set({ reading: state.unread });
  },
  close(): void {
    if (state.reading !== null) set({ reading: null });
  },
  requestWrite(): void {
    set({ reading: null, writeRequest: state.writeRequest + 1 });
  },
  /** Mode développeur : la marque locale a été ramenée en arrière. */
  seenReset(): void {
    set({ unread: null, reading: null, seenResets: state.seenResets + 1 });
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useLetters(): LetterView {
  return useSyncExternalStore(letters.subscribe, letters.get, letters.get);
}

/** Marque locale (cet appareil), en attendant ou à défaut de la fiche partagée. */
const SEEN_KEY = 'a2-budget:circle-seen:v1';

export function readLocalSeen(role: 'a' | 'b'): string | null {
  try {
    const raw = window.localStorage.getItem(`${SEEN_KEY}:${role}`);
    return typeof raw === 'string' && raw !== '' ? raw : null;
  } catch {
    return null;
  }
}

export function writeLocalSeen(role: 'a' | 'b', mark: string): void {
  try {
    window.localStorage.setItem(`${SEEN_KEY}:${role}`, mark);
  } catch {
    // stockage indisponible : la fiche partagée suffit
  }
}

/** Toutes les marques locales oubliées (remise à zéro, mode développeur). */
export function forgetLocalSeen(): void {
  for (const role of ['a', 'b'] as const) {
    try {
      window.localStorage.removeItem(`${SEEN_KEY}:${role}`);
    } catch {
      // stockage indisponible
    }
  }
}

/** La plus récente des deux marques. */
export function laterMark(x: string | null, y: string | null): string | null {
  if (x === null) return y;
  if (y === null) return x;
  return x > y ? x : y;
}
