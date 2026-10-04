/**
 * Les quatre modules et leur univers :
 * - Maison : forêt de Yakushima (scène vivante) ;
 * - Budget : Le Voyage de Chihiro (maison de bains au crépuscule) ;
 * - Courses : Kiki la petite sorcière (Koriko) ;
 * - Calendrier : la forêt, en attendant un univers dédié.
 *
 * Cadrages (object-position) : notes d'art/pipeline/universes/banners.py,
 * rendues dans qa/banner-crops.png — bandeau mobile 390×200 et fond
 * « téléphone » (portrait plein cadre), réutilisé pour la colonne du monde
 * sur ordinateur.
 */
import type { IconName } from '../ui';
import { budgetTheme, coursesTheme } from '../themes/manifest';
import { manifest } from '../world/manifest';
import type { ModuleId } from './prefs';

export const NAV_ICONS: Record<ModuleId, IconName> = {
  budget: 'budget',
  maison: 'home',
  courses: 'basket',
  calendar: 'calendar',
};

/** Part de la hauteur d'écran occupée par la fenêtre sur le monde (mobile). */
export const WORLD_RATIO: Record<ModuleId, number> = { maison: 0.54, budget: 0.24, courses: 0.24, calendar: 0.24 };

export const HISTORY_TITLES: Record<ModuleId, string> = {
  budget: 'Historique du budget',
  maison: 'Historique de la maison',
  courses: 'Historique des courses',
  calendar: 'Événements passés',
};

export interface UniverseImage {
  src: string;
  /** object-position CSS. */
  position: string;
}

export interface Universe {
  /** Bandeau peint du haut de l'écran (mobile, tablette). */
  banner: UniverseImage | null;
  /**
   * Peinture portrait en fond fixe sur ordinateur (colonne du monde), à la
   * place de la forêt vivante. null = la forêt reste (Maison, Calendrier).
   */
  backdrop: UniverseImage | null;
}

export const UNIVERSES: Record<ModuleId, Universe> = {
  maison: { banner: null, backdrop: null },
  budget: {
    banner: { src: budgetTheme.banners.landscape, position: '50% 10%' },
    backdrop: { src: budgetTheme.banners.portrait, position: '60% 50%' },
  },
  courses: {
    banner: { src: coursesTheme.banners.landscape, position: '50% 8%' },
    backdrop: { src: coursesTheme.banners.portrait, position: '62% 50%' },
  },
  // Le vieux cèdre à la corde sacrée : un air de fête, pour les événements.
  calendar: {
    banner: manifest.banners.budget ? { src: manifest.banners.budget, position: '50% 38%' } : null,
    backdrop: null,
  },
};

/** Le monde est la forêt vivante (et non une peinture fixe) pour ce module et cette largeur. */
export function showsLivingForest(module: ModuleId, isDesktop: boolean): boolean {
  const universe = UNIVERSES[module];
  return isDesktop ? universe.backdrop === null : universe.banner === null;
}
