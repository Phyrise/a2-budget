/**
 * Préférences d'interface, séparées des données : clé `a2-budget:ui:v1`.
 * Lecture / écriture toujours protégées (navigation privée, stockage bloqué) :
 * l'app fonctionne avec les valeurs par défaut si le stockage est absent.
 * Jamais `localStorage.clear()`.
 */
import type { WorldMotion } from '../world/types';

export type ModuleId = 'budget' | 'maison' | 'courses' | 'calendar';

export const MODULES: ReadonlyArray<{ id: ModuleId; label: string }> = [
  { id: 'budget', label: 'Budget' },
  { id: 'maison', label: 'Maison' },
  { id: 'courses', label: 'Courses' },
  { id: 'calendar', label: 'Calendrier' },
];

export interface UiPrefs {
  /** Dernier module ouvert. */
  module: ModuleId;
  /** Préférence « Forêt » : vivante / immobile (V4.2 : l'ancienne « douce » se lit « vivante »). */
  forestMotion: WorldMotion;
  /** Forêt plafonnée à 30 images/s (essai : plus léger, un peu moins fluide). */
  forestFps30: boolean;
  /** Le gardien a déjà été montré (joué une seule fois). */
  guardianSeen: boolean;
  /** « Disponible hors ligne » déjà annoncé. */
  offlineAnnounced: boolean;
  /** « À venir » (Maison) déplié. */
  upcomingOpen: boolean;
  /** L'explication de la lanterne a déjà été lue. */
  lanternIntroSeen: boolean;
  /**
   * Mode développeur (Réglages › À propos) : révèle les valeurs cachées de
   * la forêt et permet des aperçus non persistants, pendant la création.
   */
  devMode: boolean;
}

const KEY = 'a2-budget:ui:v1';

export const DEFAULT_PREFS: UiPrefs = {
  module: 'maison',
  forestMotion: 'full',
  forestFps30: false,
  guardianSeen: false,
  offlineAnnounced: false,
  upcomingOpen: false,
  lanternIntroSeen: false,
  devMode: false,
};

export function isModuleId(value: unknown): value is ModuleId {
  return value === 'budget' || value === 'maison' || value === 'courses' || value === 'calendar';
}

/** V4.2 : « douce » a quitté les Réglages ; une préférence enregistrée 'gentle' se lit 'full'. */
function readMotion(value: unknown): WorldMotion {
  return value === 'still' ? 'still' : value === 'full' || value === 'gentle' ? 'full' : DEFAULT_PREFS.forestMotion;
}

export function readPrefs(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return { ...DEFAULT_PREFS };
    const value = JSON.parse(raw) as Partial<Record<keyof UiPrefs, unknown>>;
    return {
      module: isModuleId(value.module) ? value.module : DEFAULT_PREFS.module,
      forestMotion: readMotion(value.forestMotion),
      forestFps30: value.forestFps30 === true,
      guardianSeen: value.guardianSeen === true,
      offlineAnnounced: value.offlineAnnounced === true,
      upcomingOpen: value.upcomingOpen === true,
      lanternIntroSeen: value.lanternIntroSeen === true,
      devMode: value.devMode === true,
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
