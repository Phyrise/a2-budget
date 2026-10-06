/**
 * Les quatre modules et leur univers :
 * - Maison : forêt de Yakushima (scène vivante) ;
 * - Budget : Le Voyage de Chihiro (maison de bains au crépuscule) ;
 * - Courses : Kiki la petite sorcière (Koriko) ;
 * - Calendrier : Mon voisin Totoro (arrêt de bus sous la pluie, V4).
 *
 * Cadrages (object-position) : notes d'art/pipeline/universes/banners.py,
 * rendues dans qa/banner-crops.png — bandeau mobile 390×200 et fond
 * « téléphone » (portrait plein cadre), réutilisé pour la colonne du monde
 * sur ordinateur. En automne et en hiver, Budget et Courses prennent leur
 * variante de saison (themes/manifest.ts `seasons`, même cadrage).
 * Calendrier : cadrages recommandés par art/pipeline/v4/totoro.py (Totoro et
 * l'abri restent dans le cadre) — bandeau paysage 60 % 40 %, fond portrait
 * « téléphone » 55 % 50 %. Pas de variante de saison (il pleut toute l'année).
 */
import type { IconName } from '../ui';
import { budgetTheme, calendarTheme, coursesTheme } from '../themes/manifest';
import type { ThemeBanners } from '../themes/types';
import type { Season } from '../world/types';
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
  /** Peinture de base (toute l'année, et image d'attente des variantes). */
  src: string;
  /** object-position CSS (mêmes cadrages pour les variantes de saison). */
  position: string;
  /** Variantes de saison (automne, hiver), chargées à la demande. */
  seasons?: Partial<Record<Season, string>>;
}

type Frame = keyof ThemeBanners;

function themed(theme: typeof budgetTheme | typeof coursesTheme, frame: Frame, position: string): UniverseImage {
  const seasons: Partial<Record<Season, string>> = {};
  for (const s of ['autumn', 'winter'] as const) {
    const v = theme.seasons?.[s]?.[frame];
    if (v) seasons[s] = v;
  }
  return { src: theme.banners[frame], position, seasons };
}

/** Peinture à afficher pour une saison : la variante si elle existe, sinon la base. */
export function imageForSeason(image: UniverseImage, season: Season): string {
  return image.seasons?.[season] ?? image.src;
}

export interface Universe {
  /** Bandeau peint du haut de l'écran (mobile, tablette). */
  banner: UniverseImage | null;
  /**
   * Peinture portrait en fond fixe sur ordinateur (colonne du monde), à la
   * place de la forêt vivante. null = la forêt reste (Maison seulement).
   */
  backdrop: UniverseImage | null;
}

export const UNIVERSES: Record<ModuleId, Universe> = {
  maison: { banner: null, backdrop: null },
  budget: {
    banner: themed(budgetTheme, 'landscape', '50% 10%'),
    backdrop: themed(budgetTheme, 'portrait', '60% 50%'),
  },
  courses: {
    banner: themed(coursesTheme, 'landscape', '50% 8%'),
    backdrop: themed(coursesTheme, 'portrait', '62% 50%'),
  },
  // Mon voisin Totoro : l'arrêt de bus sous la pluie, au crépuscule.
  calendar: {
    banner: { src: calendarTheme.banners.landscape, position: '60% 40%' },
    backdrop: { src: calendarTheme.banners.portrait, position: '55% 50%' },
  },
};

/** Le monde est la forêt vivante (et non une peinture fixe) pour ce module et cette largeur. */
export function showsLivingForest(module: ModuleId, isDesktop: boolean): boolean {
  const universe = UNIVERSES[module];
  return isDesktop ? universe.backdrop === null : universe.banner === null;
}
