/**
 * Manifest des assets du monde — GÉNÉRÉ par art/pipeline/10_manifest.py.
 * Ne pas éditer à la main : modifier le pipeline (art/pipeline/README.md) puis
 * régénérer (`art/pipeline/remote.sh all`).
 *
 * Poids total : 4.29 Mo (73 fichiers) — stages 2174 Ko · sprites 597 Ko · banners 492 Ko · depth 375 Ko · fx 345 Ko · masks 190 Ko · foreground 164 Ko · luts 54 Ko · placeholder 1 Ko.
 *
 * Formats :
 * - stages[n].color : peinture du stade, WebP 1024×1536 (recalée sur le stade 6).
 * - stages[n].depth : profondeur 512×768 en niveaux de gris (R = G = B), sans
 *   perte, blanc = près ; même échelle pour tous les stades (calée sur le stade 6).
 * - masks : PNG RGBA 512×768 NON prémultiplié (à décoder sans prémultiplication) :
 *   R = eau (écoulement), G = feuillage / fougères / mousse fine (vent),
 *   B = zone du cèdre (union des changements entre stades), A = trouées de
 *   lumière dans la canopée. Bords doux.
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
import foreground from './assets/foreground.webp';
import lutQuiet from './assets/luts/quiet.png';
import lutPeaceful from './assets/luts/peaceful.png';
import lutLively from './assets/luts/lively.png';
import lutFlourishing from './assets/luts/flourishing.png';
import lutNight from './assets/luts/night.png';
import kodama1 from './assets/sprites/kodama-1.webp';
import kodama6 from './assets/sprites/kodama-6.webp';
import kodama2 from './assets/sprites/kodama-2.webp';
import kodama4 from './assets/sprites/kodama-4.webp';
import kodama7 from './assets/sprites/kodama-7.webp';
import kodama5 from './assets/sprites/kodama-5.webp';
import kodama3 from './assets/sprites/kodama-3.webp';
import kodama8 from './assets/sprites/kodama-8.webp';
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

export const manifest: WorldManifest = {
  size: { w: 1024, h: 1536 },
  stages: {
    1: { color: stage1, depth: depth1 },
    2: { color: stage2, depth: depth2 },
    3: { color: stage3, depth: depth3 },
    4: { color: stage4, depth: depth4 },
    5: { color: stage5, depth: depth5 },
    6: { color: stage6, depth: depth6 },
    7: { color: stage7, depth: depth7 },
  },
  masks: masks,
  foreground: foreground,
  luts: {
    quiet: lutQuiet,
    peaceful: lutPeaceful,
    lively: lutLively,
    flourishing: lutFlourishing,
    night: lutNight,
  },
  anchors: [
    { x: 0.13, y: 0.575, depth: 0.431 },
    { x: 0.27, y: 0.612, depth: 0.396 },
    { x: 0.4, y: 0.642, depth: 0.349 },
    { x: 0.47, y: 0.592, depth: 0.188 },
    { x: 0.6, y: 0.607, depth: 0.176 },
    { x: 0.765, y: 0.588, depth: 0.208 },
    { x: 0.575, y: 0.676, depth: 0.224 },
    { x: 0.84, y: 0.668, depth: 0.251 },
    { x: 0.77, y: 0.742, depth: 0.314 },
    { x: 0.25, y: 0.776, depth: 0.553 },
    { x: 0.46, y: 0.79, depth: 0.384 },
    { x: 0.905, y: 0.79, depth: 0.42 },
    { x: 0.085, y: 0.69, depth: 0.529 },
    { x: 0.36, y: 0.705, depth: 0.404 },
  ],
  kodamaSpots: [
    { x: 0.585, y: 0.672, depth: 0.224, scale: 0.055 },
    { x: 0.23, y: 0.607, depth: 0.427, scale: 0.052 },
    { x: 0.8, y: 0.613, depth: 0.216, scale: 0.046 },
    { x: 0.885, y: 0.706, depth: 0.349, scale: 0.058 },
    { x: 0.47, y: 0.598, depth: 0.188, scale: 0.042 },
    { x: 0.27, y: 0.783, depth: 0.561, scale: 0.066 },
  ],
  creatureSpots: {
    'moss-ling': { x: 0.36, y: 0.638, depth: 0.373, scale: 0.034 },
    'seed-spirit': { x: 0.638, y: 0.588, depth: 0.153, scale: 0.03 },
    'leaf-sprite': { x: 0.935, y: 0.6, depth: 0.216, scale: 0.042 },
    'ember-wisp': { x: 0.715, y: 0.742, depth: 0.267, scale: 0.046 },
    'mushroom-pip': { x: 0.445, y: 0.69, depth: 0.353, scale: 0.034 },
    'water-drip': { x: 0.095, y: 0.537, depth: 0.22, scale: 0.066 },
  },
  lightSource: { x: 0.29, y: 0.02 },
  guardianSpot: { x: 0.245, y: 0.48, depth: 0.063, scale: 0.38 },
  sprites: {
    kodama: [kodama1, kodama6, kodama2, kodama4, kodama7, kodama5, kodama3, kodama8],
    creatures: {
      'moss-ling': mossLing,
      'seed-spirit': seedSpirit,
      'leaf-sprite': leafSprite,
      'ember-wisp': emberWisp,
      'mushroom-pip': mushroomPip,
      'water-drip': waterDrip,
    },
    guardian: guardian,
  },
  companions: {
    a: { idle: jijiIdle, happy: jijiHappy, proud: jijiProud, sleepy: jijiSleepy, curious: jijiCurious },
    b: { idle: calciferIdle, happy: calciferHappy, proud: calciferProud, sleepy: calciferSleepy, curious: calciferCurious },
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
  placeholder: placeholder,
};
