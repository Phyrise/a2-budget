/**
 * Contrat des assets des univers de module (Budget = Le Voyage de Chihiro,
 * Courses = Kiki la petite sorcière). Les valeurs sont des URL (imports Vite)
 * fournies par ./manifest.ts ; formats et tailles documentés dans son en-tête.
 */
import type { GroceryCategory } from '@a2/core';

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
