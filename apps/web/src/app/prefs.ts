/**
 * Préférences d'interface, séparées des données : clé `a2-budget:ui:v1`.
 * Lecture / écriture toujours protégées (navigation privée, stockage bloqué) :
 * l'app fonctionne avec les valeurs par défaut si le stockage est absent.
 * Jamais `localStorage.clear()`.
 */
import type { WorldMotion } from '../world/types';

export type ModuleId = 'budget' | 'maison' | 'courses';

export const MODULES: ReadonlyArray<{ id: ModuleId; label: string }> = [
  { id: 'budget', label: 'Budget' },
  { id: 'maison', label: 'Maison' },
  { id: 'courses', label: 'Courses' },
];

export interface UiPrefs {
  /** Dernier module ouvert. */
  module: ModuleId;
  /** Préférence « Forêt » : vivante / douce / immobile. */
  forestMotion: WorldMotion;
  /** Le gardien a déjà été montré (joué une seule fois). */
  guardianSeen: boolean;
  /** « Disponible hors ligne » déjà annoncé. */
  offlineAnnounced: boolean;
}

const KEY = 'a2-budget:ui:v1';

export const DEFAULT_PREFS: UiPrefs = {
  module: 'maison',
  forestMotion: 'full',
  guardianSeen: false,
  offlineAnnounced: false,
};

export function isModuleId(value: unknown): value is ModuleId {
  return value === 'budget' || value === 'maison' || value === 'courses';
}

function isMotion(value: unknown): value is WorldMotion {
  return value === 'full' || value === 'gentle' || value === 'still';
}

export function readPrefs(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return { ...DEFAULT_PREFS };
    const value = JSON.parse(raw) as Partial<Record<keyof UiPrefs, unknown>>;
    return {
      module: isModuleId(value.module) ? value.module : DEFAULT_PREFS.module,
      forestMotion: isMotion(value.forestMotion) ? value.forestMotion : DEFAULT_PREFS.forestMotion,
      guardianSeen: value.guardianSeen === true,
      offlineAnnounced: value.offlineAnnounced === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs: UiPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Stockage indisponible : la préférence vaut pour cette session seulement.
  }
}

/** Module demandé par l'URL (`?module=budget`), sinon null. */
export function moduleFromUrl(): ModuleId | null {
  try {
    const value = new URLSearchParams(window.location.search).get('module');
    return isModuleId(value) ? value : null;
  } catch {
    return null;
  }
}

/** Garde `?module=` synchronisé s'il est présent dans l'URL (sans entrée d'historique). */
export function syncModuleInUrl(module: ModuleId): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('module')) return;
    url.searchParams.set('module', module);
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // Sans conséquence.
  }
}
