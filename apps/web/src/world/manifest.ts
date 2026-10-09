/**
 * Manifest des assets du monde — GÉNÉRÉ par art/pipeline/10_manifest.py.
 * Ne pas éditer à la main : modifier le pipeline (art/pipeline/README.md) puis
 * régénérer (`art/pipeline/remote.sh all`).
 *
 * Poids total : 5.34 Mo (84 fichiers) — stages 3059 Ko · sprites 805 Ko · banners 492 Ko · depth 375 Ko · fx 345 Ko · foreground 164 Ko · masks 146 Ko · luts 54 Ko · masks-light 34 Ko · placeholder 1 Ko.
 *
 * Saisons (hors précache) : spring 4104 Ko (0/7 profondeurs propres) · autumn 4129 Ko (0/7 profondeurs propres) · winter 3887 Ko (0/7 profondeurs propres).
 * - Fichiers sous assets/seasons/<saison>/, nom de fichier « season-<saison>-… »,
 *   donc émis au build sous assets/season-*-<hash>.<ext> : MOTIF À EXCLURE DU
 *   PRÉCACHE (globIgnores: 'assets/season-*') et à servir par le cache à
 *   l'exécution (la saison en cours, puis la suivante ~14 jours avant).
 * - seasons.<s>.stages[n].color : peinture de saison, WebP 1536×2304 (qualité
 *   80 → 76 pour tenir ≈ 0,6 Mo), recalée sur le stade de base n
 *   (art/pipeline/seasons/s01_align.py, dérive résiduelle ≤ 1,2 px), agrandie
 *   comme la base.
 * - seasons.<s>.stages[n].depth : profondeur du stade de base (même import, même
 *   URL) quand la dérive résiduelle ≤ 2 px et que la silhouette ne change pas ;
 *   sinon season-<s>-depth-<n> (même format et même échelle que la base).
 * - seasons.<s>.nightLut : LUT nuit de la saison (maîtresse de saison → nuit
 *   de saison, même format que luts) ; null = luts.night.
 * - masks, masksLight, foreground, placements : ceux de la base pour toutes
 *   les saisons (cadrage identique).
 *
 * Formats :
 * - stages[n].color : peinture du stade, WebP 1536×2304 q80 (recalée sur le stade 6 ;
 *   sources 1024×1536 agrandies par art/pipeline/upscale.py). Cadrage portrait
 *   identique quelle que soit la taille : tout le reste est en coordonnées normalisées.
 * - stages[n].depth : profondeur 512×768 en niveaux de gris (R = G = B), sans
 *   perte, blanc = près ; même échelle pour tous les stades (calée sur le stade 6).
 * - masks : PNG RGB opaque 512×768 : R = eau (écoulement), G = feuillage /
 *   fougères / mousse fine (vent), B = zone du cèdre (union des changements
 *   entre stades). masksLight : PNG niveaux de gris 512×768 = trouées de
 *   lumière dans la canopée (canal A recomposé par le moteur). Deux fichiers
 *   opaques car WebKit perd le RGB d'un PNG RGBA là où l'alpha est nul. Bords doux.
 * - luts : LUT 3D 33³ en bande PNG 1089×33 (RGB 8 bits) : le pixel
 *   (x = r + 33·b, y = g), avec r, g, b ∈ 0..32, contient la couleur de sortie
 *   pour l'entrée (r, g, b) / 32. Source : peinture du stade 6 ; cibles :
 *   03-vitality-* (humeurs) et 04-pause-night (nuit). Interpolation trilinéaire.
 * - sprites, companions, foreground : WebP RGBA non prémultiplié (couleurs
 *   propagées sous l'alpha nul, pas de liseré), rognés avec une petite marge.
 * - fx : WebP RGBA ; RGB = élément sur noir pur (mélange additif ONE, ONE en
 *   ignorant l'alpha) ; A = luminance normalisée, RGB ≤ A (le même fichier
 *   s'utilise en alpha prémultiplié ONE, ONE_MINUS_SRC_ALPHA). Ne pas laisser le
 *   navigateur reprémultiplier (premultiplyAlpha: 'none'), sinon franges assombries.
 * - Placements : coordonnées normalisées du cadrage portrait (0..1, origine en
 *   haut à gauche), y = point de pose ; depth lue dans la carte du stade 6 ;
 *   scale = hauteur du sprite / hauteur d'image.
 */
import type { WorldManifest } from './types';
import stage1 from './assets/stages/stage-1.webp';
import depth1 from './assets/depth/stage-1.webp';
import stage2 from './assets/stages/stage-2.webp';
import depth2 from './assets/depth/stage-2.webp';
import stage3 from './assets/stages/stage-3.webp';
import depth3 from './assets/depth/stage-3.webp';
import stage4 from './assets/stages/stage-4.webp';
import depth4 from './assets/depth/stage-4.webp';
import stage5 from './assets/stages/stage-5.webp';
import depth5 from './assets/depth/stage-5.webp';
import stage6 from './assets/stages/stage-6.webp';
import depth6 from './assets/depth/stage-6.webp';
import stage7 from './assets/stages/stage-7.webp';
import depth7 from './assets/depth/stage-7.webp';
import masks from './assets/masks.png';
import masksLight from './assets/masks-light.png';
import foreground from './assets/foreground.webp';
import lutQuiet from './assets/luts/quiet.png';
import lutPeaceful from './assets/luts/peaceful.png';
import lutLively from './assets/luts/lively.png';
import lutFlourishing from './assets/luts/flourishing.png';
import lutNight from './assets/luts/night.png';
import kodama1 from './assets/sprites/kodama-1.webp';
import kodama2 from './assets/sprites/kodama-2.webp';
import kodama6 from './assets/sprites/kodama-6.webp';
import kodama8 from './assets/sprites/kodama-8.webp';
import kodama4 from './assets/sprites/kodama-4.webp';
import kodama7 from './assets/sprites/kodama-7.webp';
import kodama3 from './assets/sprites/kodama-3.webp';
import kodama5 from './assets/sprites/kodama-5.webp';
import mossLing from './assets/sprites/moss-ling.webp';
import seedSpirit from './assets/sprites/seed-spirit.webp';
import leafSprite from './assets/sprites/leaf-sprite.webp';
import emberWisp from './assets/sprites/ember-wisp.webp';
import mushroomPip from './assets/sprites/mushroom-pip.webp';
import waterDrip from './assets/sprites/water-drip.webp';
import guardian from './assets/sprites/guardian.webp';
import jijiIdle from './assets/sprites/jiji-idle.webp';
import jijiHappy from './assets/sprites/jiji-happy.webp';
import jijiProud from './assets/sprites/jiji-proud.webp';
import jijiSleepy from './assets/sprites/jiji-sleepy.webp';
import jijiCurious from './assets/sprites/jiji-curious.webp';
import calciferIdle from './assets/sprites/calcifer-idle.webp';
import calciferHappy from './assets/sprites/calcifer-happy.webp';
import calciferProud from './assets/sprites/calcifer-proud.webp';
import calciferSleepy from './assets/sprites/calcifer-sleepy.webp';
import calciferCurious from './assets/sprites/calcifer-curious.webp';
import tetoIdle from './assets/sprites/teto-idle.webp';
import tetoHappy from './assets/sprites/teto-happy.webp';
import tetoProud from './assets/sprites/teto-proud.webp';
import tetoSleepy from './assets/sprites/teto-sleepy.webp';
import tetoCurious from './assets/sprites/teto-curious.webp';
import hinIdle from './assets/sprites/hin-idle.webp';
import hinHappy from './assets/sprites/hin-happy.webp';
import hinProud from './assets/sprites/hin-proud.webp';
import hinSleepy from './assets/sprites/hin-sleepy.webp';
import hinCurious from './assets/sprites/hin-curious.webp';
import fxFog1 from './assets/fx/fog-1.webp';
import fxFog2 from './assets/fx/fog-2.webp';
import fxFog3 from './assets/fx/fog-3.webp';
import fxRays1 from './assets/fx/rays-1.webp';
import fxRays2 from './assets/fx/rays-2.webp';
import fxRays3 from './assets/fx/rays-3.webp';
import fxDrips1 from './assets/fx/drips-1.webp';
import fxDrips2 from './assets/fx/drips-2.webp';
import fxDrips3 from './assets/fx/drips-3.webp';
import fxDrips4 from './assets/fx/drips-4.webp';
import fxDrips5 from './assets/fx/drips-5.webp';
import fxDrips6 from './assets/fx/drips-6.webp';
import fxNeedles1 from './assets/fx/needles-1.webp';
import fxNeedles2 from './assets/fx/needles-2.webp';
import fxNeedles3 from './assets/fx/needles-3.webp';
import fxNeedles4 from './assets/fx/needles-4.webp';
import fxMotes1 from './assets/fx/motes-1.webp';
import fxMotes2 from './assets/fx/motes-2.webp';
import fxMotes3 from './assets/fx/motes-3.webp';
import fxMotes4 from './assets/fx/motes-4.webp';
import fxMotes5 from './assets/fx/motes-5.webp';
import fxMotes6 from './assets/fx/motes-6.webp';
import fxHalos1 from './assets/fx/halos-1.webp';
import fxHalos2 from './assets/fx/halos-2.webp';
import bannerBudget from './assets/banners/budget.webp';
import bannerCourses from './assets/banners/courses.webp';
import placeholder from './assets/placeholder.webp';
import seasonSpringStage1 from './assets/seasons/spring/season-spring-stage-1.webp';
import seasonSpringStage2 from './assets/seasons/spring/season-spring-stage-2.webp';
import seasonSpringStage3 from './assets/seasons/spring/season-spring-stage-3.webp';
import seasonSpringStage4 from './assets/seasons/spring/season-spring-stage-4.webp';
import seasonSpringStage5 from './assets/seasons/spring/season-spring-stage-5.webp';
import seasonSpringStage6 from './assets/seasons/spring/season-spring-stage-6.webp';
import seasonSpringStage7 from './assets/seasons/spring/season-spring-stage-7.webp';
import seasonSpringLutNight from './assets/seasons/spring/season-spring-lut-night.png';
import seasonAutumnStage1 from './assets/seasons/autumn/season-autumn-stage-1.webp';
import seasonAutumnStage2 from './assets/seasons/autumn/season-autumn-stage-2.webp';
import seasonAutumnStage3 from './assets/seasons/autumn/season-autumn-stage-3.webp';
import seasonAutumnStage4 from './assets/seasons/autumn/season-autumn-stage-4.webp';
import seasonAutumnStage5 from './assets/seasons/autumn/season-autumn-stage-5.webp';
import seasonAutumnStage6 from './assets/seasons/autumn/season-autumn-stage-6.webp';
import seasonAutumnStage7 from './assets/seasons/autumn/season-autumn-stage-7.webp';
import seasonAutumnLutNight from './assets/seasons/autumn/season-autumn-lut-night.png';
import seasonWinterStage1 from './assets/seasons/winter/season-winter-stage-1.webp';
import seasonWinterStage2 from './assets/seasons/winter/season-winter-stage-2.webp';
import seasonWinterStage3 from './assets/seasons/winter/season-winter-stage-3.webp';
import seasonWinterStage4 from './assets/seasons/winter/season-winter-stage-4.webp';
import seasonWinterStage5 from './assets/seasons/winter/season-winter-stage-5.webp';
import seasonWinterStage6 from './assets/seasons/winter/season-winter-stage-6.webp';
import seasonWinterStage7 from './assets/seasons/winter/season-winter-stage-7.webp';
import seasonWinterLutNight from './assets/seasons/winter/season-winter-lut-night.png';

export const manifest: WorldManifest = {
  size: { w: 1536, h: 2304 },
  stages: {
    1: { color: stage1, depth: depth1 },
    2: { color: stage2, depth: depth2 },
    3: { color: stage3, depth: depth3 },
    4: { color: stage4, depth: depth4 },
    5: { color: stage5, depth: depth5 },
    6: { color: stage6, depth: depth6 },
    7: { color: stage7, depth: depth7 },
  },
  masks,
  masksLight,
  foreground,
  luts: {
    quiet: lutQuiet,
    peaceful: lutPeaceful,
    lively: lutLively,
    flourishing: lutFlourishing,
    night: lutNight,
  },
  anchors: [
    { x: 0.13, y: 0.5, depth: 0.094 },
    { x: 0.215, y: 0.535, depth: 0.157 },
    { x: 0.255, y: 0.5, depth: 0.165 },
    { x: 0.3, y: 0.508, depth: 0.129 },
    { x: 0.375, y: 0.482, depth: 0.129 },
    { x: 0.43, y: 0.548, depth: 0.169 },
    { x: 0.47, y: 0.515, depth: 0.169 },
    { x: 0.505, y: 0.572, depth: 0.184 },
    { x: 0.555, y: 0.53, depth: 0.165 },
    { x: 0.645, y: 0.57, depth: 0.149 },
    { x: 0.71, y: 0.508, depth: 0.184 },
    { x: 0.765, y: 0.548, depth: 0.2 },
    { x: 0.835, y: 0.568, depth: 0.196 },
    { x: 0.905, y: 0.55, depth: 0.176 },
  ],
  kodamaSpots: [
    { x: 0.36, y: 0.49, depth: 0.098, scale: 0.05 },
    { x: 0.79, y: 0.553, depth: 0.2, scale: 0.048 },
    { x: 0.255, y: 0.503, depth: 0.2, scale: 0.046 },
    { x: 0.135, y: 0.495, depth: 0.067, scale: 0.044 },
    { x: 0.885, y: 0.537, depth: 0.176, scale: 0.052 },
    { x: 0.47, y: 0.553, depth: 0.18, scale: 0.042 },
  ],
  creatureSpots: {
    'moss-ling': { x: 0.31, y: 0.513, depth: 0.129, scale: 0.032 },
    'seed-spirit': { x: 0.64, y: 0.575, depth: 0.149, scale: 0.03 },
    'leaf-sprite': { x: 0.905, y: 0.43, depth: 0.137, scale: 0.04 },
    'ember-wisp': { x: 0.17, y: 0.4, depth: 0.106, scale: 0.042 },
    'mushroom-pip': { x: 0.845, y: 0.572, depth: 0.204, scale: 0.032 },
    'water-drip': { x: 0.055, y: 0.505, depth: 0.22, scale: 0.054 },
  },
  lightSource: { x: 0.29, y: 0.02 },
  guardianSpot: { x: 0.245, y: 0.48, depth: 0.063, scale: 0.38 },
  sprites: {
    kodama: [kodama1, kodama2, kodama6, kodama8, kodama4, kodama7, kodama3, kodama5],
    creatures: {
      'moss-ling': mossLing,
      'seed-spirit': seedSpirit,
      'leaf-sprite': leafSprite,
      'ember-wisp': emberWisp,
      'mushroom-pip': mushroomPip,
      'water-drip': waterDrip,
    },
    guardian,
  },
  companions: {
    jiji: { idle: jijiIdle, happy: jijiHappy, proud: jijiProud, sleepy: jijiSleepy, curious: jijiCurious },
    calcifer: { idle: calciferIdle, happy: calciferHappy, proud: calciferProud, sleepy: calciferSleepy, curious: calciferCurious },
    teto: { idle: tetoIdle, happy: tetoHappy, proud: tetoProud, sleepy: tetoSleepy, curious: tetoCurious },
    hin: { idle: hinIdle, happy: hinHappy, proud: hinProud, sleepy: hinSleepy, curious: hinCurious },
  },
  fx: {
    fog: [fxFog1, fxFog2, fxFog3],
    rays: [fxRays1, fxRays2, fxRays3],
    drips: [fxDrips1, fxDrips2, fxDrips3, fxDrips4, fxDrips5, fxDrips6],
    needles: [fxNeedles1, fxNeedles2, fxNeedles3, fxNeedles4],
    motes: [fxMotes1, fxMotes2, fxMotes3, fxMotes4, fxMotes5, fxMotes6],
    halos: [fxHalos1, fxHalos2],
  },
  banners: { budget: bannerBudget, courses: bannerCourses },
  placeholder,
  seasons: {
    spring: {
      stages: {
        1: { color: seasonSpringStage1, depth: depth1 },
        2: { color: seasonSpringStage2, depth: depth2 },
        3: { color: seasonSpringStage3, depth: depth3 },
        4: { color: seasonSpringStage4, depth: depth4 },
        5: { color: seasonSpringStage5, depth: depth5 },
        6: { color: seasonSpringStage6, depth: depth6 },
        7: { color: seasonSpringStage7, depth: depth7 },
      },
      nightLut: seasonSpringLutNight,
    },
    autumn: {
      stages: {
        1: { color: seasonAutumnStage1, depth: depth1 },
        2: { color: seasonAutumnStage2, depth: depth2 },
        3: { color: seasonAutumnStage3, depth: depth3 },
        4: { color: seasonAutumnStage4, depth: depth4 },
        5: { color: seasonAutumnStage5, depth: depth5 },
        6: { color: seasonAutumnStage6, depth: depth6 },
        7: { color: seasonAutumnStage7, depth: depth7 },
      },
      nightLut: seasonAutumnLutNight,
    },
    winter: {
      stages: {
        1: { color: seasonWinterStage1, depth: depth1 },
        2: { color: seasonWinterStage2, depth: depth2 },
        3: { color: seasonWinterStage3, depth: depth3 },
        4: { color: seasonWinterStage4, depth: depth4 },
        5: { color: seasonWinterStage5, depth: depth5 },
        6: { color: seasonWinterStage6, depth: depth6 },
        7: { color: seasonWinterStage7, depth: depth7 },
      },
      nightLut: seasonWinterLutNight,
    },
  },
};
