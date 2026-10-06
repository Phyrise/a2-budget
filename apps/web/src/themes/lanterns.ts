/**
 * Lanternes de pierre (tōrō) — peintures et ancres (V4).
 * GÉNÉRÉ par art/pipeline/v4/gen_lanterns.py : ne pas éditer à la main
 * (voir art/pipeline/v4/README.md).
 *
 * Clés = identifiants de `LANTERNS` (@a2/core, home/lanterns.ts).
 * Poids : 657 Ko — éteintes 267 Ko, allumées
 * 272 Ko, silhouettes 91 Ko, kodama 27 Ko.
 *
 * Formats (WebP RGBA non prémultiplié, couleurs propagées sous l'alpha nul,
 * marge transparente de 6 px) :
 * - `unlit` / `lit` / `silhouette` d'un même modèle partagent EXACTEMENT la
 *   même toile (largeur, hauteur, cadrage) : on les superpose et l'on fond
 *   l'une dans l'autre sans saut. L'allumée est recalée sur l'éteinte
 *   (corrélation de phase + ECC, IoU de l'alpha : kasuga-moss 0.949, yukimi 0.962, oribe 0.954, kotoji 0.949, tachi-carved 0.951, ancient-shrine 0.960, spirit-light 0.953)
 *   puis recomposée « éteinte + lumière » : hors de la zone éclairée, les
 *   pixels sont ceux de l'éteinte.
 * - Les sept modèles sont à la MÊME échelle (celle de la planche) : le plus
 *   haut fait 420 px utiles. Toiles : kasuga-moss 243×365, yukimi 348×328, oribe 261×429, kotoji 316×368, tachi-carved 287×440, ancient-shrine 378×433, spirit-light 309×442.
 *   `scale` = hauteur de la toile / celle du plus haut modèle : à multiplier
 *   par la hauteur d'affichage choisie pour garder les tailles relatives.
 * - `silhouette` : alpha de l'éteinte légèrement flouté, rempli d'un ton de
 *   brume sombre ; aucun détail. Pour le Carnet tant que le modèle n'est pas
 *   débloqué : n'importer / afficher QUE la silhouette (la vraie image n'est
 *   jamais chargée avant le déblocage).
 *
 * Ancres, en coordonnées normalisées de la toile (0..1, origine en haut à
 * gauche, marge comprise) :
 * - `fire` : centre de la chambre à feu (barycentre de la lumière ajoutée) —
 *   y centrer la lueur vivante (halo qui respire, lucioles qui tournent) ;
 * - `roof` : point de la surface du toit, à droite du fleuron — y poser le
 *   point d'assise (`seat`) d'un kodama de `kodamaOnLantern`.
 *
 * Kodama sur la lanterne : 4 poses (~200 px de haut, même échelle), `seat` =
 * hauteur de l'assise en fraction de la toile du sprite (depuis le haut) :
 * placer le sprite en (roof.x·W − w/2, roof.y·H − seat·h). Taille
 * conseillée : le plus grand sprite ≈ 0,18–0,2 × la hauteur du plus haut
 * modèle affiché (rendu dans art/pipeline/out/v4/out/qa/lantern-anchors.png).
 */
import lanternKasugaMossUnlit from './assets/lanterns/lantern-kasuga-moss-unlit.webp';
import lanternKasugaMossLit from './assets/lanterns/lantern-kasuga-moss-lit.webp';
import lanternKasugaMossSilhouette from './assets/lanterns/lantern-kasuga-moss-silhouette.webp';
import lanternYukimiUnlit from './assets/lanterns/lantern-yukimi-unlit.webp';
import lanternYukimiLit from './assets/lanterns/lantern-yukimi-lit.webp';
import lanternYukimiSilhouette from './assets/lanterns/lantern-yukimi-silhouette.webp';
import lanternOribeUnlit from './assets/lanterns/lantern-oribe-unlit.webp';
import lanternOribeLit from './assets/lanterns/lantern-oribe-lit.webp';
import lanternOribeSilhouette from './assets/lanterns/lantern-oribe-silhouette.webp';
import lanternKotojiUnlit from './assets/lanterns/lantern-kotoji-unlit.webp';
import lanternKotojiLit from './assets/lanterns/lantern-kotoji-lit.webp';
import lanternKotojiSilhouette from './assets/lanterns/lantern-kotoji-silhouette.webp';
import lanternTachiCarvedUnlit from './assets/lanterns/lantern-tachi-carved-unlit.webp';
import lanternTachiCarvedLit from './assets/lanterns/lantern-tachi-carved-lit.webp';
import lanternTachiCarvedSilhouette from './assets/lanterns/lantern-tachi-carved-silhouette.webp';
import lanternAncientShrineUnlit from './assets/lanterns/lantern-ancient-shrine-unlit.webp';
import lanternAncientShrineLit from './assets/lanterns/lantern-ancient-shrine-lit.webp';
import lanternAncientShrineSilhouette from './assets/lanterns/lantern-ancient-shrine-silhouette.webp';
import lanternSpiritLightUnlit from './assets/lanterns/lantern-spirit-light-unlit.webp';
import lanternSpiritLightLit from './assets/lanterns/lantern-spirit-light-lit.webp';
import lanternSpiritLightSilhouette from './assets/lanterns/lantern-spirit-light-silhouette.webp';
import kodamaSit from './assets/lanterns/kodama-sit.webp';
import kodamaLying from './assets/lanterns/kodama-lying.webp';
import kodamaPair from './assets/lanterns/kodama-pair.webp';
import kodamaWave from './assets/lanterns/kodama-wave.webp';

export type LanternId = 'kasuga-moss' | 'yukimi' | 'oribe' | 'kotoji' | 'tachi-carved' | 'ancient-shrine' | 'spirit-light';
export type KodamaPose = 'sit' | 'lying' | 'pair' | 'wave';

export interface LanternPoint {
  x: number;
  y: number;
}

export interface LanternArt {
  unlit: string;
  lit: string;
  silhouette: string;
  /** Assise d'un kodama sur le toit (coordonnées normalisées de la toile). */
  roof: LanternPoint;
  /** Centre de la chambre à feu (coordonnées normalisées de la toile). */
  fire: LanternPoint;
  /** Largeur / hauteur de la toile. */
  aspect: number;
  /** Hauteur de la toile / hauteur du plus haut modèle (tailles relatives). */
  scale: number;
  /** Taille de la toile en px. */
  width: number;
  height: number;
}

export interface KodamaOnLantern {
  pose: KodamaPose;
  src: string;
  /** Hauteur de l'assise, fraction de la hauteur du sprite (depuis le haut). */
  seat: number;
}

export const LANTERN_ART: Record<LanternId, LanternArt> = {
  'kasuga-moss': {
    unlit: lanternKasugaMossUnlit,
    lit: lanternKasugaMossLit,
    silhouette: lanternKasugaMossSilhouette,
    roof: { x: 0.654, y: 0.154 },
    fire: { x: 0.479, y: 0.415 },
    aspect: 0.6658,
    scale: 0.8258,
    width: 243,
    height: 365,
  },
  'yukimi': {
    unlit: lanternYukimiUnlit,
    lit: lanternYukimiLit,
    silhouette: lanternYukimiSilhouette,
    roof: { x: 0.695, y: 0.169 },
    fire: { x: 0.498, y: 0.415 },
    aspect: 1.061,
    scale: 0.7421,
    width: 348,
    height: 328,
  },
  'oribe': {
    unlit: lanternOribeUnlit,
    lit: lanternOribeLit,
    silhouette: lanternOribeSilhouette,
    roof: { x: 0.644, y: 0.141 },
    fire: { x: 0.48, y: 0.338 },
    aspect: 0.6084,
    scale: 0.9706,
    width: 261,
    height: 429,
  },
  'kotoji': {
    unlit: lanternKotojiUnlit,
    lit: lanternKotojiLit,
    silhouette: lanternKotojiSilhouette,
    roof: { x: 0.709, y: 0.169 },
    fire: { x: 0.499, y: 0.36 },
    aspect: 0.8587,
    scale: 0.8326,
    width: 316,
    height: 368,
  },
  'tachi-carved': {
    unlit: lanternTachiCarvedUnlit,
    lit: lanternTachiCarvedLit,
    silhouette: lanternTachiCarvedSilhouette,
    roof: { x: 0.655, y: 0.177 },
    fire: { x: 0.486, y: 0.337 },
    aspect: 0.6523,
    scale: 0.9955,
    width: 287,
    height: 440,
  },
  'ancient-shrine': {
    unlit: lanternAncientShrineUnlit,
    lit: lanternAncientShrineLit,
    silhouette: lanternAncientShrineSilhouette,
    roof: { x: 0.693, y: 0.205 },
    fire: { x: 0.531, y: 0.408 },
    aspect: 0.873,
    scale: 0.9796,
    width: 378,
    height: 433,
  },
  'spirit-light': {
    unlit: lanternSpiritLightUnlit,
    lit: lanternSpiritLightLit,
    silhouette: lanternSpiritLightSilhouette,
    roof: { x: 0.641, y: 0.151 },
    fire: { x: 0.524, y: 0.344 },
    aspect: 0.6991,
    scale: 1.0,
    width: 309,
    height: 442,
  },
};

/** Accès par identifiant quelconque (undefined si inconnu) : ex. `lanternArt[focus.selectedLantern]`. */
export const lanternArt: Partial<Record<string, LanternArt>> = LANTERN_ART;

/** Kodama à poser sur le toit : assis, allongé, à deux, qui salue. */
export const KODAMA_ON_LANTERN: readonly KodamaOnLantern[] = [
  { pose: 'sit', src: kodamaSit, seat: 0.7 },
  { pose: 'lying', src: kodamaLying, seat: 0.93 },
  { pose: 'pair', src: kodamaPair, seat: 0.74 },
  { pose: 'wave', src: kodamaWave, seat: 0.74 },
];

/** URL des sprites de kodama sur lanterne (même ordre que KODAMA_ON_LANTERN). */
export const kodamaOnLantern: string[] = KODAMA_ON_LANTERN.map((k) => k.src);
