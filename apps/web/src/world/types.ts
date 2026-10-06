/**
 * Contrats du « monde » (scène forêt vivante). Fichier partagé : toute
 * modification se coordonne entre le moteur (world/engine), le pipeline
 * d'assets (world/manifest.ts) et les écrans qui affichent la forêt.
 */

/** Humeur visible de la forêt (dérivée de vitalityState, jamais de nombre). */
export type Mood = 'quiet' | 'peaceful' | 'lively' | 'flourishing';

/** Saison (hémisphère nord, date locale). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Qui a fait la tâche (repère de couleur des lumières du jour). */
export type Who = 'a' | 'b' | 'both' | 'unassigned';

/** Une lumière du jour : une tâche faite aujourd'hui, posée dans la forêt. */
export interface WorldLight {
  /** Identifiant stable (id du fait Maison) : sert à placer la lumière sur une ancre stable. */
  id: string;
  who: Who;
}

/** État du monde, calculé par les écrans à partir de l'AppState (core). */
export interface WorldState {
  /** Stade de croissance permanent 1..7 (ForestState.growthStage). */
  stage: number;
  /** Progression 0..1 vers le stade suivant (effets subtils, jamais affichée). */
  growthProgress: number;
  mood: Mood;
  /** Maison en pause : la forêt dort (nuit). */
  paused: boolean;
  /** Créatures débloquées (ids de CREATURES dans @a2/core). */
  creatures: string[];
  /** Tâches faites aujourd'hui, ordre stable. */
  lights: WorldLight[];
  /** Saison réelle (date locale) : particules saisonnières dans la forêt. */
  season: Season;
  /**
   * Lanterne de pierre posée au pied du cèdre (V4) : modèle choisi
   * (`activeLantern(app.focus)` de @a2/core, clé de LANTERN_ART dans
   * themes/lanterns.ts). Absent ou inconnu : 'kasuga-moss'. Éteinte en temps
   * normal, allumée par `focus(progress)`.
   */
  lantern?: { id: string };
}

/**
 * Variante d'affichage :
 * - `hero`     : scène vivante principale (Maison), animée ;
 * - `banner`   : bandeau (Budget, Courses), image fixe rendue une fois ;
 * - `backdrop` : colonne monde plein écran sur ordinateur.
 */
export type WorldVariant = 'hero' | 'banner' | 'backdrop';

export type WorldMotion = 'full' | 'gentle' | 'still';

export interface LivingForestProps {
  state: WorldState;
  variant?: WorldVariant;
  /** false : une seule image rendue (0 GPU ensuite). Défaut : true pour hero. */
  live?: boolean;
  /**
   * Préférence « Forêt » des réglages : `full` (vivante), `gentle` (douce :
   * mouvements réduits de moitié, pas de parallaxe automatique), `still`
   * (immobile : images fixes en fondu). `prefers-reduced-motion` force `still`.
   */
  motion?: WorldMotion;
  className?: string;
  /** Appelé quand la première image est affichée (poster ou WebGL). */
  onReady?: () => void;
}

export interface PulseOptions {
  id: string;
  who: Who;
  fromClientX?: number;
  fromClientY?: number;
  /** Corvée (effort 3) : lumière plus grande et plus chaude, souffle plus long. */
  strong?: boolean;
}

/** Commandes impératives exposées par <LivingForest ref={…}>. */
export interface LivingForestHandle {
  /**
   * Retour de complétion : une lumière monte depuis le point d'écran donné
   * (ex. la case cochée) et se pose sur son ancre. Coordonnées client (px).
   */
  pulse(opts: PulseOptions): void;
  /** Événement rare du gardien (≈10 s, passable au tap). */
  playGuardian(): void;
  /**
   * Lanterne (minuteur de concentration) : progress 0..1 allume la lanterne
   * de pierre posée au pied du cèdre (WorldState.lantern) : la peinture
   * allumée se fond sur l'éteinte, lueur au foyer, halo, lucioles qui
   * s'approchent ; null l'éteint en douceur. À 1, courte floraison de
   * lumière. Demandée avant que le moteur soit prêt : appliquée à son
   * initialisation.
   */
  focus(progress: number | null, who?: Who): void;
}

// ---------------------------------------------------------------------------
// Manifest des assets (généré par le pipeline art/pipeline → world/manifest.ts)
// ---------------------------------------------------------------------------

/** Point normalisé dans l'image portrait (0..1, origine en haut à gauche). */
export interface ScenePoint {
  x: number;
  y: number;
  /** Profondeur 0 (loin) .. 1 (près), lue dans la carte de profondeur. */
  depth: number;
  /** Échelle relative du sprite (hauteur / hauteur d'image), si sprite. */
  scale?: number;
}

export interface SceneImage {
  /** Couleur (URL Vite). */
  color: string;
  /** Profondeur en niveaux de gris, blanc = près (URL Vite). null si absente. */
  depth: string | null;
}

export type GrowthStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type LutName = Mood | 'night';
export type CompanionMood = 'idle' | 'happy' | 'proud' | 'sleepy' | 'curious';

/**
 * Variante saisonnière de la forêt : mêmes stades, même cadrage que la base
 * (la base = été / saison des pluies). La profondeur peut être celle de la base
 * (champ depth = profondeur de base) si l'alignement est vérifié.
 */
export interface SeasonSet {
  stages: Record<GrowthStage, SceneImage>;
  /** LUT nuit propre à la saison (maîtresse de saison → nuit de saison), null = LUT nuit de base. */
  nightLut: string | null;
}

export interface WorldManifest {
  /** Taille de référence des images portrait (px). */
  size: { w: number; h: number };
  /** Une peinture complète par stade de croissance (même cadrage). */
  stages: Record<GrowthStage, SceneImage>;
  /**
   * Masques de la scène (cadrage portrait), PNG RGB opaque :
   * R = eau (écoulement), G = feuillage/fougères (vent),
   * B = cèdre central (révélations de croissance). null si absent.
   */
  masks: string | null;
  /**
   * Trouées de lumière dans la canopée (niveaux de gris, opaque), recomposé
   * par le moteur en canal A des masques. Fichier séparé car WebKit perd le
   * RGB d'un PNG RGBA là où l'alpha est nul. null si absent.
   */
  masksLight: string | null;
  /** Cadre de fougères au premier plan (RGBA, même cadrage portrait). */
  foreground: string | null;
  /** LUT 3D 33³ en bande 1089×33 (PNG), par humeur + nuit. null = identité. */
  luts: Record<LutName, string | null>;
  /** Ancres des lumières du jour (racines, rochers, berge…), ≥ 8. */
  anchors: ScenePoint[];
  /** Emplacements des kodama. */
  kodamaSpots: ScenePoint[];
  /** Emplacement de chaque créature débloquable (clé = id core). */
  creatureSpots: Record<string, ScenePoint>;
  /** Origine des rayons de lumière (dans la canopée). */
  lightSource: { x: number; y: number };
  /** Où apparaît le gardien (pieds), et sa hauteur relative. */
  guardianSpot: ScenePoint;
  sprites: {
    kodama: string[];
    creatures: Record<string, string>;
    guardian: string;
  };
  /**
   * Compagnons de l'interface : a = Jiji (AL), b = Calcifer (AC).
   * Source : planches V3 uniquement (12-jiji-reactions-v3, 13-calcifer-reactions-v3).
   */
  companions: Record<'a' | 'b', Record<CompanionMood, string>>;
  /**
   * Effets peints (planche 14-effects-sheet, fond noir → mélange additif) :
   * nappes de brume, rayons, gouttes, aiguilles de cèdre, spores, halos de kodama.
   * Chaque URL est une texture prête pour un mélange additif (RGB sur noir) ou
   * alpha prémultiplié. null si absente (le moteur génère alors l'effet).
   */
  fx: Record<'fog' | 'rays' | 'drips' | 'needles' | 'motes' | 'halos', string[]> | null;
  /** Bandeaux fixes peints pour les autres modules. */
  banners: { budget: string; courses: string };
  /** Petite image très légère (≤ 30 KB) affichée avant le chargement. */
  placeholder: string;
  /**
   * Variantes saisonnières (printemps, automne, hiver). Absent = la base sert
   * toute l'année. Chargées à la demande (jamais toutes précachées).
   */
  seasons?: Partial<Record<Exclude<Season, 'summer'>, SeasonSet>>;
}
