/**
 * Assets des univers Budget (Le Voyage de Chihiro) et Courses (Kiki la petite
 * sorcière) — GÉNÉRÉ par art/pipeline/universes/gen_manifest.py.
 * Ne pas éditer à la main : voir art/pipeline/universes/README.md.
 *
 * Poids total : 1.86 Mo (64 fichiers) — budget 807 Ko · courses 1093 Ko.
 *
 * Formats :
 * - Bandeaux (banners, scene) : WebP opaque qualité 82 ; paysage 1536×1024
 *   (définition native des sources, pas d'agrandissement), portrait 1024×1536.
 *   Budget : paysage 1536×1024 px, 207 Ko, portrait
 *   1024×1536 px, 232 Ko, scène du pont 1536×1024 px, 191 Ko.
 *   Courses : paysage 1536×1024 px, 351 Ko, portrait
 *   1024×1536 px, 334 Ko.
 * - Sprites : WebP RGBA non prémultiplié, détourés par composantes connexes de
 *   l'alpha, défrangés, réduits en alpha prémultiplié, couleurs propagées sous
 *   l'alpha nul ; marge transparente de 6 px. Même échelle pour toutes les
 *   poses d'un même personnage (tailles = toile, marge comprise) :
 *   Sans-Visage 182–263×356–382 px, 60 Ko (hauteur utile 360) ;
 *   Noiraudes 121–194×113–200 px, 51 Ko (hauteur utile 180) ;
 *   Kiki 157–402×308–381 px, 103 Ko (hauteur utile 360 ; sweepA / sweepB sur la même
 *   toile, calées en bas : bascule directe pour l'animation) ;
 *   Jiji 231–278×201–281 px, 81 Ko (hauteur utile 260) ;
 *   paniers 335–374×314–342 px, 114 Ko (hauteur utile 320) ;
 *   balai 540×106 px, 12 Ko ; poussière 541×210 px, 31 Ko ;
 *   étincelles 423×268 px, 22 Ko.
 * - Petits objets sur toile carrée, contenu centré : pépites / pièces /
 *   kompeitō 96×96 (contenu ≤ 84) ; icônes de rayons 128×128 (contenu ≤ 116).
 * - Clés de `categories` = GROCERY_CATEGORIES de @a2/core (home/groceries.ts).
 *
 * Bandeaux de saison (hors précache) : budget autumn 616 Ko · budget winter 683 Ko · courses autumn 704 Ko · courses winter 793 Ko.
 * - Fichiers assets/seasons/season-<thème>-<saison>-<cadre>.webp, émis au build
 *   sous assets/season-*-<hash>.webp : MOTIF À EXCLURE DU PRÉCACHE
 *   (globIgnores: 'assets/season-*'), servis par le cache à l'exécution.
 * - Mêmes formats et mêmes cadrages recommandés que banners (WebP opaque
 *   qualité 82, paysage 1536×1024, portrait 1024×1536).
 */
import type { BudgetTheme, CoursesTheme } from './types';
import budgetBannerLandscape from './assets/budget/banner-landscape.webp';
import budgetBannerPortrait from './assets/budget/banner-portrait.webp';
import budgetSceneBridge from './assets/budget/scene-bridge.webp';
import budgetNofaceCalm from './assets/budget/noface-calm.webp';
import budgetNofaceOffering from './assets/budget/noface-offering.webp';
import budgetNofaceContent from './assets/budget/noface-content.webp';
import budgetNofaceShy from './assets/budget/noface-shy.webp';
import budgetNofaceBow from './assets/budget/noface-bow.webp';
import budgetNofaceFading from './assets/budget/noface-fading.webp';
import budgetSusuwatariCarryPink from './assets/budget/susuwatari-carry-pink.webp';
import budgetSusuwatariCarryYellow from './assets/budget/susuwatari-carry-yellow.webp';
import budgetSusuwatariCarryGreen from './assets/budget/susuwatari-carry-green.webp';
import budgetSusuwatariCarryBlueDuo from './assets/budget/susuwatari-carry-blue-duo.webp';
import budgetSusuwatariJumpWhite from './assets/budget/susuwatari-jump-white.webp';
import budgetSusuwatariHiding from './assets/budget/susuwatari-hiding.webp';
import budgetSusuwatariSleeping from './assets/budget/susuwatari-sleeping.webp';
import budgetSusuwatariTrio from './assets/budget/susuwatari-trio.webp';
import budgetGoldNugget1 from './assets/budget/gold-nugget-1.webp';
import budgetGoldNugget2 from './assets/budget/gold-nugget-2.webp';
import budgetGoldNugget3 from './assets/budget/gold-nugget-3.webp';
import budgetGoldNugget4 from './assets/budget/gold-nugget-4.webp';
import budgetGoldNugget5 from './assets/budget/gold-nugget-5.webp';
import budgetGoldNugget6 from './assets/budget/gold-nugget-6.webp';
import budgetGoldCoin1 from './assets/budget/gold-coin-1.webp';
import budgetGoldCoin2 from './assets/budget/gold-coin-2.webp';
import budgetGoldCoin3 from './assets/budget/gold-coin-3.webp';
import budgetKonpeitoPink from './assets/budget/konpeito-pink.webp';
import budgetKonpeitoYellow from './assets/budget/konpeito-yellow.webp';
import budgetKonpeitoYellow2 from './assets/budget/konpeito-yellow-2.webp';
import budgetKonpeitoGreen from './assets/budget/konpeito-green.webp';
import budgetKonpeitoGreen2 from './assets/budget/konpeito-green-2.webp';
import budgetKonpeitoBlue from './assets/budget/konpeito-blue.webp';
import budgetKonpeitoBlue2 from './assets/budget/konpeito-blue-2.webp';
import budgetKonpeitoWhite from './assets/budget/konpeito-white.webp';
import budgetKonpeitoPurple from './assets/budget/konpeito-purple.webp';
import budgetKonpeitoPurple2 from './assets/budget/konpeito-purple-2.webp';
import seasonBudgetAutumnLandscape from './assets/seasons/season-budget-autumn-landscape.webp';
import seasonBudgetAutumnPortrait from './assets/seasons/season-budget-autumn-portrait.webp';
import seasonBudgetWinterLandscape from './assets/seasons/season-budget-winter-landscape.webp';
import seasonBudgetWinterPortrait from './assets/seasons/season-budget-winter-portrait.webp';
import coursesBannerLandscape from './assets/courses/banner-landscape.webp';
import coursesBannerPortrait from './assets/courses/banner-portrait.webp';
import coursesKikiFlying from './assets/courses/kiki-flying.webp';
import coursesKikiSweepA from './assets/courses/kiki-sweep-a.webp';
import coursesKikiSweepB from './assets/courses/kiki-sweep-b.webp';
import coursesKikiBasket from './assets/courses/kiki-basket.webp';
import coursesKikiWave from './assets/courses/kiki-wave.webp';
import coursesKikiList from './assets/courses/kiki-list.webp';
import coursesJijiInBasket from './assets/courses/jiji-in-basket.webp';
import coursesJijiInBag from './assets/courses/jiji-in-bag.webp';
import coursesJijiTeacup from './assets/courses/jiji-teacup.webp';
import coursesJijiOnBasket from './assets/courses/jiji-on-basket.webp';
import coursesJijiSleeping from './assets/courses/jiji-sleeping.webp';
import coursesBasketEmpty from './assets/courses/basket-empty.webp';
import coursesBasketHalf from './assets/courses/basket-half.webp';
import coursesBasketFull from './assets/courses/basket-full.webp';
import coursesBroom from './assets/courses/broom.webp';
import coursesDust from './assets/courses/dust.webp';
import coursesSparkles from './assets/courses/sparkles.webp';
import coursesCategoryFruitsLegumes from './assets/courses/category-fruits-legumes.webp';
import coursesCategoryFrais from './assets/courses/category-frais.webp';
import coursesCategoryBoulangerie from './assets/courses/category-boulangerie.webp';
import coursesCategoryEpicerie from './assets/courses/category-epicerie.webp';
import coursesCategoryBoissons from './assets/courses/category-boissons.webp';
import coursesCategorySurgeles from './assets/courses/category-surgeles.webp';
import coursesCategoryHygiene from './assets/courses/category-hygiene.webp';
import coursesCategoryMaison from './assets/courses/category-maison.webp';
import coursesCategoryAutre from './assets/courses/category-autre.webp';
import seasonCoursesAutumnLandscape from './assets/seasons/season-courses-autumn-landscape.webp';
import seasonCoursesAutumnPortrait from './assets/seasons/season-courses-autumn-portrait.webp';
import seasonCoursesWinterLandscape from './assets/seasons/season-courses-winter-landscape.webp';
import seasonCoursesWinterPortrait from './assets/seasons/season-courses-winter-portrait.webp';

export const budgetTheme: BudgetTheme = {
  banners: {
    landscape: budgetBannerLandscape,
    portrait: budgetBannerPortrait,
  },
  seasons: {
    autumn: {
      landscape: seasonBudgetAutumnLandscape,
      portrait: seasonBudgetAutumnPortrait,
    },
    winter: {
      landscape: seasonBudgetWinterLandscape,
      portrait: seasonBudgetWinterPortrait,
    },
  },
  scene: budgetSceneBridge,
  noFace: {
    calm: budgetNofaceCalm,
    offering: budgetNofaceOffering,
    content: budgetNofaceContent,
    shy: budgetNofaceShy,
    bow: budgetNofaceBow,
    fading: budgetNofaceFading,
  },
  susuwatari: {
    carryPink: budgetSusuwatariCarryPink,
    carryYellow: budgetSusuwatariCarryYellow,
    carryGreen: budgetSusuwatariCarryGreen,
    carryBlueDuo: budgetSusuwatariCarryBlueDuo,
    jumpWhite: budgetSusuwatariJumpWhite,
    hiding: budgetSusuwatariHiding,
    sleeping: budgetSusuwatariSleeping,
    trio: budgetSusuwatariTrio,
  },
  gold: {
    nuggets: [budgetGoldNugget1, budgetGoldNugget2, budgetGoldNugget3, budgetGoldNugget4, budgetGoldNugget5, budgetGoldNugget6],
    coins: [budgetGoldCoin1, budgetGoldCoin2, budgetGoldCoin3],
    konpeito: {
      pink: budgetKonpeitoPink,
      yellow: budgetKonpeitoYellow,
      'yellow-2': budgetKonpeitoYellow2,
      green: budgetKonpeitoGreen,
      'green-2': budgetKonpeitoGreen2,
      blue: budgetKonpeitoBlue,
      'blue-2': budgetKonpeitoBlue2,
      white: budgetKonpeitoWhite,
      purple: budgetKonpeitoPurple,
      'purple-2': budgetKonpeitoPurple2,
    },
  },
};

export const coursesTheme: CoursesTheme = {
  banners: {
    landscape: coursesBannerLandscape,
    portrait: coursesBannerPortrait,
  },
  seasons: {
    autumn: {
      landscape: seasonCoursesAutumnLandscape,
      portrait: seasonCoursesAutumnPortrait,
    },
    winter: {
      landscape: seasonCoursesWinterLandscape,
      portrait: seasonCoursesWinterPortrait,
    },
  },
  kiki: {
    flying: coursesKikiFlying,
    sweepA: coursesKikiSweepA,
    sweepB: coursesKikiSweepB,
    basket: coursesKikiBasket,
    wave: coursesKikiWave,
    list: coursesKikiList,
  },
  jiji: {
    inBasket: coursesJijiInBasket,
    inBag: coursesJijiInBag,
    teacup: coursesJijiTeacup,
    onBasket: coursesJijiOnBasket,
    sleeping: coursesJijiSleeping,
  },
  basket: {
    empty: coursesBasketEmpty,
    half: coursesBasketHalf,
    full: coursesBasketFull,
  },
  broom: coursesBroom,
  dust: coursesDust,
  sparkles: coursesSparkles,
  categories: {
    'fruits-legumes': coursesCategoryFruitsLegumes,
    frais: coursesCategoryFrais,
    boulangerie: coursesCategoryBoulangerie,
    epicerie: coursesCategoryEpicerie,
    boissons: coursesCategoryBoissons,
    surgeles: coursesCategorySurgeles,
    hygiene: coursesCategoryHygiene,
    maison: coursesCategoryMaison,
    autre: coursesCategoryAutre,
  },
};
