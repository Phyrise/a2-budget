/**
 * Préférence « Petits sons » — clé dédiée `a2-budget:sound:v1` (les
 * préférences d'interface `a2-budget:ui:v1` appartiennent à la coquille).
 * Défaut : activé, volume bas. Lecture / écriture toujours protégées : sans
 * stockage, la préférence vaut pour la session. Jamais `localStorage.clear()`.
 *
 * Petit magasin observable (useSyncExternalStore) : l'interrupteur des
 * Réglages et le moteur voient la même valeur, sans relecture du stockage.
 */
import { useSyncExternalStore } from 'react';

export interface SoundPrefs {
  enabled: boolean;
}

const KEY = 'a2-budget:sound:v1';
const DEFAULT: SoundPrefs = { enabled: true };

function read(): SoundPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return { ...DEFAULT };
    const value = JSON.parse(raw) as { enabled?: unknown } | null;
    return { enabled: value?.enabled !== false };
  } catch {
    return { ...DEFAULT };
  }
}

let current: SoundPrefs | null = null;
const listeners = new Set<() => void>();

export function getSoundPrefs(): SoundPrefs {
  if (current === null) current = read();
  return current;
}

export function setSoundEnabled(enabled: boolean): void {
  if (getSoundPrefs().enabled === enabled) return;
  current = { enabled };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Stockage indisponible : la préférence vaut pour cette session.
  }
  listeners.forEach((l) => l());
}

/** Observe les changements de préférence (moteur : mise en veille immédiate si coupé). */
export function subscribeSoundPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(subscribeSoundPrefs, getSoundPrefs, getSoundPrefs);
}
