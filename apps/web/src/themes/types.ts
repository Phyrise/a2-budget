/**
 * Contrat des assets des univers de module (Budget = Le Voyage de Chihiro,
 * Courses = Kiki la petite sorcière, Calendrier = Mon voisin Totoro). Les valeurs sont des URL (imports Vite)
 * fournies par ./manifest.ts ; formats et tailles documentés dans son en-tête.
 */
import type { CalendarEventKind, GroceryCategory } from '@a2/core';

/** Bandeaux opaques : paysage 1536×1024 (desktop, bandeau mobile) et portrait 1024×1536. */
export interface ThemeBanners {
  landscape: string;
  portrait: string;
}

export type NoFacePose = 'calm' | 'offering' | 'content' | 'shy' | 'bow' | 'fading';

export interface BudgetTheme {
  banners: ThemeBanners;
  /** Bandeaux de saison (automne, hiver) ; absent = bandeau de base. Chargés à la demande. */
  seasons?: Partial<Record<'autumn' | 'winter', ThemeBanners>>;
  /** Scène paysage du Sans-Visage sur le pont (même cadre que banners.landscape). */
  scene: string;
  noFace: Record<NoFacePose, string>;
  susuwatari: {
    carryPink: string;
    carryYellow: string;
    carryGreen: string;
    carryBlueDuo: string;
    jumpWhite: string;
    hiding: string;
    sleeping: string;
    trio: string;
  };
  gold: {
    nuggets: string[];
    coins: string[];
    /** Couleur → URL (pink, yellow, green, blue, white, purple ; variantes suffixées « -2 »). */
    konpeito: Record<string, string>;
  };
}

export type KikiPose = 'flying' | 'sweepA' | 'sweepB' | 'basket' | 'wave' | 'list';
export type JijiPose = 'inBasket' | 'inBag' | 'teacup' | 'onBasket' | 'sleeping';
export type BasketFill = 'empty' | 'half' | 'full';

export interface CoursesTheme {
  banners: ThemeBanners;
  /** Bandeaux de saison (automne, hiver) ; absent = bandeau de base. Chargés à la demande. */
  seasons?: Partial<Record<'autumn' | 'winter', ThemeBanners>>;
  kiki: Record<KikiPose, string>;
  jiji: Record<JijiPose, string>;
  basket: Record<BasketFill, string>;
  broom: string;
  dust: string;
  sparkles: string;
  /** Une icône par rayon : clés = GROCERY_CATEGORIES de @a2/core. */
  categories: Record<GroceryCategory, string>;
}

export type TotoroPose = 'umbrella' | 'gift' | 'joy' | 'sleeping' | 'chuAcorns' | 'chibiPeek';
export type CatbusPose = 'running' | 'waiting' | 'sign' | 'leap';

/**
 * Univers du Calendrier (Mon voisin Totoro), V4 — slot facultatif côté
 * interface : tant qu'il n'est pas branché, la forêt de Maison reste le décor.
 */
export interface CalendarTheme {
  /** Arrêt de bus sous la pluie au crépuscule, Totoro au parapluie. */
  banners: ThemeBanners;
  /** Grand Totoro (parapluie-feuille, paquet-feuille offert, joie, endormi), Chu-Totoro bleu aux glands, Chibi-Totoro qui regarde. */
  totoro: Record<TotoroPose, string>;
  /** Chatbus : court de profil, arrêté porte ouverte, de trois-quarts face (panneau vide), en saut. */
  catbus: Record<CatbusPose, string>;
  /**
   * Facultatif (V4.1) : frames d'UN cycle de galop du Chatbus, de profil,
   * tourné vers la DROITE (l'interface le retourne pour filer vers la
   * gauche), dans l'ordre (6 à 8 conseillées). Toutes sur la même toile
   * (même taille, même ligne de sol en bas, corps immobile : seules les
   * pattes bougent), fond transparent, WebP. L'interface les joue en boucle
   * à 12 images/s pendant la traversée, avec un léger rebond par cycle ; en
   * mouvement réduit, la première seule apparaît en fondu. Fichiers
   * assets/calendar/catbus-run-<n>.webp (n = 1, 2…), déclarés par
   * gen_manifest.py. Absent (ou moins de 2 frames) : alternance
   * « running » / « leap ».
   */
  catbusRun?: string[];
  /** Une icône par nature d'événement : clés = CALENDAR_KINDS de @a2/core. */
  kinds: Record<CalendarEventKind, string>;
  /** Icônes bonus : parapluie rouge, jeune pousse. */
  extras: { umbrella: string; sprout: string };
}
