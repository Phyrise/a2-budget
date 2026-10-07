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
 * Calendrier (Mon voisin Totoro, V4 — art/pipeline/v4/) : 775 Ko (21 fichiers).
 * - Bandeaux : arrêt de bus sous la pluie, paysage 1536×1024 px, 252 Ko,
 *   portrait 1024×1536 px, 309 Ko. Cadrages
 *   recommandés (object-position ; art/pipeline/v4/totoro.py) : bandeau
 *   mobile 60 % 40 % (paysage) ou 50 % 36 % (portrait), fond 16:9 50 % 55 %,
 *   fond téléphone 55 % 50 % (portrait) : Totoro et l'abri restent dans le cadre.
 * - Totoro 254–416×217–382 px, 59 Ko et Chu / Chibi-Totoro
 *   (même échelle, hauteur utile 360 pour le plus grand ; les petits restent petits) ;
 *   Chatbus 363–440×192–255 px, 89 Ko (plus grand côté 420, même échelle).
 * - Galop du Chatbus (catbusRun, V4.1, art/source/catbus-run/) : 8 frames
 *   WebP 301×180 sur la même toile (corps immobile, seules les pattes bougent),
 *   tournées vers la droite ; jouées à 12 i/s pendant la traversée.
 * - Icônes 128×128 (contenu ≤ 116) : `kinds` (clés = CALENDAR_KINDS de
 *   @a2/core) + `extras` (parapluie rouge, pousse).
 *
 * Bandeaux de saison (hors précache) : budget autumn 616 Ko · budget winter 683 Ko · courses autumn 704 Ko · courses winter 793 Ko.
 * - Fichiers assets/seasons/season-<thème>-<saison>-<cadre>.webp, émis au build
 *   sous assets/season-*-<hash>.webp : MOTIF À EXCLURE DU PRÉCACHE
 *   (globIgnores: 'assets/season-*'), servis par le cache à l'exécution.
 * - Mêmes formats et mêmes cadrages recommandés que banners (WebP opaque
 *   qualité 82, paysage 1536×1024, portrait 1024×1536).
 */
import type { BudgetTheme, CalendarTheme, CoursesTheme } from './types';
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
import calendarBannerLandscape from './assets/calendar/banner-landscape.webp';
import calendarBannerPortrait from './assets/calendar/banner-portrait.webp';
import calendarTotoroUmbrella from './assets/calendar/totoro-umbrella.webp';
import calendarTotoroGift from './assets/calendar/totoro-gift.webp';
import calendarTotoroJoy from './assets/calendar/totoro-joy.webp';
import calendarTotoroSleeping from './assets/calendar/totoro-sleeping.webp';
import calendarChuTotoroAcorns from './assets/calendar/chu-totoro-acorns.webp';
import calendarChibiTotoroPeek from './assets/calendar/chibi-totoro-peek.webp';
import calendarCatbusRunning from './assets/calendar/catbus-running.webp';
import calendarCatbusWaiting from './assets/calendar/catbus-waiting.webp';
import calendarCatbusSign from './assets/calendar/catbus-sign.webp';
import calendarCatbusLeap from './assets/calendar/catbus-leap.webp';
import calendarCatbusRun1 from './assets/calendar/catbus-run-1.webp';
import calendarCatbusRun2 from './assets/calendar/catbus-run-2.webp';
import calendarCatbusRun3 from './assets/calendar/catbus-run-3.webp';
import calendarCatbusRun4 from './assets/calendar/catbus-run-4.webp';
import calendarCatbusRun5 from './assets/calendar/catbus-run-5.webp';
import calendarCatbusRun6 from './assets/calendar/catbus-run-6.webp';
import calendarCatbusRun7 from './assets/calendar/catbus-run-7.webp';
import calendarCatbusRun8 from './assets/calendar/catbus-run-8.webp';
import calendarIconRepas from './assets/calendar/icon-repas.webp';
import calendarIconSortie from './assets/calendar/icon-sortie.webp';
import calendarIconAnniversaire from './assets/calendar/icon-anniversaire.webp';
import calendarIconRdv from './assets/calendar/icon-rdv.webp';
import calendarIconVoyage from './assets/calendar/icon-voyage.webp';
import calendarIconMaison from './assets/calendar/icon-maison.webp';
import calendarIconAutre from './assets/calendar/icon-autre.webp';
import calendarIconParapluie from './assets/calendar/icon-parapluie.webp';
import calendarIconPousse from './assets/calendar/icon-pousse.webp';

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

export const calendarTheme: CalendarTheme = {
  banners: {
    landscape: calendarBannerLandscape,
    portrait: calendarBannerPortrait,
  },
  totoro: {
    umbrella: calendarTotoroUmbrella,
    gift: calendarTotoroGift,
    joy: calendarTotoroJoy,
    sleeping: calendarTotoroSleeping,
    chuAcorns: calendarChuTotoroAcorns,
    chibiPeek: calendarChibiTotoroPeek,
  },
  catbus: {
    running: calendarCatbusRunning,
    waiting: calendarCatbusWaiting,
    sign: calendarCatbusSign,
    leap: calendarCatbusLeap,
  },
  catbusRun: [
    calendarCatbusRun1,
    calendarCatbusRun2,
    calendarCatbusRun3,
    calendarCatbusRun4,
    calendarCatbusRun5,
    calendarCatbusRun6,
    calendarCatbusRun7,
    calendarCatbusRun8,
  ],
  kinds: {
    repas: calendarIconRepas,
    sortie: calendarIconSortie,
    anniversaire: calendarIconAnniversaire,
    rdv: calendarIconRdv,
    voyage: calendarIconVoyage,
    maison: calendarIconMaison,
    autre: calendarIconAutre,
  },
  extras: {
    umbrella: calendarIconParapluie,
    sprout: calendarIconPousse,
  },
};
